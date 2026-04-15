'use client';

import { useState } from 'react';
import { Copy, Check, Download, ExternalLink } from 'lucide-react';
import type { AccountType, Logo, LogoStatus, VariantQuality } from '@/lib/logos';

type Props = { logo: Logo };

type Variant = 'on-light' | 'on-dark';

const FORMATS = ['png', 'webp', 'jpg', 'svg'] as const;
type Format = (typeof FORMATS)[number];

const TYPE_STYLES: Record<AccountType, { label: string; bg: string; fg: string; dot: string }> = {
  customer: {
    label: 'Customer',
    bg: 'bg-[color:rgba(124,109,242,0.12)]',
    fg: 'text-[color:var(--color-violet-light)]',
    dot: 'bg-[color:var(--color-violet-light)]',
  },
  partner: {
    label: 'Partner',
    bg: 'bg-[color:rgba(97,189,120,0.12)]',
    fg: 'text-[color:rgb(134,239,172)]',
    dot: 'bg-[color:rgb(134,239,172)]',
  },
  prospect: {
    label: 'Prospect',
    bg: 'bg-[color:rgba(234,179,8,0.12)]',
    fg: 'text-[color:rgb(250,204,21)]',
    dot: 'bg-[color:rgb(250,204,21)]',
  },
  self: {
    label: 'Mindset',
    bg: 'bg-[color:rgba(247,245,242,0.08)]',
    fg: 'text-[color:var(--color-warm-white)]',
    dot: 'bg-[color:var(--color-warm-white)]',
  },
  other: {
    label: 'Other',
    bg: 'bg-[color:rgba(247,245,242,0.05)]',
    fg: 'text-[color:rgba(247,245,242,0.55)]',
    dot: 'bg-[color:rgba(247,245,242,0.55)]',
  },
};

