import { loadBadges } from '@/lib/badges';
import { parseVariant, transcode, CREAM, NAVY } from '@/lib/transcode';

export const runtime = 'nodejs';

// GET /api/badges/{slug}/{on-light|on-dark}.{png|webp|jpg|svg}?w=1200&bg=FFFFFF
export async function GET(req: Request, { params }: { params: Promise<{ slug: string; variant: string }> }) {
  const { slug, variant: raw } = await params;
  const { variant, format } = parseVariant(raw);
  if (variant !== 'on-light' && variant !== 'on-dark') return new Response('variant must be on-light or on-dark', { status: 400 });

  const badge = loadBadges().badges.find((b) => b.slug === slug);
  if (!badge) return new Response('badge not found', { status: 404 });
  const src = variant === 'on-light' ? badge.onLight : badge.onDark;
  if (!src) return new Response('variant not available', { status: 404 });

  const url = new URL(req.url);
  return transcode({
    src,
    format,
    width: Number(url.searchParams.get('w')) || null,
    bg: url.searchParams.get('bg'),
    jpegDefaultBg: variant === 'on-dark' ? NAVY : CREAM,
  });
}
