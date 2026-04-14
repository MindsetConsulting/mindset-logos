// Customer logo library. Reads the manifest and resolves each slug to its
// actual file extension (SVG/PNG/WebP/JPG) based on what exists on disk.
// Slides import CUSTOMERS to get the full list with file paths.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const CLIENTS_DIR = join(process.cwd(), "public", "logos");
const MANIFEST_PATH = join(CLIENTS_DIR, 'manifest.json');

type ManifestEntry = {
  slug: string;
  name: string;
  website: string;
  industry: string;
  verticals: string[];
};

type ResolvedCustomer = ManifestEntry & {
  file: string; // default = onDark variant (white logo for dark backgrounds)
  onLight: string | null; // dark logo for light backgrounds
  onDark: string | null; // white logo for dark backgrounds
};

const EXTS = ['svg', 'png', 'webp', 'jpg', 'gif'] as const;

function findVariant(slug: string, variant: 'on-light' | 'on-dark'): string | null {
  for (const ext of EXTS) {
    if (existsSync(join(CLIENTS_DIR, `${slug}-${variant}.${ext}`))) {
      return `${slug}-${variant}.${ext}`;
    }
  }
  return null;
}

const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as { customers: ManifestEntry[] };

export const CUSTOMERS: ResolvedCustomer[] = raw.customers
  .map((c) => {
    const onLight = findVariant(c.slug, 'on-light');
    const onDark = findVariant(c.slug, 'on-dark');
    const file = onDark ?? onLight;
    if (!file) return null;
    return { ...c, file, onLight, onDark };
  })
  .filter((c): c is ResolvedCustomer => c !== null);

// Group customers by their first (primary) vertical — for the clusters variant
export function groupByVertical(): Array<{ vertical: string; customers: ResolvedCustomer[] }> {
  const groups = new Map<string, ResolvedCustomer[]>();
  for (const c of CUSTOMERS) {
    const v = c.verticals[0] ?? c.industry;
    if (!groups.has(v)) groups.set(v, []);
    groups.get(v)!.push(c);
  }
  return Array.from(groups.entries())
    .map(([vertical, customers]) => ({ vertical, customers }))
    .sort((a, b) => b.customers.length - a.customers.length);
}
