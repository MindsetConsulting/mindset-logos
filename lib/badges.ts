import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Mindset's own SAP partner badges (Gold Partner, BTP competency, AppHaus).
// Kept apart from the customer manifest because they are credentials, not accounts.

export type Badge = {
  slug: string;
  name: string;
  issuer: string;
  category: 'partner-level' | 'competency' | 'program';
  description: string;
  since: string;
  status: 'current' | 'superseded';
  /** slug of the badge that replaced this one */
  supersededBy?: string;
  /** Badge art carries its own background. Same file works on light and dark. */
  selfContained: boolean;
  source: string;
  notes: string;
  /** folder of print/vector masters, when SAP supplied them */
  masters?: string;
  masterFiles?: string[];
  onLight: string | null;
  onDark: string | null;
};

export type BadgeGap = { name: string; notes: string };
export type BadgeRequest = { name: string; requested: string; via: string };

const EXTS = ['svg', 'png', 'webp', 'jpg'] as const;

let cached: { badges: Badge[]; notFound: BadgeGap[]; requested: BadgeRequest[] } | null = null;

export function loadBadges(): { badges: Badge[]; notFound: BadgeGap[]; requested: BadgeRequest[] } {
  if (cached && process.env.NODE_ENV === 'production') return cached;
  const dir = join(process.cwd(), 'public', 'badges');
  const path = join(dir, 'manifest.json');
  if (!existsSync(path)) return { badges: [], notFound: [], requested: [] };
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as {
    badges: Omit<Badge, 'onLight' | 'onDark'>[];
    notFound?: BadgeGap[];
    requested?: BadgeRequest[];
  };
  const files = new Set(readdirSync(dir));
  const find = (slug: string, v: 'on-light' | 'on-dark') => {
    for (const ext of EXTS) if (files.has(`${slug}-${v}.${ext}`)) return `/badges/${slug}-${v}.${ext}`;
    return null;
  };
  cached = {
    badges: raw.badges.map((b) => {
      const mdir = b.masters ? join(process.cwd(), 'public', b.masters) : null;
      const masterFiles = mdir && existsSync(mdir) ? readdirSync(mdir).filter((f) => !f.startsWith('.')).sort() : undefined;
      return { ...b, masterFiles, onLight: find(b.slug, 'on-light'), onDark: find(b.slug, 'on-dark') };
    }),
    notFound: raw.notFound ?? [],
    requested: raw.requested ?? [],
  };
  return cached;
}

export function findBadge(q: string): Badge | undefined {
  const { badges } = loadBadges();
  const s = q.trim().toLowerCase();
  return (
    badges.find((b) => b.slug === s) ??
    badges.find((b) => b.name.toLowerCase() === s) ??
    badges.filter((b) => b.status === 'current').find((b) => `${b.slug} ${b.name}`.toLowerCase().includes(s)) ??
    badges.find((b) => `${b.slug} ${b.name}`.toLowerCase().includes(s))
  );
}
