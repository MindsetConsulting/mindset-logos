import type { Logo } from './logos';
import type { Badge } from './badges';
import { isVector } from './transcode';

export const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://mindset-logos.vercel.app');

type Variant = 'on-light' | 'on-dark';

/** Ready-to-use URLs for one variant in every format the transcoder supports. */
function formatsFor(kind: 'logos' | 'badges', slug: string, variant: Variant, src: string | null) {
  if (!src) return null;
  const base = `${SITE_ORIGIN}/api/${kind}/${slug}/${variant}`;
  return {
    original: SITE_ORIGIN + src,
    vector: isVector(src),
    svg: isVector(src) ? `${base}.svg` : null,
    png: `${base}.png?w=1200`,
    webp: `${base}.webp?w=1200`,
    jpg: `${base}.jpg?w=1200`,
  };
}

export function logoJson(l: Logo, opts: { formats?: boolean } = {}) {
  return {
    slug: l.slug,
    name: l.name,
    website: l.website,
    industry: l.industry,
    verticals: l.verticals,
    hq: l.hq?.display ?? null,
    relationship: l.salesforce.relationship,
    aiFund: l.aiFund ?? null,
    partnerDeal: l.partnerDeal ?? null,
    vector: isVector(l.onLight) && isVector(l.onDark) ? (l.traced ? 'traced' : 'official') : false,
    onLight: l.onLight ? SITE_ORIGIN + l.onLight : null,
    onDark: l.onDark ? SITE_ORIGIN + l.onDark : null,
    ...(opts.formats
      ? {
          formats: {
            onLight: formatsFor('logos', l.slug, 'on-light', l.onLight),
            onDark: formatsFor('logos', l.slug, 'on-dark', l.onDark),
          },
          salesforce: l.salesforce,
        }
      : {}),
  };
}

export function badgeJson(b: Badge) {
  return {
    slug: b.slug,
    name: b.name,
    issuer: b.issuer,
    category: b.category,
    description: b.description,
    since: b.since,
    status: b.status,
    supersededBy: b.supersededBy ?? null,
    selfContained: b.selfContained,
    notes: b.notes,
    masters: b.masters && b.masterFiles?.length
      ? { note: 'Print and vector originals from SAP: AI, EPS, and SVG in RGB, CMYK, Pantone, and black.', files: b.masterFiles.map((f) => SITE_ORIGIN + b.masters + f) }
      : null,
    formats: {
      onLight: formatsFor('badges', b.slug, 'on-light', b.onLight),
      onDark: formatsFor('badges', b.slug, 'on-dark', b.onDark),
    },
  };
}

export const URL_HELP =
  'vector is "official" (the brand\'s own SVG), "traced" (redrawn by Mindset from the best raster, fine for slides and web, check with the brand before large print), or false. ' +
  'Transcoder URLs take ?w= (width in px, max 2400) and ?bg= (hex like FFFFFF, flattens the background; default keeps transparency, JPG defaults to cream for on-light and navy for on-dark). SVG only exists when the master is vector.';
