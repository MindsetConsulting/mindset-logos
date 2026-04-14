# @mindsetconsulting/mindset-logos-mcp

MCP server for the Mindset Consulting customer logo library. Exposes the gallery at [mindset-logos.vercel.app](https://mindset-logos.vercel.app) as three tools any Claude Code session can call.

## Install

```bash
claude mcp add mindset-logos -- bunx @mindsetconsulting/mindset-logos-mcp
```

Or with npx:

```bash
claude mcp add mindset-logos -- npx -y @mindsetconsulting/mindset-logos-mcp
```

GitHub Packages needs auth to install scoped packages. Add this once to your `~/.npmrc`:

```
@mindsetconsulting:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then make sure `GITHUB_TOKEN` is exported in your shell profile (a personal access token with `read:packages` is enough).

## Tools

- `list_logos(vertical?)` — every customer in the library, optional vertical filter.
- `search_logos(query, limit?)` — fuzzy search over slug, name, industry, verticals, HQ.
- `get_logo(slug)` — one customer with website, industry, HQ, and absolute URLs for both `on-light` and `on-dark` variants.

## Source

Lives in [MindsetConsulting/mindset-logos](https://github.com/MindsetConsulting/mindset-logos) under `mcp/`.
