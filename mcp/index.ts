#!/usr/bin/env bun
// Mindset Logos MCP (stdio). A thin proxy to the hosted server at
// https://mindset-logos.vercel.app/api/mcp, so the tool list, descriptions, and
// behavior always match what claude.ai users get. Nothing to update locally when
// the library or the tools change.
//
// Most people don't need this package. Claude Code can talk to the hosted server
// directly:
//   claude mcp add --transport http mindset-logos https://mindset-logos.vercel.app/api/mcp
//
// Override the target with MINDSET_LOGOS_MCP_URL.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const REMOTE = process.env.MINDSET_LOGOS_MCP_URL ?? 'https://mindset-logos.vercel.app/api/mcp';

let client: Client | null = null;

async function remote(): Promise<Client> {
  if (client) return client;
  const c = new Client({ name: 'mindset-logos-stdio-proxy', version: '0.2.0' });
  await c.connect(new StreamableHTTPClientTransport(new URL(REMOTE)));
  client = c;
  return c;
}

async function withRetry<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  try {
    return await fn(await remote());
  } catch {
    client = null; // stale session (server redeployed): reconnect once
    return fn(await remote());
  }
}

const first = await remote().catch(() => null);
const instructions = first?.getInstructions();

const server = new Server(
  { name: 'mindset-logos', version: '0.2.0' },
  { capabilities: { tools: {} }, ...(instructions ? { instructions } : {}) },
);

server.setRequestHandler(ListToolsRequestSchema, async () => withRetry((c) => c.listTools()));

server.setRequestHandler(CallToolRequestSchema, async (req) =>
  withRetry((c) => c.callTool({ name: req.params.name, arguments: req.params.arguments ?? {} })),
);

await server.connect(new StdioServerTransport());
