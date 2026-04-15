import { readFileSync } from 'fs';
import { join, extname } from 'path';
import sharp from 'sharp';
import { loadLogos } from '@/lib/logos';

export const runtime = 'nodejs';

const VARIANTS = new Set(['on-light', 'on-dark']);
const MAX_WIDTH = 2000;
const DEFAULT_WIDTH = 800;

type OutFormat = 'png' | 'webp' | 'jpeg' | 'svg';

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

function parseVariant(raw: string): { variant: string; format: OutFormat } {
  const match = raw.match(/^(.*?)(?:\.([a-z]+))?$/i);
  const stem = match?.[1] ?? raw;
  const extHint = match?.[2]?.toLowerCase();
  const format = (extHint && FORMAT_ALIASES[extHint]) || 'png';
  return { variant: stem, format };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string; variant: string }> },
) {
  const { slug, variant: rawVariant } = await params;
  const { variant, format } = parseVariant(rawVariant);
  if (!VARIANTS.has(variant)) {
    return new Response('invalid variant', { status: 400 });
  }

  const logo = loadLogos().find((l) => l.slug === slug);
  if (!logo) return new Response('logo not found', { status: 404 });

  const src = variant === 'on-light' ? logo.onLight : logo.onDark;
  if (!src) return new Response('variant not available', { status: 404 });

  const absPath = join(process.cwd(), 'public', src);
  const input = readFileSync(absPath);
  const srcExt = extname(src).toLowerCase();

  if (format === 'svg') {
    if (srcExt !== '.svg') {
      return new Response(
        `SVG not available for ${slug}/${variant} (source is ${srcExt || 'raster'}). Try .png, .webp, or .jpg.`,
        { status: 415 },
      );
    }
    return new Response(new Uint8Array(input), {
      headers: {
        'Content-Type': CONTENT_TYPE.svg,
        'Content-Length': String(input.length),
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    });
  }

  const url = new URL(req.url);
  const requested = Number(url.searchParams.get('w'));
  const width = Number.isFinite(requested) && requested > 0
    ? Math.min(Math.floor(requested), MAX_WIDTH)
    : DEFAULT_WIDTH;

  const density = srcExt === '.svg' ? Math.max(72, Math.ceil((width / 300) * 72)) : 72;

  let pipeline = sharp(input, { density }).resize({
    width,
    fit: 'inside',
    withoutEnlargement: srcExt !== '.svg',
  });

  if (format === 'jpeg') {
    const bgParam = url.searchParams.get('bg');
    const bg = bgParam
      ? `#${bgParam.replace(/^#/, '')}`
      : variant === 'on-dark'
      ? '#0A1628'
      : '#FAF7F2';
    pipeline = pipeline.flatten({ background: bg }).jpeg({ quality: 90, mozjpeg: true });
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality: 92 });
  } else {
    pipeline = pipeline.png({ compressionLevel: 9 });
  }

  const output = await pipeline.toBuffer();

  return new Response(new Uint8Array(output), {
    headers: {
      'Content-Type': CONTENT_TYPE[format],
      'Content-Length': String(output.length),
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
    },
  });
}
