import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { loadLogos, findLogo, type Logo } from '@/lib/logos';
import { loadBadges, findBadge } from '@/lib/badges';
import { logoJson, badgeJson, SITE_ORIGIN, URL_HELP } from '@/lib/links';
import { isVector, CREAM, NAVY } from '@/lib/transcode';

export const maxDuration = 60;

const INSTRUCTIONS = `Mindset Consulting's mark library: customer logos plus Mindset's own SAP partner badges.

- Customer, partner, pipeline, and AI Fund logos: list_logos, search_logos, get_logo, logo_pack.
- Mindset's SAP credentials (Gold Partner, Expert in Business Data Cloud and Business AI Platform, AppHaus Network): list_badges, get_badge.

Rules that matter:
- Only relationship "customer" (at least one Closed Won opportunity) may be shown as a client. "pipeline" means an open opportunity, "prospect" means none. Never present pipeline or prospect logos as customers.
- on-light is for light backgrounds (dark ink), on-dark is for dark backgrounds (light ink).
- Every logo comes in any format through URLs: png, webp, jpg, and svg when a vector master exists. Width with ?w=, background with ?bg=. For slides and email use PNG (Outlook drops WebP). For web use SVG when vector is set. For print prefer vector "official". A "traced" vector is Mindset's redraw from the best raster: say so, and suggest asking the brand for its file before large print.
- SAP badges are official SAP artwork. Don't recolor, crop, or redraw them.`;

type Variant = 'on-light' | 'on-dark';
type Fmt = 'png' | 'jpg' | 'webp' | 'svg';

const BG: Record<string, string | null> = { transparent: null, cream: CREAM, navy: NAVY, white: '#FFFFFF', black: '#000000' };

function urlFor(kind: 'logos' | 'badges', slug: string, variant: Variant, fmt: Fmt, width?: number, bg?: string) {
  const q = new URLSearchParams();
  if (fmt !== 'svg') q.set('w', String(width ?? 1200));
  const hex = bg ? (bg in BG ? BG[bg] : bg) : null;
  if (hex && fmt !== 'svg') q.set('bg', hex.replace('#', ''));
  const qs = q.toString();
  return `${SITE_ORIGIN}/api/${kind}/${slug}/${variant}.${fmt}${qs ? `?${qs}` : ''}`;
}

