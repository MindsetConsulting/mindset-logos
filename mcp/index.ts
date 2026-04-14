#!/usr/bin/env bun
// Mindset Logos MCP — stdio server exposing the customer logo library to
// Claude Code sessions. Reads the canonical manifest from the deployed
// gallery at https://mindset-logos.vercel.app/api/logos (override with
// MINDSET_LOGOS_URL env var).
//
// Tools:
//   list_logos    — full list, optional vertical filter
//   search_logos  — fuzzy search by name/slug/industry/vertical
//   get_logo      — one customer by slug, returns both variant URLs
//
// Install:
//   claude mcp add mindset-logos -- bunx @mindsetconsulting/mindset-logos-mcp

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_URL = process.env.MINDSET_LOGOS_URL ?? 'https://mindset-logos.vercel.app/api/logos';

type HQ = {
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  display: string | null;
};

type Logo = {
  slug: string;
  name: string;
  website: string;
  industry: string;
  verticals: string[];
  onLight: string | null;
  onDark: string | null;
  sfId?: string;
  hq?: HQ;
};

type ApiResponse = { total: number; logos: Logo[] };

let cache: { data: Logo[]; fetchedAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

async function fetchLogos(): Promise<Logo[]> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.data;
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`Failed to fetch ${API_URL}: ${res.status}`);
  const json = (await res.json()) as ApiResponse;
  // Rewrite relative paths to absolute URLs
  const base = new URL(API_URL);
  const origin = `${base.protocol}//${base.host}`;
  for (const l of json.logos) {
    if (l.onLight && l.onLight.startsWith('/')) l.onLight = origin + l.onLight;
    if (l.onDark && l.onDark.startsWith('/')) l.onDark = origin + l.onDark;
  }
  cache = { data: json.logos, fetchedAt: Date.now() };
  return json.logos;
}

const server = new Server(
  {
    name: 'mindset-logos',
    version: '0.1.0',
  },
  {
    capabilities: { tools: {} },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_logos',
      description:
        'List every Mindset Consulting customer logo. Each entry has slug, name, website, industry, verticals, HQ address, and absolute URLs for on-light and on-dark variants. Optional vertical filter.',
      inputSchema: {
        type: 'object',
        properties: {
          vertical: {
            type: 'string',
            description: 'Optional vertical/industry filter (e.g. "Healthcare", "Food & Beverage").',
          },
        },
      },
    },
    {
      name: 'search_logos',
      description:
        'Fuzzy search the Mindset customer logo library by a free-text query. Matches against slug, name, industry, verticals, and HQ city/state.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results (default 20)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_logo',
      description:
        'Get one customer logo by slug. Returns name, website, industry, verticals, HQ address, and absolute URLs for the on-light and on-dark variants. Drop the URLs directly into HTML, slides, emails, etc.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Customer slug, e.g. "3m", "home-depot", "bcbs-mn"' },
        },
        required: ['slug'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const logos = await fetchLogos();

  if (name === 'list_logos') {
    const vertical = (args as { vertical?: string })?.vertical;
    const out = vertical
      ? logos.filter((l) => l.verticals.includes(vertical) || l.industry === vertical)
      : logos;
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ total: out.length, logos: out }, null, 2),
        },
      ],
    };
  }

  if (name === 'search_logos') {
    const { query, limit = 20 } = args as { query: string; limit?: number };
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
      .slice(0, limit)
      .map((x) => x.logo);
    return {
      content: [
        { type: 'text', text: JSON.stringify({ total: scored.length, logos: scored }, null, 2) },
      ],
    };
  }

  if (name === 'get_logo') {
    const { slug } = args as { slug: string };
    const logo = logos.find((l) => l.slug === slug);
    if (!logo) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `No logo found for slug "${slug}"` }) }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(logo, null, 2) }],
    };
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
