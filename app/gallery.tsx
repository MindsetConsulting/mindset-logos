'use client';

import { useState, useMemo } from 'react';
import { Search, Github, ChevronDown, Copy, Check, Download, Sparkles, Terminal, Award } from 'lucide-react';
import type { Logo, Relationship } from '@/lib/logos';
import type { Badge, BadgeGap, BadgeRequest } from '@/lib/badges';
import LogoRow from './logo-row';

type RelFilter = 'all' | Relationship;
type FundFilter = 'all' | 'any' | 'won' | 'open';

const PROMPTS = [
  'Give me our SAP Gold Partner and Business AI Platform Expert badges as PNGs on white, 1200px wide.',
  'Get the AppHaus Network badge for a dark slide.',
  'Ecolab logo as an SVG for print.',
  'Zip up every Closed Won customer logo in Food & Beverage.',
  'Which AI Fund accounts do we have logos for? Show me the won ones.',
  'Build a 12-logo customer wall for a navy slide, manufacturing only.',
];

export default function Gallery({
  logos,
  badges,
  badgeGaps,
  badgeRequests,
}: {
  logos: Logo[];
  badges: Badge[];
  badgeGaps: BadgeGap[];
  badgeRequests: BadgeRequest[];
}) {
  const [query, setQuery] = useState('');
  const [vertical, setVertical] = useState('');
  const [rel, setRel] = useState<RelFilter>('all');
  const [fund, setFund] = useState<FundFilter>('all');
  const [apiOpen, setApiOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const verticals = useMemo(() => Array.from(new Set(logos.flatMap((l) => l.verticals))).sort(), [logos]);

  const counts = useMemo(() => {
    const c = { customer: 0, partner: 0, pipeline: 0, prospect: 0, other: 0, fund: 0, fundWon: 0, vector: 0 };
    for (const l of logos) {
      c[l.salesforce.relationship] += 1;
      if (l.aiFund) c.fund += 1;
      if (l.aiFund === 'won') c.fundWon += 1;
      if (l.onLight?.endsWith('.svg') && l.onDark?.endsWith('.svg')) c.vector += 1;
    }
    return c;
  }, [logos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logos.filter((l) => {
      if (q && !`${l.name} ${l.slug} ${l.industry} ${l.salesforce.sfName ?? ''}`.toLowerCase().includes(q)) return false;
      if (vertical && !l.verticals.includes(vertical)) return false;
      if (rel !== 'all' && l.salesforce.relationship !== rel) return false;
      if (fund === 'any' && !l.aiFund) return false;
      if ((fund === 'won' || fund === 'open') && l.aiFund !== fund) return false;
      return true;
    });
  }, [logos, query, vertical, rel, fund]);

  const downloadUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (rel !== 'all') p.set('relationship', rel);
    if (fund !== 'all') p.set('aiFund', fund === 'any' ? '1' : fund);
    if (vertical) p.set('vertical', vertical);
    if (query.trim()) p.set('q', query.trim());
    const qs = p.toString();
    return `/api/logos/download${qs ? `?${qs}` : ''}`;
  }, [rel, fund, vertical, query]);

  const muted = 'text-[color:rgba(247,245,242,0.6)]';
  const eyebrow = 'font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[color:var(--color-violet-light)]';
  const select =
    'min-h-[44px] flex-1 min-w-[140px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 font-sans text-sm text-[color:var(--color-warm-white)] focus:border-[color:var(--color-violet-light)] focus:outline-none sm:flex-none';

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/[0.06] px-4 pb-8 pt-10 sm:px-6 md:px-12 md:pb-12 md:pt-16">
        <div className="mx-auto max-w-[1200px]">
          <p className={eyebrow}>Mindset Consulting · Mark Library</p>
          <h1 className="mt-3 max-w-[18ch] font-serif text-[clamp(2.1rem,5vw,3.6rem)] font-bold leading-[1.02] text-[color:var(--color-warm-white)]">
            Every logo, every badge, any format.
          </h1>
          <p className={`mt-5 max-w-[62ch] font-sans text-base leading-relaxed ${muted}`}>
            {counts.customer} customers, {counts.pipeline} in pipeline, {counts.fund} SAP AI Fund accounts, {counts.partner} partners, and our own SAP partner badges. Every mark has a light and a dark version. Ask for PNG, JPG, WebP, or SVG at any width, on any background.
          </p>
          <p className="mt-3 max-w-[62ch] font-sans text-sm leading-relaxed text-[color:rgba(247,245,242,0.45)]">
            Customer means a Closed Won deal in Salesforce. Pipeline and prospect logos are for internal decks. Never show them as clients.
          </p>
          <nav className="mt-6 flex flex-wrap gap-2">
            {[
              ['#badges', 'SAP badges', Award],
              ['#ask', 'Ask Claude', Sparkles],
              ['#logos', `Logos (${logos.length})`, Search],
            ].map(([href, label, Icon]) => {
              const I = Icon as typeof Award;
              return (
                <a
                  key={href as string}
                  href={href as string}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 font-mono text-[0.68rem] uppercase tracking-wider text-[color:var(--color-warm-white)] transition hover:border-[color:var(--color-violet-light)] hover:bg-white/[0.08]"
                >
                  <I className="h-3.5 w-3.5" /> {label as string}
                </a>
              );
            })}
          </nav>
        </div>
      </header>

      {/* SAP partner badges */}
      <section id="badges" className="scroll-mt-4 border-b border-white/[0.06] px-4 py-10 sm:px-6 md:px-12 md:py-14">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={eyebrow}>Our credentials</p>
              <h2 className="mt-2 font-serif text-[clamp(1.6rem,3vw,2.2rem)] font-semibold text-[color:var(--color-warm-white)]">SAP partner badges</h2>
            </div>
            <a
              href="/api/logos/download?set=badges"
              className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 font-mono text-[0.68rem] uppercase tracking-wider text-[color:var(--color-warm-white)] transition hover:border-[color:var(--color-violet-light)] sm:self-auto"
            >
              <Download className="h-3.5 w-3.5" /> All badges (ZIP)
            </a>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {badges
              .filter((b) => b.status === 'current')
              .map((b) => (
                <BadgeCard key={b.slug} badge={b} copied={copied} onCopy={copy} />
              ))}
          </div>
          {badgeRequests.length > 0 && (
            <p className="mt-5 font-sans text-sm text-[color:rgba(247,245,242,0.7)]">
              Coming from SAP (requested {badgeRequests[0].requested}): {badgeRequests.map((r) => r.name).join(' and ')}.
            </p>
          )}
          {badgeGaps.length > 0 && (
            <p className="mt-5 font-sans text-sm text-[color:rgba(247,245,242,0.45)]">
              Not on file: {badgeGaps.map((g) => g.name).join(', ')}. SAP PartnerEdge doesn't offer them either.
            </p>
          )}
        </div>
      </section>

      {/* Ask Claude */}
      <section id="ask" className="scroll-mt-4 border-b border-white/[0.06] px-4 py-10 sm:px-6 md:px-12 md:py-14">
        <div className="mx-auto max-w-[1200px]">
          <p className={eyebrow}>Ask Claude</p>
          <h2 className="mt-2 max-w-[24ch] font-serif text-[clamp(1.6rem,3vw,2.2rem)] font-semibold text-[color:var(--color-warm-white)]">
            Just say what you need. Claude picks the file.
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 md:p-6">
              <p className="font-sans text-sm text-[color:rgba(247,245,242,0.75)]">
                In claude.ai the <span className="text-[color:var(--color-warm-white)]">Mindset Logos</span> connector is already on for everyone at Mindset. Type any of these. Tap one to copy it.
              </p>
              <ul className="mt-4 flex flex-col gap-2">
                {PROMPTS.map((p, i) => (
                  <li key={p}>
                    <button
                      onClick={() => copy(`prompt-${i}`, p)}
                      className="group flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-[color:var(--color-ink)] px-4 py-2.5 text-left font-sans text-[0.9rem] leading-snug text-[color:var(--color-warm-white)] transition hover:border-[color:var(--color-violet-light)]"
                    >
                      <span>“{p}”</span>
                      {copied === `prompt-${i}` ? (
                        <Check className="h-4 w-4 shrink-0 text-[color:var(--color-green)]" />
                      ) : (
                        <Copy className="h-4 w-4 shrink-0 text-[color:rgba(247,245,242,0.35)] group-hover:text-[color:var(--color-warm-white)]" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 md:p-6">
                <p className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[color:var(--color-violet-light)]">
                  <Terminal className="h-3.5 w-3.5" /> Claude Code
                </p>
                <p className={`mt-2 font-sans text-sm ${muted}`}>One line, then ask the same way.</p>
                <CodeBlock label="install" code="claude mcp add --transport http mindset-logos https://mindset-logos.vercel.app/api/mcp" copied={copied} onCopy={copy} />
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 md:p-6">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[color:var(--color-violet-light)]">What it knows</p>
                <ul className={`mt-3 space-y-2 font-sans text-sm ${muted}`}>
                  <li>Formats: PNG, JPG, WebP, and SVG when we have the vector ({counts.vector} logos so far).</li>
                  <li>Any width up to 2400px. Transparent, cream, navy, white, or any hex background.</li>
                  <li>Email and slides want PNG. Outlook drops WebP.</li>
                  <li>Which logos are real customers, which are pipeline, which are AI Fund.</li>
                </ul>
              </div>
            </div>
          </div>
          <button
            onClick={() => setApiOpen((v) => !v)}
            className="mt-5 inline-flex min-h-[40px] items-center gap-2 font-mono text-[0.68rem] uppercase tracking-wider text-[color:rgba(247,245,242,0.55)] hover:text-[color:var(--color-warm-white)]"
          >
            Direct URLs and API <ChevronDown className={`h-3.5 w-3.5 transition ${apiOpen ? 'rotate-180' : ''}`} />
          </button>
          {apiOpen && (
            <CodeBlock
              label="api"
              code={`# any logo, any format, width, background
https://mindset-logos.vercel.app/api/logos/ecolab/on-light.png?w=1200
https://mindset-logos.vercel.app/api/logos/ecolab/on-dark.jpg?w=800          # flattened on navy
https://mindset-logos.vercel.app/api/logos/cargill/on-light.png?w=1600&bg=FFFFFF
https://mindset-logos.vercel.app/api/logos/anchorage/on-light.svg            # when vector

# SAP badges
https://mindset-logos.vercel.app/api/badges/sap-gold-partner-bdc-baip-expert/on-light.png?w=600
https://mindset-logos.vercel.app/api/badges/sap-apphaus-network/on-dark.png?w=1600

# lists and ZIPs
https://mindset-logos.vercel.app/api/logos
https://mindset-logos.vercel.app/api/badges
https://mindset-logos.vercel.app/api/logos/download?relationship=customer&vertical=Healthcare
https://mindset-logos.vercel.app/api/logos/download?aiFund=won
https://mindset-logos.vercel.app/api/logos/download?set=badges`}
              copied={copied}
              onCopy={copy}
            />
          )}
        </div>
      </section>

      <div id="logos" className="z-20 scroll-mt-0 sm:sticky sm:top-0 border-b border-white/[0.06] bg-[color:var(--color-ink)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-6 md:px-12">
          <div className="relative flex w-full items-center sm:min-w-[220px] sm:flex-1">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[color:rgba(247,245,242,0.4)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, industry…"
              className="min-h-[44px] w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pl-10 pr-4 font-sans text-base text-[color:var(--color-warm-white)] placeholder:text-[color:rgba(247,245,242,0.35)] focus:border-[color:var(--color-violet-light)] focus:outline-none sm:text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={rel} onChange={(e) => setRel(e.target.value as RelFilter)} className={select} aria-label="Relationship">
              <option value="all">Everyone ({logos.length})</option>
              <option value="customer">Customers ({counts.customer})</option>
              <option value="pipeline">Pipeline ({counts.pipeline})</option>
              <option value="prospect">Prospects ({counts.prospect})</option>
              <option value="partner">Partners ({counts.partner})</option>
            </select>
            <select value={fund} onChange={(e) => setFund(e.target.value as FundFilter)} className={select} aria-label="AI Fund">
              <option value="all">AI Fund: any</option>
              <option value="any">AI Fund only ({counts.fund})</option>
              <option value="won">AI Fund won ({counts.fundWon})</option>
              <option value="open">AI Fund open ({counts.fund - counts.fundWon})</option>
            </select>
            <select value={vertical} onChange={(e) => setVertical(e.target.value)} className={select} aria-label="Vertical">
              <option value="">All verticals</option>
              {verticals.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <a
              href={downloadUrl}
              title="Every logo in this filter as a ZIP: PNG at 1200px, plus SVG wherever we have the vector"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 font-mono text-[0.68rem] uppercase tracking-wider text-[color:var(--color-warm-white)] transition hover:border-[color:var(--color-violet-light)]"
            >
              <Download className="h-3.5 w-3.5" /> ZIP ({filtered.length})
            </a>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-10 md:px-12">
        {filtered.length === 0 ? (
          <div className="py-24 text-center font-mono text-sm text-[color:rgba(247,245,242,0.45)]">Nothing matches that.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((logo) => (
              <LogoRow key={logo.slug} logo={logo} />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-white/[0.06] px-4 py-6 sm:px-6 sm:py-8 md:px-12">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-2 font-mono text-[0.68rem] uppercase tracking-wider text-[color:rgba(247,245,242,0.4)]">
          <Github className="h-3.5 w-3.5" />
          <a href="https://github.com/MindsetConsulting/mindset-logos" className="text-[color:var(--color-violet-light)] hover:text-[color:var(--color-warm-white)]">
            MindsetConsulting/mindset-logos
          </a>
          <span>· Missing a logo? Ask Claude to add it.</span>
        </div>
      </footer>
    </div>
  );
}

function BadgeCard({ badge, copied, onCopy }: { badge: Badge; copied: string | null; onCopy: (k: string, t: string) => void }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const fmts = ['png', 'jpg', 'webp'] as const;
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <div className={`grid ${badge.selfContained ? 'grid-cols-1' : 'grid-cols-1'} min-h-[200px]`}>
        <div className="flex items-center justify-center bg-[#F7F5F2] px-6 py-8">
          {badge.onLight && <img src={badge.onLight} alt={badge.name} className="max-h-[170px] max-w-full object-contain" loading="lazy" decoding="async" />}
        </div>
        {!badge.selfContained && badge.onDark && (
          <div className="flex items-center justify-center px-6 py-8" style={{ background: 'linear-gradient(135deg, #0A1628, #1E3A5F)' }}>
            <img src={badge.onDark} alt={`${badge.name} on dark`} className="max-h-[110px] max-w-full object-contain" loading="lazy" decoding="async" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 border-t border-white/[0.06] p-4">
        <p className="font-serif text-lg font-semibold leading-tight text-[color:var(--color-warm-white)]">{badge.name}</p>
        <p className="font-sans text-[0.8rem] leading-snug text-[color:rgba(247,245,242,0.55)]">{badge.description}</p>
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-[color:rgba(247,245,242,0.4)]">Since {badge.since} · {badge.issuer}</p>
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-2">
          {(['on-light', ...(badge.selfContained ? [] : ['on-dark'])] as const).map((v) =>
            fmts.map((f) => {
              const key = `${badge.slug}-${v}-${f}`;
              const label = badge.selfContained ? f : `${v === 'on-light' ? 'light' : 'dark'} ${f}`;
              return (
                <button
                  key={key}
                  onClick={() => onCopy(key, `${origin}/api/badges/${badge.slug}/${v}.${f}?w=1200`)}
                  title={`Copy ${f.toUpperCase()} URL`}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded px-2 font-mono text-[0.6rem] uppercase tracking-wider text-[color:rgba(247,245,242,0.6)] transition hover:bg-white/[0.06] hover:text-[color:var(--color-warm-white)]"
                >
                  {copied === key ? <Check className="h-3 w-3 text-[color:var(--color-green)]" /> : <Copy className="h-3 w-3" />}
                  {label}
                </button>
              );
            }),
          )}
          {badge.masters && badge.masterFiles?.length ? (
            <details className="w-full">
              <summary className="inline-flex min-h-[36px] cursor-pointer items-center rounded px-2 font-mono text-[0.6rem] uppercase tracking-wider text-[color:var(--color-violet-light)] hover:text-[color:var(--color-warm-white)]">
                Print masters ({badge.masterFiles.length})
              </summary>
              <ul className="mt-1 grid grid-cols-1 gap-0.5 px-2 pb-2 sm:grid-cols-2">
                {badge.masterFiles.map((f) => (
                  <li key={f}>
                    <a href={`${badge.masters}${f}`} download className="font-mono text-[0.62rem] text-[color:rgba(247,245,242,0.65)] hover:text-[color:var(--color-warm-white)]">
                      {f}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <a
            href={`/api/badges/${badge.slug}/on-light.png?w=2400`}
            download={`${badge.slug}.png`}
            title="Download PNG"
            className="ml-auto inline-flex min-h-[36px] items-center rounded px-2 text-[color:rgba(247,245,242,0.6)] hover:bg-white/[0.06] hover:text-[color:var(--color-warm-white)]"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ label, code, copied, onCopy }: { label: string; code: string; copied: string | null; onCopy: (l: string, t: string) => void }) {
  return (
    <div className="relative mt-3 overflow-hidden rounded-lg border border-white/[0.06] bg-[color:var(--color-ink)]">
      <pre className="overflow-x-auto whitespace-pre px-4 py-3 pr-14 font-mono text-[0.72rem] leading-relaxed text-[color:rgba(247,245,242,0.85)]">{code}</pre>
      <button
        onClick={() => onCopy(label, code)}
        className="absolute right-2 top-2 flex min-h-[32px] items-center gap-1 rounded bg-[color:var(--color-ink)] px-2 font-mono text-[0.58rem] uppercase tracking-wider text-[color:rgba(247,245,242,0.55)] transition hover:bg-white/[0.06] hover:text-[color:var(--color-warm-white)]"
      >
        {copied === label ? <Check className="h-3 w-3 text-[color:var(--color-green)]" /> : <Copy className="h-3 w-3" />}
        {copied === label ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
