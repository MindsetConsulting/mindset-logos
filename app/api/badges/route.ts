import { NextResponse } from 'next/server';
import { loadBadges } from '@/lib/badges';
import { badgeJson } from '@/lib/links';

export const dynamic = 'force-static';

export async function GET() {
  const { badges, notFound, requested } = loadBadges();
  return NextResponse.json({ total: badges.length, badges: badges.map(badgeJson), requested, notFound });
}
