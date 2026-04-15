#!/usr/bin/env bun
// Pulls Account Type, DUNS, Partner channel, and Mindset_Partner flag from
// Salesforce for every customer in manifest.json with an sfId, and writes the
// result to public/logos/salesforce.json.
//
// That sidecar is read by lib/logos.ts and surfaced on the gallery + JSON API
// + MCP so downstream consumers can filter by Customer / Partner / Prospect
// and match accounts by DUNS.
//
// Run with: bun scripts/enrich-salesforce.ts
// Requires SF_INSTANCE_URL + SF_ACCESS_TOKEN env vars.
// Get them from `sf org display --json` or the Salesforce CLI.

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CLIENTS_DIR = join(process.cwd(), 'public', 'logos');
const MANIFEST_PATH = join(CLIENTS_DIR, 'manifest.json');
const OUTPUT_PATH = join(CLIENTS_DIR, 'salesforce.json');

const SF_URL = process.env.SF_INSTANCE_URL;
const SF_TOKEN = process.env.SF_ACCESS_TOKEN;

if (!SF_URL || !SF_TOKEN) {
  console.error('[enrich-sf] Missing SF_INSTANCE_URL or SF_ACCESS_TOKEN env vars.');
  console.error('[enrich-sf] Run `sf org display --json` and export the values.');
  process.exit(1);
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
  const soql = `SELECT Id, Name, Type, D_U_N_S_Number__c, Partner__c, Mindset_Partner__c FROM Account WHERE Id IN (${idList})`;
  const url = `${SF_URL}/services/data/v60.0/query?q=${encodeURIComponent(soql)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${SF_TOKEN}` } });
  if (!res.ok) {
    throw new Error(`SF query failed ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { records: SfAccount[] };
  return body.records;
}

const BATCH = 60;
const all: SfAccount[] = [];
for (let i = 0; i < sfIds.length; i += BATCH) {
  const batch = sfIds.slice(i, i + BATCH);
  const rows = await query(batch);
  all.push(...rows);
  console.log(`[enrich-sf]   batch ${i / BATCH + 1}: ${rows.length} rows`);
}

const accounts: Record<string, {
  sfName: string | null;
  type: string | null;
  duns: string | null;
  partner: string | null;
  mindsetPartner: boolean;
}> = {};

for (const a of all) {
  accounts[a.Id] = {
    sfName: a.Name ?? null,
    type: a.Type ?? null,
    duns: a.D_U_N_S_Number__c ?? null,
    partner: a.Partner__c ?? null,
    mindsetPartner: Boolean(a.Mindset_Partner__c),
  };
}

const output = {
  lastSync: new Date().toISOString(),
  accounts,
};

writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');

const typeCounts = all.reduce<Record<string, number>>((acc, a) => {
  const key = a.Type ?? 'Unset';
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

console.log(`[enrich-sf] Wrote ${Object.keys(accounts).length} accounts to ${OUTPUT_PATH}`);
console.log('[enrich-sf] Type distribution:', typeCounts);
