'use client';

import { useState, useMemo } from 'react';
import { Search, Github, Terminal, ChevronDown, Copy, Check } from 'lucide-react';
import type { Logo } from '@/lib/logos';
import LogoRow from './logo-row';

export default function Gallery({ logos }: { logos: Logo[] }) {
  const [query, setQuery] = useState('');
  const [vertical, setVertical] = useState<string>('');
  const [devOpen, setDevOpen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyCmd = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(label);
    setTimeout(() => setCopiedCmd(null), 1500);
  };

  const verticals = useMemo(() => {
    const set = new Set<string>();
    logos.forEach((l) => l.verticals.forEach((v) => set.add(v)));
    return Array.from(set).sort();
  }, [logos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logos.filter((l) => {
      if (q) {
        const hit =
          l.name.toLowerCase().includes(q) ||
          l.slug.toLowerCase().includes(q) ||
          l.industry.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (vertical && !l.verticals.includes(vertical)) return false;
      return true;
    });
  }, [logos, query, vertical]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/[0.06] px-6 py-10 md:px-12 md:py-14">
        <div className="mx-auto max-w-[1200px]">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-[color:var(--color-violet-light)]">
            Mindset Consulting · Customer Marks
          </p>
          <h1 className="mt-3 font-serif text-[clamp(2rem,4vw,3.2rem)] font-bold leading-[1.05] text-[color:var(--color-warm-white)]">
            Every customer logo, ready to drop in.
          </h1>
          <p className="mt-4 max-w-[60ch] font-sans text-base leading-relaxed text-[color:rgba(247,245,242,0.6)]">
            {logos.length} customers. Each one has a light and a dark variant, sourced from vendor sites and hand-checked for transparency. Copy the URL or download the file — whatever you need.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <a
              href="https://github.com/MindsetConsulting/mindset-logos"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 font-mono text-[0.7rem] uppercase tracking-wider text-[color:var(--color-warm-white)] transition hover:border-[color:var(--color-violet-light)] hover:bg-white/[0.08]"
            >
              <Github className="h-3.5 w-3.5" /> GitHub
            </a>
            <button
              onClick={() => setDevOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 font-mono text-[0.7rem] uppercase tracking-wider text-[color:var(--color-warm-white)] transition hover:border-[color:var(--color-violet-light)] hover:bg-white/[0.08]"
            >
              <Terminal className="h-3.5 w-3.5" /> Use from Claude Code (MCP)
              <ChevronDown className={`h-3.5 w-3.5 transition ${devOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {devOpen && (
            <div className="mt-5 max-w-[860px] space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 md:p-6">
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[color:var(--color-violet-light)]">
                  1 · Install the MCP server
                </p>
                <p className="mt-2 font-sans text-sm text-[color:rgba(247,245,242,0.65)]">
                  One-line install. Claude Code reads this repo's JSON API so you always get the latest library.
                </p>
                <CodeBlock
                  label="install"
                  code="claude mcp add mindset-logos -- bunx @mindsetconsulting/mindset-logos-mcp"
                  copiedCmd={copiedCmd}
                  onCopy={copyCmd}
                />
              </div>
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[color:var(--color-violet-light)]">
                  2 · Ask Claude to use it
                </p>
                <p className="mt-2 font-sans text-sm text-[color:rgba(247,245,242,0.65)]">
                  The server exposes three tools: <code className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-xs">list_logos</code>,{' '}
                  <code className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-xs">get_logo</code>, and{' '}
                  <code className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-xs">search_logos</code>.
                </p>
                <CodeBlock
                  label="example"
                  code={`"Build me a slide with our customer logos for all our chemical customers"\n"Grab the on-dark version of 3M and drop it in the hero"\n"Which of our customers are in the food & beverage vertical?"`}
                  copiedCmd={copiedCmd}
                  onCopy={copyCmd}
                />
              </div>
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[color:var(--color-violet-light)]">
                  3 · Or just hit the API directly
                </p>
                <CodeBlock
                  label="api"
                  code="curl https://mindset-logos.vercel.app/api/logos"
                  copiedCmd={copiedCmd}
                  onCopy={copyCmd}
                />
              </div>
              <div className="border-t border-white/[0.06] pt-4 text-[0.72rem] font-sans text-[color:rgba(247,245,242,0.55)]">
                Adding a new customer or fixing a broken logo? Clone the repo, edit{' '}
                <code className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.65rem]">public/logos/manifest.json</code>, run{' '}
                <code className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.65rem]">bun run fetch</code> +{' '}
                <code className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.65rem]">bun run audit</code>, push to main. Vercel redeploys automatically. The full technique guide lives in{' '}
                <a
                  href="https://github.com/MindsetConsulting/mindset-logos/blob/main/CLAUDE.md"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[color:var(--color-violet-light)] hover:text-[color:var(--color-warm-white)]"
                >
                  CLAUDE.md
                </a>
                .
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-[color:var(--color-ink)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-6 py-4 md:px-12">
          <div className="relative flex flex-1 items-center min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[color:rgba(247,245,242,0.4)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, slug, industry…"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-4 font-sans text-sm text-[color:var(--color-warm-white)] placeholder:text-[color:rgba(247,245,242,0.35)] focus:border-[color:var(--color-violet-light)] focus:outline-none"
            />
          </div>
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 font-sans text-sm text-[color:var(--color-warm-white)] focus:border-[color:var(--color-violet-light)] focus:outline-none"
          >
            <option value="">All verticals</option>
            {verticals.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <span className="font-mono text-[0.7rem] uppercase tracking-wider text-[color:rgba(247,245,242,0.4)]">
            {filtered.length} showing
          </span>
        </div>
      </div>

      <main className="mx-auto max-w-[1200px] px-6 py-10 md:px-12">
        {filtered.length === 0 ? (
          <div className="py-24 text-center font-mono text-sm text-[color:rgba(247,245,242,0.45)]">
            No customers match that search.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((logo) => (
              <LogoRow key={logo.slug} logo={logo} />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-white/[0.06] px-6 py-8 md:px-12">
        <div className="mx-auto max-w-[1200px] font-mono text-[0.7rem] uppercase tracking-wider text-[color:rgba(247,245,242,0.4)]">
          Managed via{' '}
          <a
            href="https://github.com/MindsetConsulting/mindset-logos"
            className="text-[color:var(--color-violet-light)] hover:text-[color:var(--color-warm-white)]"
          >
            MindsetConsulting/mindset-logos
          </a>
          . Need a new logo? Open an issue or run the fetch script.
        </div>
      </footer>
    </div>
  );
}

function CodeBlock({
  label,
  code,
  copiedCmd,
  onCopy,
}: {
  label: string;
  code: string;
  copiedCmd: string | null;
  onCopy: (label: string, text: string) => void;
}) {
  return (
    <div className="relative mt-2 overflow-hidden rounded-lg border border-white/[0.06] bg-[color:var(--color-ink)]">
      <pre className="whitespace-pre-wrap break-all px-4 py-3 pr-12 font-mono text-[0.75rem] leading-relaxed text-[color:rgba(247,245,242,0.85)]">
{code}
      </pre>
      <button
        onClick={() => onCopy(label, code)}
        className="absolute right-2 top-2 flex items-center gap-1 rounded px-2 py-1 font-mono text-[0.58rem] uppercase tracking-wider text-[color:rgba(247,245,242,0.55)] transition hover:bg-white/[0.06] hover:text-[color:var(--color-warm-white)]"
      >
        {copiedCmd === label ? (
          <>
            <Check className="h-3 w-3 text-[color:var(--color-green)]" /> Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" /> Copy
          </>
        )}
      </button>
    </div>
  );
}
