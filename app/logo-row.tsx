'use client';

import { useState } from 'react';
import { Copy, Check, Download, ExternalLink } from 'lucide-react';
import type { Logo } from '@/lib/logos';

type Props = { logo: Logo };

export default function LogoRow({ logo }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="group grid grid-cols-[220px_1fr_1fr] gap-0 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015] transition hover:border-white/[0.14]">
      <div className="flex flex-col justify-center gap-1.5 border-r border-white/[0.06] px-5 py-5">
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
      <Variant
        label="on-light"
        src={logo.onLight}
        bgStyle="#F7F5F2"
        origin={origin}
        copied={copied}
        onCopy={copy}
      />
      <div className="border-l border-white/[0.06]">
        <Variant
          label="on-dark"
          src={logo.onDark}
          bgStyle="linear-gradient(135deg, #0A1628, #1E3A5F)"
          origin={origin}
          copied={copied}
          onCopy={copy}
        />
      </div>
    </div>
  );
}

function Variant({
  label,
  src,
  bgStyle,
  origin,
  copied,
  onCopy,
}: {
  label: string;
  src: string | null;
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
  const key = `${src}`;
  const fullUrl = `${origin}${src}`;
  const filename = src.split('/').pop() ?? 'logo';
  return (
    <div className="relative flex h-full flex-col">
      <div
        className="flex flex-1 items-center justify-center px-6 py-6"
        style={{ background: bgStyle, minHeight: '140px' }}
      >
        <img
          src={src}
          alt={label}
          className="max-h-[92px] max-w-[80%] object-contain"
        />
      </div>
      <div className="flex items-center justify-between border-t border-white/[0.06] bg-[color:var(--color-ink)] px-3 py-2">
        <span className="font-mono text-[0.6rem] uppercase tracking-wider text-[color:rgba(247,245,242,0.4)]">
          {label}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onCopy(`${key}-url`, fullUrl)}
            title="Copy URL"
            className="flex items-center gap-1 rounded px-2 py-1 font-mono text-[0.58rem] uppercase tracking-wider text-[color:rgba(247,245,242,0.55)] transition hover:bg-white/[0.06] hover:text-[color:var(--color-warm-white)]"
          >
            {copied === `${key}-url` ? (
              <>
                <Check className="h-3 w-3 text-[color:var(--color-green)]" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy URL
              </>
            )}
          </button>
          <a
            href={src}
            download={filename}
            title="Download"
            className="flex items-center gap-1 rounded px-2 py-1 font-mono text-[0.58rem] uppercase tracking-wider text-[color:rgba(247,245,242,0.55)] transition hover:bg-white/[0.06] hover:text-[color:var(--color-warm-white)]"
          >
            <Download className="h-3 w-3" /> Download
          </a>
        </div>
      </div>
    </div>
  );
}
