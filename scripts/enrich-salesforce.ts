#!/usr/bin/env bun
// Pulls Account Type, DUNS, Partner channel, and Mindset_Partner flag from
// Salesforce for every customer in manifest.json with an sfId, and writes the
// result to public/logos/salesforce.json.
//
// That sidecar is read by lib/logos.ts and surfaced on the gallery + JSON API
// + MCP so downstream consumers can filter by Customer / Partner / Prospect
// and match accounts by DUNS.
//
// Run with: bun run enrich-sf
// Auth: SF_INSTANCE_URL + SF_ACCESS_TOKEN if set, otherwise the Salesforce CLI
// org alias in SF_ORG (default "mindset-dev"). The CLI path is the one that works
// day to day; raw tokens expire and 401.

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const CLIENTS_DIR = join(process.cwd(), 'public', 'logos');
const MANIFEST_PATH = join(CLIENTS_DIR, 'manifest.json');
const OUTPUT_PATH = join(CLIENTS_DIR, 'salesforce.json');

const SF_URL = process.env.SF_INSTANCE_URL;
const SF_TOKEN = process.env.SF_ACCESS_TOKEN;
const SF_ORG = process.env.SF_ORG ?? 'mindset-dev';

async function soql<T>(q: string): Promise<T[]> {
  if (SF_URL && SF_TOKEN) {
    const res = await fetch(`${SF_URL}/services/data/v60.0/query?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${SF_TOKEN}` },
    });
    if (!res.ok) throw new Error(`SF query failed ${res.status}: ${await res.text()}`);
    return ((await res.json()) as { records: T[] }).records;
  }
  const r = spawnSync('sf', ['data', 'query', '-o', SF_ORG, '-q', q, '--json'], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
  const body = JSON.parse(r.stdout || '{}');
  if (body.status !== 0) throw new Error(`sf CLI query failed: ${body.message ?? r.stderr}`);
  return body.result.records as T[];
}

type Customer = { slug: string; sfId?: string };
type SfAccount = {
  Id: string;
  Name: string | null;
  Type: string | null;
  D_U_N_S_Number__c: string | null;
  Partner__c: string | null;
  Mindset_Partner__c: boolean | null;
};

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as { customers: Customer[] };
const sfIds = Array.from(new Set(manifest.customers.map((c) => c.sfId).filter((x): x is string => Boolean(x))));

console.log(`[enrich-sf] Fetching ${sfIds.length} accounts…`);

async function query(ids: string[]): Promise<SfAccount[]> {
  const idList = ids.map((id) => `'${id}'`).join(',');
  return soql<SfAccount>(
    `SELECT Id, Name, Type, D_U_N_S_Number__c, Partner__c, Mindset_Partner__c FROM Account WHERE Id IN (${idList})`,
  );
}

// Closed-won and open-opportunity counts per account. These are the ground
// truth for the `relationship` field in lib/logos.ts — Account.Type alone let
// prospects onto the website logo wall (caught 2026-08-26).
async function oppCounts(ids: string[], where: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (let i = 0; i < ids.length; i += BATCH) {
    const idList = ids.slice(i, i + BATCH).map((id) => `'${id}'`).join(',');
    const rows = await soql<{ AccountId: string; n: number }>(
      `SELECT AccountId, COUNT(Id) n FROM Opportunity WHERE ${where} AND AccountId IN (${idList}) GROUP BY AccountId`,
    );
    for (const r of rows) counts[r.AccountId] = r.n;
  }
  return counts;
}

const BATCH = 60;
const all: SfAccount[] = [];
for (let i = 0; i < sfIds.length; i += BATCH) {
  const batch = sfIds.slice(i, i + BATCH);
  const rows = await query(batch);
  all.push(...rows);
  console.log(`[enrich-sf]   batch ${i / BATCH + 1}: ${rows.length} rows`);
}

console.log('[enrich-sf] Counting closed-won and open opportunities…');
const wonCounts = await oppCounts(sfIds, "StageName = 'Closed Won'");
const openCounts = await oppCounts(sfIds, 'IsClosed = false');

const accounts: Record<string, {
  sfName: string | null;
  type: string | null;
  duns: string | null;
  partner: string | null;
  mindsetPartner: boolean;
  won: number;
  open: number;
}> = {};

