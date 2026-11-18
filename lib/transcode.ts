import { readFileSync } from 'fs';
import { join, extname } from 'path';
import sharp from 'sharp';

// One transcoder for every mark in the library (customer logos and SAP badges).
// The source file is the master. SVG masters render crisp at any width, which is
// why we keep collecting vectors.

export type OutFormat = 'png' | 'webp' | 'jpeg' | 'svg';

const FORMAT_ALIASES: Record<string, OutFormat> = {
  png: 'png',
  webp: 'webp',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  svg: 'svg',
};

const CONTENT_TYPE: Record<OutFormat, string> = {
  png: 'image/png',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
};

export const MAX_WIDTH = 2400;
export const DEFAULT_WIDTH = 800;
export const CREAM = '#FAF7F2';
export const NAVY = '#0A1628';

// Browsers keep a day, the CDN keeps a year. A new deploy gets a fresh CDN cache,
// so a fixed logo shows up without anyone clearing anything.
const CACHE = 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800';

export function parseVariant(raw: string): { variant: string; format: OutFormat } {
  const match = raw.match(/^(.*?)(?:\.([a-z]+))?$/i);
  const stem = match?.[1] ?? raw;
  const extHint = match?.[2]?.toLowerCase();
  return { variant: stem, format: (extHint && FORMAT_ALIASES[extHint]) || 'png' };
}

export function isVector(src: string | null | undefined): boolean {
  return Boolean(src && extname(src).toLowerCase() === '.svg');
}

type Options = {
  /** public-relative path, e.g. /logos/3m-on-light.svg */
  src: string;
  format: OutFormat;
  width?: number | null;
  /** hex background. Forces a flatten for png/webp too ("transparent" or empty keeps alpha). */
  bg?: string | null;
  /** default flatten color for JPEG when bg isn't given */
  jpegDefaultBg: string;
};

function normalizeBg(bg: string | null | undefined): string | null {
  if (!bg) return null;
  const v = bg.trim().replace(/^#/, '');
  if (!v || v === 'transparent' || v === 'none') return null;
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v)) return null;
  return `#${v}`;
}

export async function transcode({ src, format, width, bg, jpegDefaultBg }: Options): Promise<Response> {
  const absPath = join(process.cwd(), 'public', src.replace(/^\//, ''));
  const input = readFileSync(absPath);
  const vector = isVector(src);

  if (format === 'svg') {
    if (!vector) {
      return new Response(
        `No vector master for ${src} yet. Ask for .png, .webp, or .jpg instead.`,
        { status: 415, headers: { 'Content-Type': 'text/plain' } },
      );
    }
    return new Response(new Uint8Array(input), {
      headers: { 'Content-Type': CONTENT_TYPE.svg, 'Cache-Control': CACHE },
    });
  }

  const w = width && Number.isFinite(width) && width > 0 ? Math.min(Math.floor(width), MAX_WIDTH) : DEFAULT_WIDTH;
  // Rasterize SVGs at the density that lands near the target width instead of
  // rendering huge and scaling down.
  const density = vector ? Math.min(2400, Math.max(72, Math.ceil((w / 300) * 72) * 2)) : 72;

  let pipeline = sharp(input, { density }).resize({
    width: w,
    fit: 'inside',
    withoutEnlargement: !vector,
  });

  const flattenTo = normalizeBg(bg) ?? (format === 'jpeg' ? jpegDefaultBg : null);
  if (flattenTo) pipeline = pipeline.flatten({ background: flattenTo });

  if (format === 'jpeg') pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true });
  else if (format === 'webp') pipeline = pipeline.webp({ quality: 92, alphaQuality: 100 });
  else pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });

  const output = await pipeline.toBuffer();
  return new Response(new Uint8Array(output), {
    headers: {
      'Content-Type': CONTENT_TYPE[format],
      'Content-Length': String(output.length),
      'Cache-Control': CACHE,
      'X-Source-Format': vector ? 'svg' : extname(src).slice(1),
    },
  });
}
