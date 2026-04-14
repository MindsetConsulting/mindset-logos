import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { join, extname } from 'path';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
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

const LOGO_UI_URI = 'ui://mindset-logos/logo.html';

const LOGO_UI_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Mindset Logo Viewer</title>
<style>
  :root { color-scheme: light dark; }
  html, body { margin: 0; padding: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Inter", sans-serif; }
  body { padding: 16px; background: transparent; color: #1d1d1b; }
  .wrap { display: grid; gap: 12px; max-width: 680px; }
  h2 { font-family: ui-serif, Georgia, "Playfair Display", serif; font-size: 22px; margin: 0 0 4px; font-weight: 600; }
  .meta { font-size: 12px; color: #6b7280; margin-bottom: 8px; }
  .card { border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; padding: 28px; display: flex; align-items: center; justify-content: center; min-height: 120px; }
  .card.light { background: #FAF7F2; }
  .card.dark { background: #0A1628; }
  .card img { max-width: 100%; max-height: 180px; height: auto; display: block; }
  .label { font-family: ui-monospace, "JetBrains Mono", monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 6px; }
  .col { display: flex; flex-direction: column; }
  @media (prefers-color-scheme: dark) {
    body { color: #FAF7F2; }
    .card { border-color: rgba(255,255,255,0.12); }
  }
</style>
</head>
<body>
  <div id="root" class="wrap">
    <div class="col"><div class="label">Waiting for tool result…</div></div>
  </div>
<script>
(function () {
  var rendered = false;

  function render(payload) {
    if (!payload) return;
    rendered = true;
    var root = document.getElementById('root');
    var name = payload.name || payload.slug || 'Logo';
    var hq = payload.hq && payload.hq.display ? payload.hq.display : '';
    var industry = payload.industry || '';
    var meta = [industry, hq].filter(Boolean).join(' · ');
    var lightSrc = payload.lightDataUri || payload.onLight || '';
    var darkSrc = payload.darkDataUri || payload.onDark || '';
    var html = '<div class="col">'
      + '<h2>' + escape(name) + '</h2>'
      + (meta ? '<div class="meta">' + escape(meta) + '</div>' : '')
      + '</div>'
      + '<div class="col"><div class="label">On light</div>'
      + '<div class="card light">' + (lightSrc ? '<img alt="' + escape(name) + ' on light" src="' + lightSrc + '">' : '<span class="meta">no variant</span>') + '</div>'
      + '</div>'
      + '<div class="col"><div class="label">On dark</div>'
      + '<div class="card dark">' + (darkSrc ? '<img alt="' + escape(name) + ' on dark" src="' + darkSrc + '">' : '<span class="meta">no variant</span>') + '</div>'
      + '</div>';
    root.innerHTML = html;
  }

  function escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function extractFromToolResult(result) {
    if (!result || !Array.isArray(result.content)) return null;
    var data = {};
    for (var i = 0; i < result.content.length; i++) {
      var block = result.content[i];
      if (block.type === 'text') {
        try {
          var parsed = JSON.parse(block.text);
          if (parsed && typeof parsed === 'object') {
            Object.assign(data, parsed);
          }
        } catch (_e) {}
      } else if (block.type === 'image' && block.data && block.mimeType) {
        var uri = 'data:' + block.mimeType + ';base64,' + block.data;
        if (!data.lightDataUri) data.lightDataUri = uri;
        else if (!data.darkDataUri) data.darkDataUri = uri;
      }
    }
    return data;
  }

  window.addEventListener('message', function (ev) {
    var msg = ev && ev.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.method === 'ui/notifications/tool-result' && msg.params) {
      var payload = extractFromToolResult(msg.params.result);
      if (payload) render(payload);
    } else if (msg.method === 'ui/initialize') {
      try {
        (window.parent || window).postMessage(
          { jsonrpc: '2.0', id: msg.id || 0, result: { protocolVersion: '2025-11-21', appInfo: { name: 'mindset-logo-viewer', version: '0.1.0' }, appCapabilities: {} } },
          '*',
        );
      } catch (_e) {}
    }
  });

  try {
    (window.parent || window).postMessage(
      { jsonrpc: '2.0', method: 'ui/notifications/initialized' },
      '*',
    );
  } catch (_e) {}
})();
</script>
</body>
</html>`;

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

    registerAppTool(
      server,
      'get_logo',
      {
        title: 'Get logo',
        description:
          'Get one customer logo by slug. Returns a pre-formatted markdown block with both variants embedded as data: URIs so they render inline in the chat, plus the full metadata. IMPORTANT: When responding to the user, copy the returned markdown block verbatim — do not substitute the data: URIs with remote https URLs (those do not render in claude.ai), and do not write your own markdown image tags.',
        inputSchema: {
          slug: z.string().describe('Customer slug, e.g. "3m", "home-depot", "bcbs-mn"'),
        },
        _meta: {
          ui: { resourceUri: LOGO_UI_URI },
        },
      },
      async ({ slug }) => {
        const logo = loadLogos().find((l) => l.slug === slug);
        if (!logo) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: `No logo found for slug "${slug}"` }),
              },
            ],
            isError: true,
          };
        }
        const light = readLogoAsBase64(logo.onLight);
        const dark = readLogoAsBase64(logo.onDark);
        const lightDataUri = light ? `data:${light.mimeType};base64,${light.data}` : null;
        const darkDataUri = dark ? `data:${dark.mimeType};base64,${dark.data}` : null;
        const abs = absolutize(logo);
        const metaLine = [abs.industry, logo.hq?.display].filter(Boolean).join(' · ');

        const markdown = [
          `### ${abs.name}`,
          metaLine ? `*${metaLine}*` : '',
          '',
          '**On light:**',
          lightDataUri ? `![${abs.name} on light](${lightDataUri})` : '_(no on-light variant)_',
          '',
          '**On dark:**',
          darkDataUri ? `![${abs.name} on dark](${darkDataUri})` : '_(no on-dark variant)_',
          '',
          abs.website ? `Website: ${abs.website}` : '',
          '',
          `Direct URLs: \`${abs.onLight ?? 'n/a'}\` · \`${abs.onDark ?? 'n/a'}\``,
        ]
          .filter((line) => line !== '')
          .join('\n');

        const instructions =
          'RENDERING INSTRUCTIONS: Copy the markdown block above verbatim into your response to the user. The images are embedded as data: URIs so they render inline in any markdown renderer. Do NOT replace the data URIs with remote https URLs (those do not render in claude.ai). Do NOT write your own markdown image tags for this logo.';

        const content: Array<
          | { type: 'text'; text: string }
          | { type: 'image'; data: string; mimeType: string }
        > = [
          { type: 'text', text: markdown },
          { type: 'text', text: instructions },
          { type: 'text', text: JSON.stringify(abs, null, 2) },
        ];
        if (light && light.mimeType !== 'image/svg+xml')
          content.push({ type: 'image', data: light.data, mimeType: light.mimeType });
        if (dark && dark.mimeType !== 'image/svg+xml')
          content.push({ type: 'image', data: dark.data, mimeType: dark.mimeType });
        return { content };
      },
    );

    registerAppResource(
      server,
      'Mindset Logo Viewer',
      LOGO_UI_URI,
      { description: 'Inline viewer for a single Mindset customer logo.' },
      async () => ({
        contents: [
          {
            uri: LOGO_UI_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: LOGO_UI_HTML,
          },
        ],
      }),
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
