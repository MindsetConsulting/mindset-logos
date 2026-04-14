import { NextResponse } from 'next/server';
import { loadLogos } from '@/lib/logos';

export const dynamic = 'force-static';

export async function GET() {
  const logos = loadLogos();
  return NextResponse.json({
    total: logos.length,
    logos: logos.map((l) => ({
      slug: l.slug,
      name: l.name,
      website: l.website,
      industry: l.industry,
      verticals: l.verticals,
      onLight: l.onLight,
      onDark: l.onDark,
    })),
  });
}
