#!/usr/bin/env bun
// Reads approvals.json (exported from preview.html) and applies decisions:
//   approved → copy fixes/{slug}-{variant}-fixed.png over the original file
//   rejected → remove customer from manifest.json + delete all their logo files
//
// Usage:
//   bun shared/logos/clients/apply-approvals.ts
//
// After running, re-run `bun shared/logos/clients/audit.ts` to regenerate the
// audit and refresh the preview page.

import { readFileSync, writeFileSync, existsSync, unlinkSync, copyFileSync } from 'fs';
import { join } from 'path';

const CLIENTS_DIR = join(process.cwd(), "public", "logos");
const APPROVALS_PATH = join(CLIENTS_DIR, 'approvals.json');
const AUDIT_PATH = join(CLIENTS_DIR, 'audit.json');
const MANIFEST_PATH = join(CLIENTS_DIR, 'manifest.json');

if (!existsSync(APPROVALS_PATH)) {
  console.error(`[apply] no approvals.json at ${APPROVALS_PATH}`);
  console.error('[apply] export decisions from preview.html first, then drop the file here.');
  process.exit(1);
}

type Decision = 'approved' | 'rejected';
const approvals = JSON.parse(readFileSync(APPROVALS_PATH, 'utf-8')) as Record<string, Decision>;
const audit = JSON.parse(readFileSync(AUDIT_PATH, 'utf-8')) as { audits: any[] };
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as { customers: any[] };

const auditBySlug = new Map(audit.audits.map((a: any) => [a.slug, a]));

let appliedCount = 0;
let rejectedCount = 0;
let missingFixCount = 0;

const keptCustomers: any[] = [];

for (const customer of manifest.customers) {
  const decision = approvals[customer.slug];

  if (decision === 'rejected') {
    // Delete all files for this customer
    for (const variant of ['on-light', 'on-dark']) {
      for (const ext of ['svg', 'png', 'webp', 'jpg', 'jpeg', 'gif']) {
        const p = join(CLIENTS_DIR, `${customer.slug}-${variant}.${ext}`);
        if (existsSync(p)) unlinkSync(p);
      }
    }
    // Delete fix files if any
    const a = auditBySlug.get(customer.slug);
    if (a?.fixLight?.path) {
      const fp = join(CLIENTS_DIR, a.fixLight.path);
      if (existsSync(fp)) unlinkSync(fp);
    }
    if (a?.fixDark?.path) {
      const fp = join(CLIENTS_DIR, a.fixDark.path);
      if (existsSync(fp)) unlinkSync(fp);
    }
    console.log(`  ✗ dropped ${customer.slug.padEnd(28)} (${customer.name})`);
    rejectedCount++;
    continue;
  }

  if (decision === 'approved') {
    const a = auditBySlug.get(customer.slug);
    if (!a) {
      keptCustomers.push(customer);
      continue;
    }

    // Apply fixes. Original path derived from audit's file field.
    const applyFix = (variantKey: 'onLight' | 'onDark', fixKey: 'fixLight' | 'fixDark') => {
      const fix = a[fixKey];
      const variant = a[variantKey];
      if (!fix?.path || !variant?.file) return false;
      const fixAbs = join(CLIENTS_DIR, fix.path);
      if (!existsSync(fixAbs)) {
        missingFixCount++;
        return false;
      }
      // Delete the old original (any ext), then copy fix into slug-{variant}.png
      const baseName = variant.file.replace(/\.[^.]+$/, '');
      for (const ext of ['svg', 'png', 'webp', 'jpg', 'jpeg', 'gif']) {
        const p = join(CLIENTS_DIR, `${baseName}.${ext}`);
        if (existsSync(p)) unlinkSync(p);
      }
      const dest = join(CLIENTS_DIR, `${baseName}.png`);
      copyFileSync(fixAbs, dest);
      return true;
    };

    const didLight = applyFix('onLight', 'fixLight');
    const didDark = applyFix('onDark', 'fixDark');

    if (didLight || didDark) {
      console.log(`  ✓ applied ${customer.slug.padEnd(28)} (${[didLight && 'light', didDark && 'dark'].filter(Boolean).join(' + ')})`);
      appliedCount++;
    }
  }

  keptCustomers.push(customer);
}

// Write pruned manifest
if (rejectedCount > 0) {
  writeFileSync(MANIFEST_PATH, JSON.stringify({ customers: keptCustomers }, null, 2) + '\n');
}

console.log('');
console.log(`[apply] Summary:`);
console.log(`  Applied fixes:   ${appliedCount}`);
console.log(`  Rejected/dropped: ${rejectedCount}`);
console.log(`  Kept customers:   ${keptCustomers.length}`);
if (missingFixCount > 0) console.log(`  ⚠ Missing fix files: ${missingFixCount}`);
console.log('');
console.log('Next: bun shared/logos/clients/audit.ts   # refresh audit.json');
