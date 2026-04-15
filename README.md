# Mindset Logos

The one place at Mindset for every customer logo. 122 companies, both `on-light` and `on-dark` variants, hand-verified and transparent. Use it from the browser, from Claude Code, from the API, or clone the repo and use the files directly. Every variant can be fetched in any format (PNG, WebP, JPG, or SVG) via the on-the-fly transcoder.

## Where to find it

| What | Where |
|---|---|
| **Gallery** | [mindset-logos.vercel.app](https://mindset-logos.vercel.app) |
| **GitHub** | [MindsetConsulting/mindset-logos](https://github.com/MindsetConsulting/mindset-logos) |
| **Vercel** | [vercel.com/mindsetconsulting/mindset-logos](https://vercel.com/mindsetconsulting/mindset-logos) |
| **JSON list API** | `https://mindset-logos.vercel.app/api/logos` |
| **Transcoder API** | `https://mindset-logos.vercel.app/api/logos/{slug}/{variant}.{format}` |
| **MCP (Claude Code)** | `claude mcp add mindset-logos -- npx -y @mindsetconsulting/mindset-logos-mcp` |
| **MCP (claude.ai team)** | Custom connector URL: `https://mindset-logos.vercel.app/api/mcp` |
| **Raw files** | `https://mindset-logos.vercel.app/logos/{slug}-on-{light,dark}.{ext}` |

## How to use it

### In a browser

Open the gallery. Search, filter by vertical, copy any logo's URL or download the file.

### In Claude Code via MCP

```bash
claude mcp add mindset-logos -- npx -y @mindsetconsulting/mindset-logos-mcp
```

The package ships via GitHub Packages. If you haven't already, add this once to your `~/.npmrc` and export `GITHUB_TOKEN` in your shell profile (a PAT with `read:packages` is enough):

```
@mindsetconsulting:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### In claude.ai (Mindset Claude Team)

Team owners add the MCP as a custom connector in the admin panel so every Mindset employee gets it automatically:

1. Go to **claude.ai → Settings → Connectors → Add custom connector**.
2. Name: `Mindset Logos`.
3. URL: `https://mindset-logos.vercel.app/api/mcp`
4. Transport: Streamable HTTP (default).
5. Save and enable for the Mindset workspace.

No auth required. The endpoint is stateless and read-only.

### What to ask it

Then in any Claude Code or claude.ai session, ask things like:

- "Grab the on-dark version of 3M and put it in the hero"
- "List our customers in the food & beverage vertical"
- "Build a customer-logo wall for all 119 of our customers"

The server exposes three tools: `list_logos`, `get_logo(slug, variant)`, and `search_logos(query)`.

### From a script (JSON API)

```bash
curl https://mindset-logos.vercel.app/api/logos
```

Returns every customer with their `onLight` and `onDark` file paths, website, industry, and verticals.

### Transcoder API (pick your format)

Every variant can be fetched in any format via `/api/logos/{slug}/{variant}.{format}`:

```
# PNG (transparent, universal)
https://mindset-logos.vercel.app/api/logos/abbott/on-light.png?w=800

# WebP (transparent, 3x smaller than PNG)
https://mindset-logos.vercel.app/api/logos/cargill/on-light.webp?w=800

# JPEG (flattened onto cream for on-light, navy for on-dark; override with &bg=ffffff)
https://mindset-logos.vercel.app/api/logos/3m/on-light.jpg?w=1200

# SVG (passthrough; only works when the source file is SVG, 415 otherwise)
https://mindset-logos.vercel.app/api/logos/anchorage/on-dark.svg
```

**Why this exists:** some downstream consumers (Google Slides API, older clients) only accept specific formats. Instead of hand-maintaining multiple files per customer, the transcoder reads whatever source we have (WebP, SVG, or PNG) and returns the format you asked for. Results are cached immutably on Vercel's CDN per URL, so the conversion runs exactly once per `{slug, variant, format, width}` combo.

Query params:
- `w` — target width in pixels (default 800, max 2000). SVG sources rasterize at a density calibrated to this width so they stay sharp.
- `bg` — hex color for JPEG background (e.g. `bg=ffffff`). Defaults to cream for `on-light`, navy for `on-dark`. Ignored for PNG/WebP since those preserve alpha.

Extension omitted (`/api/logos/abbott/on-light`) defaults to PNG.

### Direct file URLs (raw sources)

If you want the original source file in its native format:

```
https://mindset-logos.vercel.app/logos/3m-on-dark.png
https://mindset-logos.vercel.app/logos/agiliti-on-light.webp
https://mindset-logos.vercel.app/logos/bcbs-mn-on-light.svg
```

Use them in Markdown, Slack, decks, emails, anywhere that accepts whatever format the source happens to be.

## Adding a new customer

1. Add an entry to `public/logos/manifest.json` with `slug`, `name`, `website`, `industry`, `verticals`.
2. `bun run fetch <slug>` — pulls both variants from Brandfetch with a fallback to vendor website scraping.
3. `bun run audit` — check quality and variant classification.
4. If the automatic fetch produced flat/icon/tiny variants, follow the techniques in [CLAUDE.md](./CLAUDE.md) to re-source from the vendor site (logovectorseek, seeklogo, Wikipedia, or the header of the homepage). There are three documented techniques (trust existing alpha, Pillow pixel swap, SVG color swap) that cover every logo we've hit.
5. Add the slug to `.pending-approval.json` until visually verified, then remove it.
6. Commit and push. Vercel redeploys automatically.

## Fixing a bad logo

See the three techniques in [CLAUDE.md](./CLAUDE.md). The gist:
- **Trust existing alpha** — Brandfetch files are often already transparent; just trim and save, never `-alpha off`.
- **Pillow pixel swap** — for raster logos with visible theme colors, walk pixels with a per-channel rule (`b > r + 25`, `max(r,g,b) < 80`, etc) and preserve the original alpha.
- **SVG color swap** — for vendor SVGs with white-text/colored-emblem mixes, use a Python regex keyed on the path's starting M x-coordinate so you only swap text-region white fills.

## Architecture

- `app/` — Next.js 16 gallery UI (Playfair Display + Inter + JetBrains Mono, Mindset brand theme).
- `public/logos/` — all logo files, the `manifest.json`, `audit.json`, pending/override lists.
- `lib/logos.ts` — reads the manifest and resolves each slug's variant file paths.
- `scripts/` — `fetch-logos.ts`, `audit.ts`, `fix.ts`, `apply-approvals.ts`. Run with `bun run {fetch,audit,fix,apply-approvals}`.
- `mcp/` — stdio MCP server that wraps the JSON API.
- `CLAUDE.md` — full technique reference, baked into the repo so any Claude Code session has the context.

Deployed to Vercel from `main`. The GitHub Actions pipeline rebuilds the `@mindsetconsulting/brand` asset on brand updates.
