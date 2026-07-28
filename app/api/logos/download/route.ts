import { readFileSync } from 'fs';
import { join, extname } from 'path';
import sharp from 'sharp';
import { zipSync, type Zippable } from 'fflate';
import { loadLogos } from '@/lib/logos';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_WIDTH = 2000;
const DEFAULT_WIDTH = 1200;

// GET /api/logos/download
//   ?type=customer|partner|prospect|self|other   filter by normalized SF type
//   ?vertical=Healthcare                         filter by vertical
//   ?q=cargill                                   filter by name/slug/industry
//   ?format=png|source                           png = transcoded at ?w= (default 1200),
//                                                source = original files (svg/webp/png as stored)
//   ?w=1200                                      png width
// Returns a ZIP with files named "{Company Name} (on-light).png" etc.
// SVG sources are always included alongside the PNG when format=png.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const vertical = url.searchParams.get('vertical');
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  const format = url.searchParams.get('format') === 'source' ? 'source' : 'png';
  const requested = Number(url.searchParams.get('w'));
  const width = Number.isFinite(requested) && requested > 0
    ? Math.min(Math.floor(requested), MAX_WIDTH)
    : DEFAULT_WIDTH;

  const logos = loadLogos().filter((l) => {
    if (type && l.salesforce.type !== type) return false;
    if (vertical && !l.verticals.includes(vertical)) return false;
    if (q) {
      const hit =
        l.name.toLowerCase().includes(q) ||
        l.slug.toLowerCase().includes(q) ||
        l.industry.toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });

  if (logos.length === 0) return new Response('no logos match', { status: 404 });

  const files: Zippable = {};

  const safeName = (name: string) => name.replace(/[/\\:*?"<>|]/g, '').trim();

  for (const logo of logos) {
    for (const [variant, src] of [
      ['on-light', logo.onLight],
      ['on-dark', logo.onDark],
    ] as const) {
      if (!src) continue;
      const absPath = join(process.cwd(), 'public', src);
      let input: Buffer;
      try {
        input = readFileSync(absPath);
      } catch {
        continue;
      }
      const srcExt = extname(src).toLowerCase();
      const base = `${safeName(logo.name)} (${variant})`;

      if (format === 'source') {
        files[`${base}${srcExt}`] = [new Uint8Array(input), { level: 0 }];
        continue;
      }

      // format=png: transcode everything, and keep the vector alongside when we have one
      if (srcExt === '.svg') {
        files[`${base}.svg`] = [new Uint8Array(input), { level: 6 }];
      }
      try {
        const density = srcExt === '.svg' ? Math.max(72, Math.ceil((width / 300) * 72)) : 72;
        const png = await sharp(input, { density })
          .resize({ width, fit: 'inside', withoutEnlargement: srcExt !== '.svg' })
          .png({ compressionLevel: 9 })
          .toBuffer();
        files[`${base}.png`] = [new Uint8Array(png), { level: 0 }];
      } catch {
        files[`${base}${srcExt}`] = [new Uint8Array(input), { level: 0 }];
      }
    }
  }

  const zip = zipSync(files);
  const label = type ?? 'all';
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="mindset-logos-${label}-${stamp}.zip"`,
      'Content-Length': String(zip.length),
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
