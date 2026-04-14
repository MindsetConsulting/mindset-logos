import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export type HQ = {
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  display: string | null;
};

export type ManifestEntry = {
  slug: string;
  name: string;
  website: string;
  industry: string;
  verticals: string[];
  sfId?: string;
  sfName?: string;
  hq?: HQ;
};

export type Logo = ManifestEntry & {
  onLight: string | null;
  onDark: string | null;
};

const EXTS = ['svg', 'png', 'webp', 'jpg', 'gif'] as const;

export function loadLogos(): Logo[] {
  const logosDir = join(process.cwd(), 'public', 'logos');
  const manifestPath = join(logosDir, 'manifest.json');
  const raw = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { customers: ManifestEntry[] };
  const files = new Set(readdirSync(logosDir));

  function findVariant(slug: string, variant: 'on-light' | 'on-dark'): string | null {
    for (const ext of EXTS) {
      const name = `${slug}-${variant}.${ext}`;
      if (files.has(name)) return `/logos/${name}`;
    }
    return null;
  }

  return raw.customers
    .map((c) => ({
      ...c,
      onLight: findVariant(c.slug, 'on-light'),
      onDark: findVariant(c.slug, 'on-dark'),
    }))
    .filter((l) => l.onLight || l.onDark)
    .sort((a, b) => a.name.localeCompare(b.name));
}
