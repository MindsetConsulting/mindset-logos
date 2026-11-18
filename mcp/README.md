# @mindsetconsulting/mindset-logos-mcp

Mindset's logo and SAP badge library as an MCP server. This package is a thin stdio proxy to the hosted server, so it always has the same tools as the claude.ai connector.

## Install

Easiest, no package needed:

```bash
claude mcp add --transport http mindset-logos https://mindset-logos.vercel.app/api/mcp
```

Or via this package (needs `@mindsetconsulting` on GitHub Packages in `~/.npmrc`):

```bash
claude mcp add mindset-logos -- bunx @mindsetconsulting/mindset-logos-mcp
```

## Tools

- `list_logos(relationship?, aiFund?, vertical?)`: customers (Closed Won), pipeline, prospects, partners, AI Fund accounts.
- `search_logos(query)`: name, industry, vertical, city, DUNS, Salesforce ID.
- `get_logo(slug or name, variant?, format?, width?, background?)`: download URLs in PNG, JPG, WebP, or SVG, plus a preview.
- `logo_pack(...)`: ZIP URL for any filtered set.
- `list_badges()` / `get_badge(name, ...)`: Mindset's SAP Gold Partner, BTP Expert, and AppHaus Network badges.

Ask in plain words: "Ecolab logo as an SVG for print", "our BTP badge as a PNG on white".
