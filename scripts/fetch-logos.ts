#!/usr/bin/env bun
// Fetches both light AND dark theme variants of each customer logo from Brandfetch.
//
// Output: for each slug, produces up to two files:
//   {slug}-light.{ext}    logo designed for light backgrounds (dark/colored logo)
//   {slug}-dark.{ext}     logo designed for dark backgrounds  (white/light logo)
//
// Some brands only have one theme in Brandfetch's DB — that's fine, we detect
// fallback hashes and skip writing files that are the "Brandfetch" placeholder.
//
// Fallback strategy per theme:
//   1. type=logo      (horizontal wordmark — preferred)
//   2. type=icon      (square mark — if no wordmark)
//   3. default        (whatever Brandfetch has)
//
// Usage:
//   bun shared/logos/clients/fetch-logos.ts                 # skip existing
//   bun shared/logos/clients/fetch-logos.ts --force         # overwrite
//   bun shared/logos/clients/fetch-logos.ts slug1 slug2     # specific slugs

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';

const CLIENTS_DIR = join(process.cwd(), "public", "logos");
const MANIFEST = join(CLIENTS_DIR, 'manifest.json');
const CLIENT_ID = process.env.BRANDFETCH_CLIENT_ID ?? '1idwwgaIbVRNSiyjCdu';

// Brandfetch serves these hashes when it can't find a matching logo for the
// requested theme/type combo. Any file matching one of these is unusable.
const FALLBACK_HASHES = new Set<string>([
  '95135ecb44a4', // "Brandfetch" wordmark, theme=dark (dark ink, for light BG)
  '51dad6df7520', // "Brandfetch" wordmark, theme=light (white ink, for dark BG)
  'b8d53c4fb2de', // 40x40 placeholder — domain not in Brandfetch at all
  '38bcb2ab059c', // Brandfetch "B" square placeholder (appeared across 5 unrelated slugs)
]);

// Override the domain Salesforce has on file when it doesn't match the brand's primary .com
const DOMAIN_OVERRIDES: Record<string, string> = {
  'arctic-cat': 'arcticcat.com',
  'bmw': 'bmw.com',
  'callaway-golf': 'callawaygolf.com',
  'anchorage': 'muni.org',
  'bcbs-mn': 'bluecrossmn.com',
};

type Customer = {
  slug: string;
  name: string;
  website: string;
  industry: string;
  verticals: string[];
};

type ThemeResult = { status: 'saved'; file: string; type: 'logo' | 'icon'; hash: string } | { status: 'missing'; reason: string };

type FetchResult = {
  slug: string;
  name: string;
  domain: string;
  light: ThemeResult;
  dark: ThemeResult;
};

const args = process.argv.slice(2);
const force = args.includes('--force');
const targetSlugs = args.filter((a) => !a.startsWith('--'));

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8')) as { customers: Customer[] };
let customers = manifest.customers;
if (targetSlugs.length > 0) customers = customers.filter((c) => targetSlugs.includes(c.slug));

console.log(`[fetch-logos] dual-theme mode — ${customers.length} customers${force ? ' (force)' : ''}`);