for (const a of all) {
  accounts[a.Id] = {
    sfName: a.Name ?? null,
    type: a.Type ?? null,
    duns: a.D_U_N_S_Number__c ?? null,
    partner: a.Partner__c ?? null,
    mindsetPartner: Boolean(a.Mindset_Partner__c),
    won: wonCounts[a.Id] ?? 0,
    open: openCounts[a.Id] ?? 0,
  };
}

const existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8')) as { manualOverrides?: unknown };

const output = {
  lastSync: new Date().toISOString(),
  accounts,
  ...(existing.manualOverrides ? { manualOverrides: existing.manualOverrides } : {}),
};

writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');

const typeCounts = all.reduce<Record<string, number>>((acc, a) => {
  const key = a.Type ?? 'Unset';
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

console.log(`[enrich-sf] Wrote ${Object.keys(accounts).length} accounts to ${OUTPUT_PATH}`);
console.log('[enrich-sf] Type distribution:', typeCounts);

// Partner-booked deals. When a partner is prime (IBM, SAP), the opportunity
// sits on the partner's account and the real client only appears in the opp
// name: "IBM (Partner) - Consumers Energy (End Customer) - ...". The per-account
// counts above never see those companies, which is how Consumers Energy, a
// $920K win, was missing from the library until an employee asked for it
// (2026-11-19). This only reports. Add the entry or fix the tag by hand.
type PartnerOpp = { Name: string; IsWon: boolean; IsClosed: boolean; Account: { Name: string } | null };
type Entry = Customer & { name: string; sfName?: string; partnerDeal?: { partner: string; status: 'won' | 'open' } };

// End customers whose opp-name spelling doesn't resemble their library entry.
const END_CUSTOMER_ALIASES: Record<string, string> = { 'pure storage': 'everpure' };

const norm = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const entries = manifest.customers as Entry[];

function findEntry(endCustomer: string): Entry | undefined {
  const alias = END_CUSTOMER_ALIASES[endCustomer.toLowerCase()];
  if (alias) return entries.find((e) => e.slug === alias);
  const q = norm(endCustomer);
  if (q.length < 3) return undefined;
  return entries.find((e) =>
    [e.slug, e.name, e.sfName ?? ''].map(norm).some((k) => k.length >= 3 && (k.includes(q) || q.includes(k))),
  );
}

const partnerOpps = await soql<PartnerOpp>(
  "SELECT Name, IsWon, IsClosed, Account.Name FROM Opportunity WHERE Name LIKE '%(End Customer)%' AND (IsWon = true OR IsClosed = false)",
);
const live = new Map<string, { won: boolean; via: Set<string> }>();
for (const o of partnerOpps) {
  const endCustomer = o.Name.split(/\(End Customer\)/i)[0].replace(/^.*Partner\)?\s*-?\s*/i, '').trim();
  if (!endCustomer) continue;
  const cur = live.get(endCustomer) ?? { won: false, via: new Set<string>() };
  cur.won = cur.won || o.IsWon;
  if (o.Account?.Name) cur.via.add(o.Account.Name);
  live.set(endCustomer, cur);
}

const missing: string[] = [];
const tagged = new Map<string, 'won' | 'open'>();
for (const [endCustomer, d] of live) {
  const entry = findEntry(endCustomer);
  const status = d.won ? 'won' : 'open';
  if (!entry) missing.push(`${endCustomer} (${status}, booked on ${[...d.via].join(', ')})`);
  else if (entry.partnerDeal) tagged.set(entry.slug, tagged.get(entry.slug) === 'won' ? 'won' : status);
}
const stale = entries
  .filter((e) => e.partnerDeal && tagged.get(e.slug) !== e.partnerDeal.status)
  .map((e) => `${e.slug}: tagged ${e.partnerDeal!.status}, Salesforce says ${tagged.get(e.slug) ?? 'no won or open deal'}`);

if (missing.length) {
  console.log(`[enrich-sf] ${missing.length} end customers on partner-booked deals are NOT in the library:`);
  for (const m of missing) console.log(`[enrich-sf]   ${m}`);
}
if (stale.length) {
  console.log('[enrich-sf] partnerDeal tags in manifest.json that no longer match Salesforce:');
  for (const s of stale) console.log(`[enrich-sf]   ${s}`);
}
if (!missing.length && !stale.length) console.log('[enrich-sf] Partner-booked deals: every end customer is in the library and tagged correctly.');
