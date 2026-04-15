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

/**
 * Normalized Salesforce Account Type. The raw Salesforce picklist has many
 * values ("Channel Partner", "Reseller", "Integrator", etc.) that we fold
 * into these five buckets for UI filtering.
 */
export type AccountType = 'customer' | 'partner' | 'prospect' | 'self' | 'other';

export type SalesforceInfo = {
  sfId: string | null;
  sfName: string | null;
  type: AccountType;
  rawType: string | null;
  duns: string | null;
  partner: string | null;
  mindsetPartner: boolean;
};

export type Logo = ManifestEntry & {
  onLight: string | null;
  onDark: string | null;
  status: LogoStatus;
  onLightQuality: VariantQuality;
  onDarkQuality: VariantQuality;
  pendingApproval: boolean;
  salesforce: SalesforceInfo;
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

type SalesforceFile = {
  lastSync: string;
  accounts: Record<
    string,
    {
      sfName: string | null;
      type: string | null;
      duns: string | null;
      partner: string | null;
      mindsetPartner: boolean;
    }
  >;
  manualOverrides?: Record<
    string,
    {
      sfName: string | null;
      type: string | null;
      duns: string | null;
      partner: string | null;
      mindsetPartner: boolean;
    }
  >;
};

const EXTS = ['svg', 'png', 'webp', 'jpg', 'gif'] as const;

function normalizeAccountType(raw: string | null | undefined): AccountType {
  if (!raw) return 'other';
  const t = raw.toLowerCase();
  if (t === 'customer') return 'customer';
  if (t === 'prospect') return 'prospect';
  if (t === 'self') return 'self';
  if (
    t === 'partner' ||
    t === 'channel partner' ||
    t === 'reseller' ||
    t === 'integrator'
  ) {
    return 'partner';
  }
  return 'other';
}

function loadAuditIndex(logosDir: string) {
  const auditPath = join(logosDir, 'audit.json');
  if (!existsSync(auditPath)) return new Map<string, AuditFile['audits'][number]>();
  const raw = JSON.parse(readFileSync(auditPath, 'utf-8')) as AuditFile;
  return new Map(raw.audits.map((a) => [a.slug, a]));
}

function loadSalesforceFile(logosDir: string): SalesforceFile | null {
  const path = join(logosDir, 'salesforce.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8')) as SalesforceFile;
}

export function loadLogos(): Logo[] {
  const logosDir = join(process.cwd(), 'public', 'logos');
  const manifestPath = join(logosDir, 'manifest.json');
  const raw = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { customers: ManifestEntry[] };
  const files = new Set(readdirSync(logosDir));
  const auditIndex = loadAuditIndex(logosDir);
  const sfFile = loadSalesforceFile(logosDir);

  function findVariant(slug: string, variant: 'on-light' | 'on-dark'): string | null {
    for (const ext of EXTS) {
      const name = `${slug}-${variant}.${ext}`;
      if (files.has(name)) return `/logos/${name}`;
    }
    return null;
  }

  function resolveSalesforce(c: ManifestEntry): SalesforceInfo {
    const override = sfFile?.manualOverrides?.[c.slug];
    const byId = c.sfId ? sfFile?.accounts?.[c.sfId] : undefined;
    const src = override ?? byId;
    return {
      sfId: c.sfId ?? null,
      sfName: src?.sfName ?? c.sfName ?? null,
      type: normalizeAccountType(src?.type ?? null),
      rawType: src?.type ?? null,
      duns: src?.duns ?? null,
      partner: src?.partner ?? null,
      mindsetPartner: Boolean(src?.mindsetPartner),
    };
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
        salesforce: resolveSalesforce(c),
      };
    })
    .filter((l) => l.onLight || l.onDark)
    .sort((a, b) => a.name.localeCompare(b.name));
}