function extractDomain(website: string): string {
  try {
    const u = new URL(website.startsWith('http') ? website : `https://${website}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function extFromContentType(ct: string): string | null {
  const c = ct.toLowerCase();
  if (c.includes('svg')) return 'svg';
  if (c.includes('png')) return 'png';
  if (c.includes('webp')) return 'webp';
  if (c.includes('jpeg') || c.includes('jpg')) return 'jpg';
  if (c.includes('gif')) return 'gif';
  return null;
}

function hashPrefix(buf: Buffer): string {
  return createHash('sha1').update(buf).digest('hex').slice(0, 12);
}

// Brandfetch's `theme=light` returns the LIGHT variant (white/pale logo) which is meant
// to be placed on DARK backgrounds. We rename the file to `-on-dark` for clarity so the
// deck slides don't have to remember the inversion.
function themeForFilename(theme: 'light' | 'dark'): 'dark' | 'light' {
  return theme === 'light' ? 'dark' : 'light';
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://mindsetconsulting.com',
  'Referer': 'https://mindsetconsulting.com/',
  'Sec-Fetch-Dest': 'image',
  'Sec-Fetch-Mode': 'no-cors',
  'Sec-Fetch-Site': 'cross-site',
};

async function brandfetchGet(domain: string, path: string): Promise<{ ext: string; buf: Buffer; hash: string } | { error: string }> {
  const url = `https://cdn.brandfetch.io/${encodeURIComponent(domain)}${path ? '/' + path : ''}?c=${CLIENT_ID}`;
  try {
    const res = await fetch(url, { redirect: 'follow', headers: BROWSER_HEADERS });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const ct = res.headers.get('content-type') ?? '';
    const ext = extFromContentType(ct);
    if (!ext) return { error: `unexpected content-type: ${ct}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) return { error: `too small: ${buf.length}B` };
    return { ext, buf, hash: hashPrefix(buf) };
  } catch (e: any) {
    return { error: e?.message ?? String(e) };
  }
}

// Purge any existing file for a slug+theme (any extension)
function purgeSlugTheme(slug: string, theme: 'light' | 'dark') {
  for (const ext of ['svg', 'png', 'webp', 'jpg', 'jpeg', 'gif', 'ico']) {
    const p = join(CLIENTS_DIR, `${slug}-on-${themeForFilename(theme)}.${ext}`);
    if (existsSync(p)) unlinkSync(p);
  }
}

function hasExisting(slug: string, theme: 'light' | 'dark'): string | null {
  for (const ext of ['svg', 'png', 'webp', 'jpg', 'gif']) {
    const p = join(CLIENTS_DIR, `${slug}-on-${themeForFilename(theme)}.${ext}`);
    if (existsSync(p)) return `${slug}-on-${themeForFilename(theme)}.${ext}`;
  }
  return null;
}

async function fetchTheme(slug: string, domain: string, theme: 'light' | 'dark'): Promise<ThemeResult> {
  // Try wordmark first, then icon, then default
  const attempts: Array<{ type: 'logo' | 'icon'; path: string }> = [
    { type: 'logo', path: `type/logo/theme/${theme}` },
    { type: 'icon', path: `type/icon/theme/${theme}` },
  ];

  let lastErr = '';
  for (const attempt of attempts) {
    const r = await brandfetchGet(domain, attempt.path);
    if ('error' in r) {
      lastErr = r.error;
      continue;
    }
    if (FALLBACK_HASHES.has(r.hash)) {
      lastErr = `Brandfetch fallback (${r.hash})`;
      continue;
    }
    // Write it
    if (force) purgeSlugTheme(slug, theme);
    const outFile = `${slug}-on-${themeForFilename(theme)}.${r.ext}`;
    writeFileSync(join(CLIENTS_DIR, outFile), r.buf);
    return { status: 'saved', file: outFile, type: attempt.type, hash: r.hash };
  }

  return { status: 'missing', reason: lastErr || 'no variant available' };
}

async function processCustomer(c: Customer): Promise<FetchResult> {
  const domain = DOMAIN_OVERRIDES[c.slug] ?? extractDomain(c.website);

  // Skip if both themes already exist (unless --force)
  if (!force) {
    const existingLight = hasExisting(c.slug, 'light');
    const existingDark = hasExisting(c.slug, 'dark');
    if (existingLight && existingDark) {
      return {
        slug: c.slug,
        name: c.name,
        domain,
        light: { status: 'saved', file: existingLight, type: 'logo', hash: '' },
        dark: { status: 'saved', file: existingDark, type: 'logo', hash: '' },
      };
    }
  }

  const [light, dark] = await Promise.all([
    fetchTheme(c.slug, domain, 'light'),
    fetchTheme(c.slug, domain, 'dark'),
  ]);

  return { slug: c.slug, name: c.name, domain, light, dark };
}

async function runWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
      const r = results[idx] as any;
      const lightTag = r.light.status === 'saved' ? `✓${r.light.type === 'icon' ? ' (icon)' : ''}` : '✗';
      const darkTag = r.dark.status === 'saved' ? `✓${r.dark.type === 'icon' ? ' (icon)' : ''}` : '✗';
      console.log(`  ${r.slug.padEnd(24)} light=${lightTag.padEnd(9)} dark=${darkTag}`);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

const results = await runWithConcurrency(customers, 6, processCustomer);

const summary = {
  total: results.length,
  bothThemes: results.filter((r) => r.light.status === 'saved' && r.dark.status === 'saved').length,
  lightOnly: results.filter((r) => r.light.status === 'saved' && r.dark.status === 'missing').length,
  darkOnly: results.filter((r) => r.light.status === 'missing' && r.dark.status === 'saved').length,
  neither: results.filter((r) => r.light.status === 'missing' && r.dark.status === 'missing').length,
};

console.log('');
console.log('[fetch-logos] Summary:');
console.log(`  Both themes:  ${summary.bothThemes}`);
console.log(`  Light only:   ${summary.lightOnly}`);
console.log(`  Dark only:    ${summary.darkOnly}`);
console.log(`  Neither:      ${summary.neither}`);
console.log(`  Total:        ${summary.total}`);

// Write audit log
writeFileSync(
  join(CLIENTS_DIR, '.fetch-results.json'),
  JSON.stringify({ ranAt: new Date().toISOString(), summary, results }, null, 2),
);
