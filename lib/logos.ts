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
  /** SAP Business AI Fund deal: 'won' (Closed Won) or 'open'. Hand-tagged from opp names. */
  aiFund?: 'won' | 'open';
  /** true when the SVG was traced by us from the best raster, not supplied by the brand */
  traced?: boolean;
};

export type VariantQuality = 'good' | 'icon' | 'flat' | 'tiny' | 'missing';
export type LogoStatus = 'all-good' | 'partial' | 'broken';

/**
 * Normalized Salesforce Account Type. The raw Salesforce picklist has many
 * values ("Channel Partner", "Reseller", "Integrator", etc.) that we fold
 * into these five buckets for UI filtering.
 */
export type AccountType = 'customer' | 'partner' | 'prospect' | 'self' | 'other';

/**
 * Opportunity-based relationship, the ground truth for "is this a client".
 * Unlike AccountType (a hand-maintained SF picklist), this is derived from
 * actual opportunities on the account:
 *   customer — at least one Closed Won opportunity (and not a partner)
 *   partner  — partner-typed account, regardless of won opps
 *   pipeline — no win yet, but at least one open opportunity
 *   prospect — in the library, but no opportunities at all
 *   other    — no Salesforce link (e.g. the Mindset and SAP marks)
 * Anything shown as proof of delivered work (the website logo wall) must
 * require relationship === 'customer'.
 */
export type Relationship = 'customer' | 'partner' | 'pipeline' | 'prospect' | 'other';

export type SalesforceInfo = {
  sfId: string | null;
  sfName: string | null;
  type: AccountType;
  rawType: string | null;
  duns: string | null;
  partner: string | null;
  mindsetPartner: boolean;
  wonCount: number;
  openCount: number;
  relationship: Relationship;
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

type SalesforceAccountRow = {
  sfName: string | null;
  type: string | null;
  duns: string | null;
  partner: string | null;
  mindsetPartner: boolean;
  won?: number;
  open?: number;
};

type SalesforceFile = {
  lastSync: string;
  accounts: Record<string, SalesforceAccountRow>;
  manualOverrides?: Record<string, SalesforceAccountRow>;
};

const EXTS = ['svg', 'png', 'webp', 'jpg', 'gif'] as const;

function normalizeAccountType(raw: string | null | undefined): AccountType {
  if (!raw) return 'other';
  const t = raw.toLowerCase();
  // "Customer", "Customer (Subsidiary)", "Customer (Acquired)", "Customer & Partner", …
  if (t.startsWith('customer')) return 'customer';
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

// The library is read-only at runtime, so parse it once per server instance.
// Dev re-reads every call so edits to manifest.json show up without a restart.
let cached: Logo[] | null = null;

export function loadLogos(): Logo[] {
  if (cached && process.env.NODE_ENV === 'production') return cached;
  cached = readLogos();
  return cached;
}

export function findLogo(slugOrName: string): Logo | undefined {
  const logos = loadLogos();
  const q = slugOrName.trim().toLowerCase();
  return (
    logos.find((l) => l.slug === q) ??
    logos.find((l) => l.name.toLowerCase() === q || l.salesforce.sfName?.toLowerCase() === q) ??
    logos.find((l) => l.slug.replace(/-/g, ' ') === q.replace(/-/g, ' ')) ??
    logos.find((l) => l.name.toLowerCase().startsWith(q))
  );
}

function readLogos(): Logo[] {
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
    const type = normalizeAccountType(src?.type ?? null);
    const wonCount = src?.won ?? 0;
    const openCount = src?.open ?? 0;
    let relationship: Relationship;
    if (!c.sfId) {
      relationship = 'other';
    } else if (type === 'partner' || Boolean(src?.mindsetPartner)) {
      relationship = 'partner';
    } else if (wonCount > 0) {
      relationship = 'customer';
    } else if (openCount > 0) {
      relationship = 'pipeline';
    } else {
      relationship = 'prospect';
    }
    return {
      sfId: c.sfId ?? null,
      sfName: src?.sfName ?? c.sfName ?? null,
      type,
      rawType: src?.type ?? null,
      duns: src?.duns ?? null,
      partner: src?.partner ?? null,
      mindsetPartner: Boolean(src?.mindsetPartner),
      wonCount,
      openCount,
      relationship,
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
