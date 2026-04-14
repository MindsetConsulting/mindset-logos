#!/usr/bin/env bun
// Walks every customer in manifest.json, inspects both logo variants on disk,
// and writes audit.json with per-customer quality data.
//
// Quality ratings per variant:
//   'good'      wordmark-like aspect ratio, transparent alpha
//   'icon'      square/icon aspect ratio (fell back to type=icon)
//   'flat'      no alpha channel (baked-in background)
//   'tiny'      smaller than 200px on the long side
//   'missing'   file doesn't exist
//
// Overall status:
//   'all-good'   both variants are 'good'
//   'partial'    at least one variant has an issue
//   'broken'     both variants have major issues
//
// Usage:
//   bun shared/logos/clients/audit.ts

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const CLIENTS_DIR = join(process.cwd(), "public", "logos");
const MANIFEST = join(CLIENTS_DIR, 'manifest.json');
const PENDING_APPROVAL_PATH = join(CLIENTS_DIR, '.pending-approval.json');
const APPROVED_OVERRIDES_PATH = join(CLIENTS_DIR, '.approved-overrides.json');

// Slugs in this file were recently fixed by Claude and are awaiting user
// approval in preview.html. audit.ts forces them to status='partial' so they
// stay in the review queue regardless of file quality.
const pendingApproval: Set<string> = existsSync(PENDING_APPROVAL_PATH)
  ? new Set((JSON.parse(readFileSync(PENDING_APPROVAL_PATH, 'utf-8')) as { slugs: string[] }).slugs)
  : new Set();

// Slugs in this file are user-approved overrides: the audit heuristic flags
// them as 'icon' or 'flat' (usually because they're genuinely square marks
// like BMW roundel, Home Depot square), but the user has confirmed they're
// visually correct. Force these to 'all-good' regardless of quality.
const approvedOverrides: Set<string> = existsSync(APPROVED_OVERRIDES_PATH)
  ? new Set((JSON.parse(readFileSync(APPROVED_OVERRIDES_PATH, 'utf-8')) as { slugs: string[] }).slugs)
  : new Set();

type Customer = { slug: string; name: string; website: string; industry: string; verticals: string[] };

type VariantQuality = 'good' | 'icon' | 'flat' | 'tiny' | 'missing';

type VariantInfo = {
  file: string | null;
  width: number;
  height: number;
  hasAlpha: boolean;
  aspectRatio: number;
  quality: VariantQuality;
};

type CustomerAudit = {
  slug: string;
  name: string;
  industry: string;
  onLight: VariantInfo;
  onDark: VariantInfo;
  status: 'all-good' | 'partial' | 'broken';
  pendingApproval?: boolean;
};

function identify(path: string): { w: number; h: number; alpha: boolean } | null {
  const res = spawnSync('magick', ['identify', '-format', '%w %h %A', path], { encoding: 'utf-8' });
  if (res.status !== 0) return null;
  const [w, h, alpha] = res.stdout.trim().split(' ');
  return { w: Number(w), h: Number(h), alpha: alpha === 'Blend' || alpha === 'On' || alpha === 'Set' || alpha === 'True' };
}

function findFile(slug: string, variant: 'on-light' | 'on-dark'): string | null {
  for (const ext of ['svg', 'webp', 'png', 'jpg', 'gif']) {
    const p = join(CLIENTS_DIR, `${slug}-${variant}.${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

function analyze(path: string | null): VariantInfo {
  if (!path) {
    return { file: null, width: 0, height: 0, hasAlpha: false, aspectRatio: 0, quality: 'missing' };
  }
  const basename = path.split('/').pop()!;
  // SVGs are always vector-transparent
  if (path.endsWith('.svg')) {
    return { file: basename, width: 0, height: 0, hasAlpha: true, aspectRatio: 0, quality: 'good' };
  }
  const info = identify(path);
  if (!info) {
    return { file: basename, width: 0, height: 0, hasAlpha: false, aspectRatio: 0, quality: 'missing' };
  }
  const { w, h, alpha } = info;
  const aspect = w / h;
  const longSide = Math.max(w, h);

  let quality: VariantQuality;
  if (longSide < 200) {
    quality = 'tiny';
  } else if (!alpha) {
    quality = 'flat';
  } else if (aspect >= 0.75 && aspect <= 1.4) {
    // Near-square = icon variant. Wordmarks are usually 2:1 or wider.
    quality = 'icon';
  } else {
    quality = 'good';
  }

  return { file: basename, width: w, height: h, hasAlpha: alpha, aspectRatio: Math.round(aspect * 100) / 100, quality };
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8')) as { customers: Customer[] };

const audits: CustomerAudit[] = manifest.customers.map((c) => {
  const onLight = analyze(findFile(c.slug, 'on-light'));
  const onDark = analyze(findFile(c.slug, 'on-dark'));

  const bothGood = onLight.quality === 'good' && onDark.quality === 'good';
  const bothBad = (onLight.quality === 'missing' || onLight.quality === 'tiny') && (onDark.quality === 'missing' || onDark.quality === 'tiny');
  let status: CustomerAudit['status'] = bothGood ? 'all-good' : bothBad ? 'broken' : 'partial';

  // Recently-fixed slugs stay in the review queue until explicitly approved.
  const isPending = pendingApproval.has(c.slug);
  if (isPending && status === 'all-good') status = 'partial';

  // User-approved overrides force status to all-good regardless of heuristic.
  if (approvedOverrides.has(c.slug)) status = 'all-good';

  return { slug: c.slug, name: c.name, industry: c.industry, onLight, onDark, status, pendingApproval: isPending || undefined };
});

// Summary counts
const counts = {
  total: audits.length,
  allGood: audits.filter((a) => a.status === 'all-good').length,
  partial: audits.filter((a) => a.status === 'partial').length,
  broken: audits.filter((a) => a.status === 'broken').length,
  byQuality: {
    onLight: { good: 0, icon: 0, flat: 0, tiny: 0, missing: 0 },
    onDark: { good: 0, icon: 0, flat: 0, tiny: 0, missing: 0 },
  },
};
for (const a of audits) {
  counts.byQuality.onLight[a.onLight.quality]++;
  counts.byQuality.onDark[a.onDark.quality]++;
}

writeFileSync(join(CLIENTS_DIR, 'audit.json'), JSON.stringify({ ranAt: new Date().toISOString(), counts, audits }, null, 2));

console.log(`[audit] ${counts.total} customers analyzed`);
console.log(`  all-good: ${counts.allGood}`);
console.log(`  partial:  ${counts.partial}`);
console.log(`  broken:   ${counts.broken}`);
console.log('');
console.log('On-light variant quality:');
for (const [k, v] of Object.entries(counts.byQuality.onLight)) console.log(`  ${k.padEnd(8)} ${v}`);
console.log('On-dark variant quality:');
for (const [k, v] of Object.entries(counts.byQuality.onDark)) console.log(`  ${k.padEnd(8)} ${v}`);
