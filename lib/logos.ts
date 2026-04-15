import { existsSync, readFileSync, readdirSync } from 'fs';
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

export type VariantQuality = 'good' | 'icon' | 'flat' | 'tiny' | 'missing';
export type LogoStatus = 'all-good' | 'partial' | 'broken';

export type Logo = ManifestEntry & {
  onLight: string | null;
  onDark: string | null;
  status: LogoStatus;
  onLightQuality: VariantQuality;
  onDarkQuality: VariantQuality;
  pendingApproval: boolean;
};

type AuditFile = {
  audits: Array<{
    slug: string;
    status: LogoStatus;
    pendingApproval?: boolean;
    onLight: { quality: VariantQuality };
    onDark: { quality: VariantQuality };
  }>;
};

const EXTS = ['svg', 'png', 'webp', 'jpg', 'gif'] as const;

function loadAuditIndex(logosDir: string) {
  const auditPath = join(logosDir, 'audit.json');
  if (!existsSync(auditPath)) return new Map<string, AuditFile['audits'][number]>();
  const raw = JSON.parse(readFileSync(auditPath, 'utf-8')) as AuditFile;
  return new Map(raw.audits.map((a) => [a.slug, a]));
}

export function loadLogos(): Logo[] {
  const logosDir = join(process.cwd(), 'public', 'logos');
  const manifestPath = join(logosDir, 'manifest.json');
  const raw = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { customers: ManifestEntry[] };
  const files = new Set(readdirSync(logosDir));
  const auditIndex = loadAuditIndex(logosDir);

  function findVariant(slug: string, variant: 'on-light' | 'on-dark'): string | null {
    for (const ext of EXTS) {
      const name = `${slug}-${variant}.${ext}`;
      if (files.has(name)) return `/logos/${name}`;
    }
    return null;
  }

  return raw.customers
    .map((c) => {
      const audit = auditIndex.get(c.slug);
      return {
        ...c,
        onLight: findVariant(c.slug, 'on-light'),
        onDark: findVariant(c.slug, 'on-dark'),
        status: audit?.status ?? 'partial',
        onLightQuality: audit?.onLight.quality ?? 'missing',
        onDarkQuality: audit?.onDark.quality ?? 'missing',
        pendingApproval: Boolean(audit?.pendingApproval),
      };
    })
    .filter((l) => l.onLight || l.onDark)
    .sort((a, b) => a.name.localeCompare(b.name));
}
