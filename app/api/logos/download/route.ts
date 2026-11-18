import { readFileSync } from 'fs';
import { join, extname } from 'path';
import sharp from 'sharp';
import { zipSync, type Zippable } from 'fflate';
import { loadLogos } from '@/lib/logos';
import { loadBadges } from '@/lib/badges';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_WIDTH = 2400;
const DEFAULT_WIDTH = 1200;

// GET /api/logos/download
//   ?relationship=customer|partner|pipeline|prospect   Closed-Won truth (use this, not type)
//   ?aiFund=1 | won | open                             SAP Business AI Fund accounts
//   ?type=customer|partner|prospect|self|other         raw SF Account.Type bucket (legacy)
//   ?vertical=Healthcare                               filter by vertical
//   ?q=cargill                                         name/slug/industry contains
//   ?slugs=3m,ecolab,cargill                           exact set
//   ?set=badges                                        Mindset's SAP partner badges instead of logos
//   ?format=png|source                                 png = rendered at ?w= (vector kept alongside),
//                                                      source = master files as stored
//   ?w=1200                                            png width
export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = (k: string) => url.searchParams.get(k)?.trim() || null;
  const format = p('format') === 'source' ? 'source' : 'png';
  const requested = Number(p('w'));
  const width = Number.isFinite(requested) && requested > 0 ? Math.min(Math.floor(requested), MAX_WIDTH) : DEFAULT_WIDTH;

  type Item = { name: string; onLight: string | null; onDark: string | null };
  let items: Item[];
  let label: string;

  if (p('set') === 'badges') {
    items = loadBadges().badges.filter((b) => b.status === 'current');
    label = 'sap-badges';
  } else {
    const relationship = p('relationship');
    const aiFund = p('aiFund');
    const type = p('type');
    const vertical = p('vertical');
    const q = p('q')?.toLowerCase();
    const slugs = p('slugs') ? new Set(p('slugs')!.split(',').map((s) => s.trim())) : null;
    items = loadLogos().filter((l) => {
      if (slugs && !slugs.has(l.slug)) return false;
      if (relationship && l.salesforce.relationship !== relationship) return false;
      if (aiFund && !(aiFund === '1' || aiFund === 'true' ? l.aiFund : l.aiFund === aiFund)) return false;
      if (type && l.salesforce.type !== type) return false;
      if (vertical && !l.verticals.includes(vertical)) return false;
      if (q && !`${l.name} ${l.slug} ${l.industry}`.toLowerCase().includes(q)) return false;
      return true;
    });
    label = [relationship, aiFund && 'ai-fund', type, vertical, q].filter(Boolean).join('-') || 'all';
  }

  const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').trim();
  const files: Zippable = {};

  await Promise.all(
    items.flatMap((item) =>
      (['on-light', 'on-dark'] as const).map(async (variant) => {
        const src = variant === 'on-light' ? item.onLight : item.onDark;
        if (!src) return;
        let input: Buffer;
        try {
          input = readFileSync(join(process.cwd(), 'public', src));
        } catch {
          return;
        }
        const srcExt = extname(src).toLowerCase();
        const base = `${safeName(item.name)} (${variant})`;
        if (format === 'source') {
          files[`${base}${srcExt}`] = [new Uint8Array(input), { level: 0 }];
          return;
        }
        if (srcExt === '.svg') files[`${base}.svg`] = [new Uint8Array(input), { level: 6 }];
        try {
          const density = srcExt === '.svg' ? Math.min(2400, Math.max(72, Math.ceil((width / 300) * 72) * 2)) : 72;
          const png = await sharp(input, { density })
            .resize({ width, fit: 'inside', withoutEnlargement: srcExt !== '.svg' })
            .png({ compressionLevel: 9 })
            .toBuffer();
          files[`${base}.png`] = [new Uint8Array(png), { level: 0 }];
        } catch {
          files[`${base}${srcExt}`] = [new Uint8Array(input), { level: 0 }];
        }
      }),
    ),
  );

  const zip = zipSync(files);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="mindset-${label}-${stamp}.zip"`,
      'Content-Length': String(zip.length),
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