/** Small PNG preview flattened on the right background so chat clients can show it. */
async function preview(src: string | null, variant: Variant) {
  if (!src) return null;
  try {
    const input = readFileSync(join(process.cwd(), 'public', src.replace(/^\//, '')));
    const data = await sharp(input, { density: isVector(src) ? 300 : 72 })
      .resize({ width: 640, height: 240, fit: 'inside', withoutEnlargement: !isVector(src) })
      .extend({ top: 24, bottom: 24, left: 32, right: 32, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .flatten({ background: variant === 'on-dark' ? NAVY : CREAM })
      .png()
      .toBuffer();
    return { type: 'image' as const, data: data.toString('base64'), mimeType: 'image/png' };
  } catch {
    return null;
  }
}

const text = (t: string) => ({ type: 'text' as const, text: t });
const json = (v: unknown) => text(JSON.stringify(v, null, 2));

function filterLogos(f: { relationship?: string; aiFund?: string; vertical?: string; type?: string }) {
  return loadLogos().filter((l) => {
    if (f.relationship && l.salesforce.relationship !== f.relationship) return false;
    if (f.aiFund && (f.aiFund === 'any' ? !l.aiFund : l.aiFund !== f.aiFund)) return false;
    if (f.type && l.salesforce.type !== f.type) return false;
    if (f.vertical) {
      const v = f.vertical.toLowerCase();
      if (!l.verticals.some((x) => x.toLowerCase() === v) && l.industry.toLowerCase() !== v) return false;
    }
    return true;
  });
}

function score(l: Logo, q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  let s = 0;
  for (const w of words) {
    let hit = 0;
    if (l.slug === w || l.name.toLowerCase() === w) hit = 20;
    else if (l.slug.includes(w)) hit = 10;
    else if (l.name.toLowerCase().includes(w)) hit = 8;
    else if (l.salesforce.sfName?.toLowerCase().includes(w)) hit = 6;
    else if (l.verticals.some((v) => v.toLowerCase().includes(w)) || l.industry.toLowerCase().includes(w)) hit = 4;
    else if (l.hq?.display?.toLowerCase().includes(w)) hit = 2;
    else if (l.salesforce.duns === w || l.salesforce.sfId?.toLowerCase() === w) hit = 12;
    if (!hit) return 0; // every word must match something
    s += hit;
  }
  return s;
}

const formatArgs = {
  variant: z.enum(['on-light', 'on-dark', 'both']).optional().describe('Which background it goes on. Default both.'),
  format: z.enum(['png', 'jpg', 'webp', 'svg']).optional().describe('Output format. Default png. svg only when vector is true.'),
  width: z.number().int().min(64).max(2400).optional().describe('Width in px for raster formats. Default 1200.'),
  background: z
    .string()
    .optional()
    .describe('transparent (default), cream, navy, white, black, or a hex like 1D1D1B. Flattens raster output onto that color.'),
};

function deliveryBlock(kind: 'logos' | 'badges', slug: string, srcs: { onLight: string | null; onDark: string | null }, a: { variant?: string; format?: Fmt; width?: number; background?: string }) {
  const fmt: Fmt = a.format ?? 'png';
  const variants: Variant[] = a.variant && a.variant !== 'both' ? [a.variant as Variant] : ['on-light', 'on-dark'];
  const out: Record<string, string | null> = {};
  const warnings: string[] = [];
  for (const v of variants) {
    const src = v === 'on-light' ? srcs.onLight : srcs.onDark;
    if (!src) {
      out[v] = null;
      continue;
    }
    if (fmt === 'svg' && !isVector(src)) {
      warnings.push(`${v}: no vector master yet, gave PNG at 2400px instead.`);
      out[v] = urlFor(kind, slug, v, 'png', 2400, a.background);
    } else {
      out[v] = urlFor(kind, slug, v, fmt, a.width, a.background);
    }
  }
  return { requested: { format: fmt, width: a.width ?? (fmt === 'svg' ? null : 1200), background: a.background ?? 'transparent' }, urls: out, warnings };
}

const LOGO_UI_URI = 'ui://mindset-logos/logo.html';
const LOGO_UI_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Mindset Logo</title>
<style>:root{color-scheme:light dark}body{margin:0;padding:16px;font-family:ui-sans-serif,system-ui,sans-serif;background:transparent;color:#1d1d1b}
.wrap{display:grid;gap:12px;max-width:680px}h2{font-family:ui-serif,Georgia,serif;font-size:22px;margin:0}.meta{font-size:12px;color:#6b7280}
.card{border-radius:12px;padding:28px;display:flex;align-items:center;justify-content:center;min-height:110px}.light{background:#FAF7F2;border:1px solid rgba(0,0,0,.08)}.dark{background:#0A1628}
img{max-width:100%;max-height:170px}@media (prefers-color-scheme:dark){body{color:#FAF7F2}}</style></head>
<body><div id="root" class="wrap"><div class="meta">Loading…</div></div><script>
(function(){function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function render(r){if(!r||!Array.isArray(r.content))return;var d={},imgs=[];r.content.forEach(function(b){if(b.type==='text'){try{Object.assign(d,JSON.parse(b.text))}catch(e){}}else if(b.type==='image'){imgs.push('data:'+b.mimeType+';base64,'+b.data)}});
var h='<h2>'+esc(d.name)+'</h2><div class="meta">'+esc([d.industry,d.hq,d.relationship].filter(Boolean).join(' · '))+'</div>';
if(imgs[0])h+='<div class="card light"><img src="'+imgs[0]+'"></div>';if(imgs[1])h+='<div class="card dark"><img src="'+imgs[1]+'"></div>';document.getElementById('root').innerHTML=h}
window.addEventListener('message',function(ev){var m=ev&&ev.data;if(!m||typeof m!=='object')return;if(m.method==='ui/notifications/tool-result'&&m.params)render(m.params.result);
else if(m.method==='ui/initialize'){try{(window.parent||window).postMessage({jsonrpc:'2.0',id:m.id||0,result:{protocolVersion:'2025-11-21',appInfo:{name:'mindset-logo-viewer',version:'0.2.0'},appCapabilities:{}}},'*')}catch(e){}}});
try{(window.parent||window).postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized'},'*')}catch(e){}})();
</script></body></html>`;

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'list_logos',
      {
        title: 'List logos',
        description:
          'List logos in the Mindset library with filters. relationship is the truth for "is this a client": customer = Closed Won, pipeline = open opportunity, prospect = none, partner = partner account. aiFund marks SAP Business AI Fund accounts (won or open). Returns compact rows; call get_logo for download URLs in a specific format.',
        inputSchema: {
          relationship: z.enum(['customer', 'partner', 'pipeline', 'prospect', 'other']).optional(),
          aiFund: z.enum(['any', 'won', 'open']).optional().describe('Only SAP Business AI Fund accounts.'),
          vertical: z.string().optional().describe('e.g. "Healthcare", "Food & Beverage", "Manufacturing".'),
          type: z.enum(['customer', 'partner', 'prospect', 'self', 'other']).optional().describe('Legacy: raw Salesforce Account.Type bucket. Prefer relationship.'),
        },
      },
      async (args) => {
        const out = filterLogos(args);
        return { content: [json({ total: out.length, logos: out.map((l) => logoJson(l)), zip: zipUrl(args) })] };
      },
    );

    server.registerTool(
      'search_logos',
      {
        title: 'Search logos',
        description: 'Find logos by company name, slug, Salesforce name, industry, vertical, HQ city, DUNS, or Salesforce ID. Every word must match.',
        inputSchema: {
          query: z.string().describe('e.g. "ecolab", "chemical minnesota", "3m"'),
          limit: z.number().int().min(1).max(100).optional(),
        },
      },
      async ({ query, limit }) => {
        const hits = loadLogos()
          .map((l) => ({ l, s: score(l, query) }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s)
          .slice(0, limit ?? 20)
          .map((x) => logoJson(x.l));
        return { content: [json({ total: hits.length, logos: hits })] };
      },
    );

    registerAppTool(
      server,
      'get_logo',
      {
        title: 'Get logo',
        description: `Get one logo by slug or company name, with download URLs in the format, width, and background you want, plus a preview. ${URL_HELP}`,
        inputSchema: { slug: z.string().describe('Slug or company name, e.g. "3m", "Ecolab", "home-depot"'), ...formatArgs },
        _meta: { ui: { resourceUri: LOGO_UI_URI } },
      },
      async ({ slug, ...a }) => {
        const logo = findLogo(slug);
        if (!logo) {
          const near = loadLogos().map((l) => ({ l, s: score(l, slug) })).filter((x) => x.s > 0).slice(0, 5).map((x) => x.l.slug);
          return { content: [json({ error: `No logo for "${slug}".`, didYouMean: near })], isError: true };
        }
        const [pl, pd] = await Promise.all([preview(logo.onLight, 'on-light'), preview(logo.onDark, 'on-dark')]);
        const content: Array<ReturnType<typeof text> | NonNullable<typeof pl>> = [
          json({ ...logoJson(logo, { formats: true }), delivery: deliveryBlock('logos', logo.slug, logo, a) }),
        ];
        if (logo.salesforce.relationship !== 'customer' && logo.salesforce.relationship !== 'other') {
          content.push(text(`Note: ${logo.name} is "${logo.salesforce.relationship}", not a Closed Won customer. Don't present it as a client.`));
        }
        if (pl) content.push(pl);
        if (pd) content.push(pd);
        return { content };
      },
    );

    server.registerTool(
      'logo_pack',
      {
        title: 'Logo pack (ZIP)',
        description:
          'Get a ZIP download URL for a set of logos: by relationship, AI Fund, vertical, or an explicit slug list. PNG at the given width plus SVG wherever a vector master exists, or the raw masters with format=source.',
        inputSchema: {
          relationship: z.enum(['customer', 'partner', 'pipeline', 'prospect']).optional(),
          aiFund: z.enum(['any', 'won', 'open']).optional(),
          vertical: z.string().optional(),
          slugs: z.array(z.string()).optional(),
          format: z.enum(['png', 'source']).optional(),
          width: z.number().int().min(64).max(2400).optional(),
        },
      },
      async (args) => {
        const count = args.slugs ? args.slugs.length : filterLogos(args).length;
        return { content: [json({ logos: count, url: zipUrl(args) })] };
      },
    );

    server.registerTool(
      'list_badges',
      {
        title: 'List SAP partner badges',
        description:
          "Mindset's own SAP partner credentials: SAP Gold Partner, Gold Partner Expert in SAP BTP, SAP AppHaus Network member. Also lists badges we were asked for but don't have files for.",
        inputSchema: { includeSuperseded: z.boolean().optional() },
      },
      async ({ includeSuperseded }) => {
        const { badges, notFound, requested } = loadBadges();
        const list = badges.filter((b) => includeSuperseded || b.status === 'current').map(badgeJson);
        return { content: [json({ total: list.length, badges: list, requestedFromSap: requested, notFound, zip: `${SITE_ORIGIN}/api/logos/download?set=badges` })] };
      },
    );

    server.registerTool(
      'get_badge',
      {
        title: 'Get SAP partner badge',
        description: `Get one Mindset SAP badge by slug or name ("gold partner", "btp", "apphaus") in any format, width, and background, with a preview. ${URL_HELP}`,
        inputSchema: { badge: z.string().describe('e.g. "sap-gold-partner", "btp expert", "apphaus"'), ...formatArgs },
      },
      async ({ badge: q, ...a }) => {
        const b = findBadge(q);
        if (!b) {
          const { badges, notFound } = loadBadges();
          return { content: [json({ error: `No badge matches "${q}".`, available: badges.map((x) => x.slug), notFound })], isError: true };
        }
        const [pl, pd] = await Promise.all([preview(b.onLight, 'on-light'), preview(b.onDark, 'on-dark')]);
        const content: Array<ReturnType<typeof text> | NonNullable<typeof pl>> = [
          json({ ...badgeJson(b), delivery: deliveryBlock('badges', b.slug, b, a) }),
        ];
        if (b.status === 'superseded') content.push(text(`Note: ${b.name} is superseded. Use ${b.supersededBy ?? 'a current badge'} instead.`));
        if (pl) content.push(pl);
        if (pd && !b.selfContained) content.push(pd);
        return { content };
      },
    );

    registerAppResource(server, 'Mindset Logo Viewer', LOGO_UI_URI, { description: 'Inline viewer for one Mindset logo.' }, async () => ({
      contents: [{ uri: LOGO_UI_URI, mimeType: RESOURCE_MIME_TYPE, text: LOGO_UI_HTML }],
    }));
  },
  { serverInfo: { name: 'mindset-logos', version: '0.2.0' }, instructions: INSTRUCTIONS },
  { basePath: '/api', maxDuration: 60, verboseLogs: false },
);

function zipUrl(a: { relationship?: string; aiFund?: string; vertical?: string; type?: string; slugs?: string[]; format?: string; width?: number }) {
  const q = new URLSearchParams();
  if (a.relationship) q.set('relationship', a.relationship);
  if (a.aiFund) q.set('aiFund', a.aiFund === 'any' ? '1' : a.aiFund);
  if (a.vertical) q.set('vertical', a.vertical);
  if (a.type) q.set('type', a.type);
  if (a.slugs?.length) q.set('slugs', a.slugs.join(','));
  if (a.format) q.set('format', a.format);
  if (a.width) q.set('w', String(a.width));
  const qs = q.toString();
  return `${SITE_ORIGIN}/api/logos/download${qs ? `?${qs}` : ''}`;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, mcp-session-id, mcp-protocol-version',
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

