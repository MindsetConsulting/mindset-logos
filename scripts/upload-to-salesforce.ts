#!/usr/bin/env bun
// Uploads each customer's on-light and on-dark logo to their Salesforce Account
// as ContentVersion files. Run with: bun scripts/upload-to-salesforce.ts
//
// Each upload creates a ContentVersion with:
//   Title = "Mindset Logo - on-{variant}"
//   FirstPublishLocationId = Account.Id (auto-creates ContentDocument + link)
//   VersionData = base64(file contents)
//
// This is idempotent-ish: it checks for existing ContentDocumentLinks with a
// matching title before uploading. Pass --force to re-upload.
//
// Requires SF_INSTANCE_URL + SF_ACCESS_TOKEN env vars. Use `sf org display` to
// get them, or call the mindset-salesforce MCP server if running from Claude.

import { readFileSync } from 'fs';
import { join } from 'path';

const CLIENTS_DIR = join(process.cwd(), 'public', 'logos');
const MANIFEST_PATH = join(CLIENTS_DIR, 'manifest.json');

type Hq = { street: string | null; city: string | null; state: string | null; country: string | null; display: string | null };
type Customer = {
  slug: string;
  name: string;
  website: string;
  industry: string;
  verticals: string[];
  sfId?: string;
  sfName?: string;
  hq?: Hq;
};

const force = process.argv.includes('--force');
const specificSlugs = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const SF_URL = process.env.SF_INSTANCE_URL;
const SF_TOKEN = process.env.SF_ACCESS_TOKEN;

if (!SF_URL || !SF_TOKEN) {
  console.error('[upload-to-sf] Missing SF_INSTANCE_URL or SF_ACCESS_TOKEN env vars.');
  console.error('[upload-to-sf] Run `sf org display --json` and export the values.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as { customers: Customer[] };

async function uploadVariant(slug: string, sfId: string, variant: 'on-light' | 'on-dark'): Promise<'uploaded' | 'skipped' | 'missing'> {
  // Find the file
  const exts = ['svg', 'png', 'webp', 'jpg', 'gif'];
  let file: string | null = null;
  let ext: string | null = null;
  for (const e of exts) {
    try {
      const p = join(CLIENTS_DIR, `${slug}-${variant}.${e}`);
      readFileSync(p);
      file = p;
      ext = e;
      break;
    } catch {}
  }
  if (!file || !ext) return 'missing';

  const title = `Mindset Logo - ${variant}`;

  // Check for existing
  if (!force) {
    const res = await fetch(
      `${SF_URL}/services/data/v63.0/query?q=${encodeURIComponent(
        `SELECT Id FROM ContentDocumentLink WHERE LinkedEntityId='${sfId}' AND ContentDocument.Title='${title}'`,
      )}`,
      { headers: { Authorization: `Bearer ${SF_TOKEN}` } },
    );
    const data = (await res.json()) as { totalSize: number };
    if (data.totalSize > 0) return 'skipped';
  }

  // Upload
  const buf = readFileSync(file);
  const body = {
    Title: title,
    PathOnClient: `${slug}-${variant}.${ext}`,
    VersionData: buf.toString('base64'),
    FirstPublishLocationId: sfId,
  };

  const res = await fetch(`${SF_URL}/services/data/v63.0/sobjects/ContentVersion`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`  ✗ ${slug} ${variant}: ${res.status} ${err.slice(0, 200)}`);
    return 'missing';
  }
  return 'uploaded';
}

const targets = specificSlugs.length
  ? manifest.customers.filter((c) => specificSlugs.includes(c.slug))
  : manifest.customers;

let uploaded = 0;
let skipped = 0;
let missing = 0;

for (const c of targets) {
  if (!c.sfId) {
    console.log(`  · ${c.slug.padEnd(28)} — no sfId, skipping`);
    missing++;
    continue;
  }
  const light = await uploadVariant(c.slug, c.sfId, 'on-light');
  const dark = await uploadVariant(c.slug, c.sfId, 'on-dark');
  console.log(`  ${c.slug.padEnd(28)} light=${light} dark=${dark}`);
  if (light === 'uploaded') uploaded++;
  else if (light === 'skipped') skipped++;
  else missing++;
  if (dark === 'uploaded') uploaded++;
  else if (dark === 'skipped') skipped++;
  else missing++;
}

console.log('');
console.log('[upload-to-sf] Summary:');
console.log(`  Uploaded: ${uploaded}`);
console.log(`  Skipped (already exists): ${skipped}`);
console.log(`  Missing/failed: ${missing}`);