function TypePill({ type, rawType }: { type: AccountType; rawType: string | null }) {
  const s = TYPE_STYLES[type];
  const title = rawType && rawType !== s.label ? `Salesforce type: ${rawType}` : `Salesforce type: ${s.label}`;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-wider ${s.bg} ${s.fg}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

const STATUS_STYLES: Record<LogoStatus, { label: string; bg: string; fg: string; dot: string }> = {
  'all-good': {
    label: 'Ready',
    bg: 'bg-[color:rgba(34,197,94,0.08)]',
    fg: 'text-[color:rgb(74,222,128)]',
    dot: 'bg-[color:rgb(74,222,128)]',
  },
  partial: {
    label: 'Partial',
    bg: 'bg-[color:rgba(234,179,8,0.08)]',
    fg: 'text-[color:rgb(250,204,21)]',
    dot: 'bg-[color:rgb(250,204,21)]',
  },
  broken: {
    label: 'Broken',
    bg: 'bg-[color:rgba(239,68,68,0.08)]',
    fg: 'text-[color:rgb(248,113,113)]',
    dot: 'bg-[color:rgb(248,113,113)]',
  },
};

function StatusPill({ status, pending }: { status: LogoStatus; pending: boolean }) {
  const s = STATUS_STYLES[status];
  const label = pending ? 'Pending review' : s.label;
  return (
    <span
      title={pending ? 'Awaiting visual approval' : `Audit status: ${s.label}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-wider ${s.bg} ${s.fg}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}

const QUALITY_LABEL: Record<VariantQuality, string> = {
  good: 'good',
  icon: 'icon',
  flat: 'flat',
  tiny: 'tiny',
  missing: 'missing',
};

function QualityTag({ quality }: { quality: VariantQuality }) {
  if (quality === 'good') return null;
  return (
    <span
      title={`Audit flagged this variant as "${quality}"`}
      className="rounded bg-[color:rgba(234,179,8,0.12)] px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider text-[color:rgb(250,204,21)]"
    >
      {QUALITY_LABEL[quality]}
    </span>
  );
}

export default function LogoRow({ logo }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="group grid grid-cols-1 md:grid-cols-[220px_1fr_1fr] gap-0 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015] transition hover:border-white/[0.14]">
      <div className="flex flex-col justify-center gap-1.5 border-b border-white/[0.06] px-5 py-4 md:border-b-0 md:border-r md:py-5">
        <p className="font-serif text-lg font-semibold leading-tight text-[color:var(--color-warm-white)]">
          {logo.name}
        </p>
        <p className="font-mono text-[0.62rem] uppercase tracking-wider text-[color:rgba(247,245,242,0.45)]">
          {logo.slug} · {logo.industry}
        </p>
        {logo.hq?.display && (
          <p className="font-sans text-[0.72rem] text-[color:rgba(247,245,242,0.55)]">
            {logo.hq.display}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <TypePill type={logo.salesforce.type} rawType={logo.salesforce.rawType} />
          {(logo.status !== 'all-good' || logo.pendingApproval) && (
            <StatusPill status={logo.status} pending={logo.pendingApproval} />
          )}
        </div>
        <a
          href={logo.website}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 font-mono text-[0.62rem] text-[color:var(--color-violet-light)] hover:text-[color:var(--color-warm-white)]"
        >
          {logo.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
      <VariantCell
        slug={logo.slug}
        variant="on-light"
        src={logo.onLight}
        quality={logo.onLightQuality}
        bgStyle="#F7F5F2"
        origin={origin}
        copied={copied}
        onCopy={copy}
      />
      <div className="border-t border-white/[0.06] md:border-t-0 md:border-l">
        <VariantCell
          slug={logo.slug}
          variant="on-dark"
          src={logo.onDark}
          quality={logo.onDarkQuality}
          bgStyle="linear-gradient(135deg, #0A1628, #1E3A5F)"
          origin={origin}
          copied={copied}
          onCopy={copy}
        />
      </div>
    </div>
  );
}

function VariantCell({
  slug,
  variant,
  src,
  quality,
  bgStyle,
  origin,
  copied,
  onCopy,
}: {
  slug: string;
  variant: Variant;
  src: string | null;
  quality: VariantQuality;
  bgStyle: string;
  origin: string;
  copied: string | null;
  onCopy: (label: string, text: string) => void;
}) {
  if (!src) {
    return (
      <div className="flex h-full items-center justify-center bg-white/[0.02] font-mono text-[0.65rem] uppercase text-[color:rgba(247,245,242,0.3)]">
        missing
      </div>
    );
  }

  const sourceExt = (src.split('.').pop() ?? '').toLowerCase();
  const svgAvailable = sourceExt === 'svg';
  const filename = src.split('/').pop() ?? 'logo';

  const urlFor = (format: Format) =>
    `${origin}/api/logos/${slug}/${variant}.${format}`;

  return (
    <div className="relative flex h-full flex-col">
      <div
        className="flex flex-1 items-center justify-center px-6 py-6"
        style={{ background: bgStyle, minHeight: '140px' }}
      >
        <img
          src={src}
          alt={variant}
          className="max-h-[92px] max-w-[80%] object-contain"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-white/[0.06] bg-[color:var(--color-ink)] px-3 py-2">
        <span className="flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-wider text-[color:rgba(247,245,242,0.4)]">
          {variant}
          <QualityTag quality={quality} />
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {FORMATS.map((fmt) => {
            const enabled = fmt !== 'svg' || svgAvailable;
            const key = `${slug}-${variant}-${fmt}`;
            const isCopied = copied === key;
            return (
              <button
                key={fmt}
                disabled={!enabled}
                onClick={() => enabled && onCopy(key, urlFor(fmt))}
                title={
                  enabled
                    ? `Copy ${fmt.toUpperCase()} URL`
                    : `SVG not available (source is ${sourceExt.toUpperCase()})`
                }
                className={`flex items-center gap-1 rounded px-1.5 py-1 font-mono text-[0.58rem] uppercase tracking-wider transition ${
                  enabled
                    ? 'text-[color:rgba(247,245,242,0.55)] hover:bg-white/[0.06] hover:text-[color:var(--color-warm-white)]'
                    : 'cursor-not-allowed text-[color:rgba(247,245,242,0.2)]'
                }`}
              >
                {isCopied ? (
                  <>
                    <Check className="h-3 w-3 text-[color:var(--color-green)]" />
                    {fmt}
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    {fmt}
                  </>
                )}
              </button>
            );
          })}
          <a
            href={src}
            download={filename}
            title="Download original source file"
            className="ml-1 flex items-center gap-1 rounded px-2 py-1 font-mono text-[0.58rem] uppercase tracking-wider text-[color:rgba(247,245,242,0.55)] transition hover:bg-white/[0.06] hover:text-[color:var(--color-warm-white)]"
          >
            <Download className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
