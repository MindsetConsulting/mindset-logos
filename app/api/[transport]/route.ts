import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { join, extname } from 'path';
import { loadLogos, type Logo } from '@/lib/logos';

export const maxDuration = 60;

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
};

function readLogoAsBase64(
  relPath: string | null,
): { data: string; mimeType: string } | null {
  if (!relPath) return null;
  try {
    const absPath = join(process.cwd(), 'public', relPath.replace(/^\//, ''));
    const ext = extname(relPath).toLowerCase();
    const mimeType = MIME_BY_EXT[ext] ?? 'application/octet-stream';
    const data = readFileSync(absPath).toString('base64');
    return { data, mimeType };
  } catch {
    return null;
  }
}

const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://mindset-logos.vercel.app');

function absolutize(logo: Logo) {
  return {
    slug: logo.slug,
    name: logo.name,
    website: logo.website,
    industry: logo.industry,
    verticals: logo.verticals,
    hq: logo.hq ?? null,
    sfId: logo.sfId ?? null,
    onLight: logo.onLight ? SITE_ORIGIN + logo.onLight : null,
    onDark: logo.onDark ? SITE_ORIGIN + logo.onDark : null,
  };
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'list_logos',
      {
        title: 'List logos',
        description:
          'List every Mindset Consulting customer logo. Returns slug, name, website, industry, verticals, HQ, and absolute URLs for on-light and on-dark variants. Optional vertical filter.',
        inputSchema: {
          vertical: z
            .string()
            .optional()
            .describe('Optional vertical/industry filter, e.g. "Healthcare".'),
        },
      },
      async ({ vertical }) => {
        const logos = loadLogos();
        const filtered = vertical
          ? logos.filter((l) => l.verticals.includes(vertical) || l.industry === vertical)
          : logos;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { total: filtered.length, logos: filtered.map(absolutize) },
                null,
                2,
              ),
            },
          ],
        };
      },
    );

    server.registerTool(
      'search_logos',
      {
        title: 'Search logos',
        description:
          'Fuzzy search the Mindset customer logo library by free-text query. Matches slug, name, industry, verticals, and HQ city/state.',
        inputSchema: {
          query: z.string().describe('Search query'),
          limit: z.number().int().min(1).max(100).optional().describe('Max results (default 20)'),
        },
      },
      async ({ query, limit }) => {
        const logos = loadLogos();
        const q = query.toLowerCase();
        const scored = logos
          .map((l) => {
            let score = 0;
            if (l.slug.includes(q)) score += 10;
            if (l.name.toLowerCase().includes(q)) score += 8;
            if (l.industry.toLowerCase().includes(q)) score += 4;
            if (l.verticals.some((v) => v.toLowerCase().includes(q))) score += 4;
            if (l.hq?.city?.toLowerCase().includes(q)) score += 2;
            if (l.hq?.state?.toLowerCase().includes(q)) score += 2;
            return { logo: l, score };
          })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit ?? 20)
          .map((x) => absolutize(x.logo));
        return {
          content: [
            { type: 'text', text: JSON.stringify({ total: scored.length, logos: scored }, null, 2) },
          ],
        };
      },
    );

    server.registerTool(
      'get_logo',
      {
        title: 'Get logo',
        description:
          'Get one customer logo by slug. Returns name, website, industry, verticals, HQ, and absolute URLs for on-light and on-dark variants.',
        inputSchema: {
          slug: z.string().describe('Customer slug, e.g. "3m", "home-depot", "bcbs-mn"'),
        },
      },
      async ({ slug }) => {
        const logo = loadLogos().find((l) => l.slug === slug);
        if (!logo) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: `No logo found for slug "${slug}"` }) }],
            isError: true,
          };
        }
        const content: Array<
          | { type: 'text'; text: string }
          | { type: 'image'; data: string; mimeType: string }
        > = [{ type: 'text', text: JSON.stringify(absolutize(logo), null, 2) }];
        const light = readLogoAsBase64(logo.onLight);
        const dark = readLogoAsBase64(logo.onDark);
        if (light && light.mimeType !== 'image/svg+xml')
          content.push({ type: 'image', data: light.data, mimeType: light.mimeType });
        if (dark && dark.mimeType !== 'image/svg+xml')
          content.push({ type: 'image', data: dark.data, mimeType: dark.mimeType });
        return { content };
      },
    );
  },
  {
    serverInfo: {
      name: 'mindset-logos',
      version: '0.1.0',
    },
  },
  {
    basePath: '/api',
    maxDuration: 60,
    verboseLogs: false,
  },
);

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, mcp-session-id, mcp-protocol-version',
  'Access-Control-Expose-Headers': 'mcp-session-id',
  'Access-Control-Max-Age': '86400',
};

function withCors(inner: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    const res = await inner(req);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const wrapped = withCors(handler);
export { wrapped as GET, wrapped as POST, wrapped as DELETE };
