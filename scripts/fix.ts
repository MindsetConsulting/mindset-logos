#!/usr/bin/env bun
// Auto-repairs problematic logo variants. Produces a side-by-side fix candidate
// that the user can approve in the preview page.
//
// Fix strategies:
//   flat  → flood-fill corner-sampled background color → transparent PNG
//   icon  → take the opposite theme's file (if good), invert colors via magick
//   tiny  → upscale 2x with Lanczos filter + unsharpen mask
//   missing → no fix, skipped
//
// Fixes go to fixes/{slug}-{variant}-fixed.png so the original stays untouched.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const CLIENTS_DIR = join(process.cwd(), "public", "logos");
const FIXES_DIR = join(CLIENTS_DIR, 'fixes');
const AUDIT_PATH = join(CLIENTS_DIR, 'audit.json');

if (!existsSync(FIXES_DIR)) mkdirSync(FIXES_DIR, { recursive: true });

type VariantQuality = 'good' | 'icon' | 'flat' | 'tiny' | 'missing';
type VariantInfo = { file: string | null; width: number; height: number; hasAlpha: boolean; aspectRatio: number; quality: VariantQuality };
type CustomerAudit = { slug: string; name: string; industry: string; onLight: VariantInfo; onDark: VariantInfo; status: string };

function magick(...args: string[]): boolean {
  const res = spawnSync('magick', args, { encoding: 'utf-8' });
  if (res.status !== 0) {
    console.error(`  magick failed: ${args.join(' ')}\n  ${res.stderr}`);
    return false;
  }
  return true;
}

// Flood-fill background removal. Samples the top-left corner, fuzzes with
// tolerance, fills with transparent, then trims and re-pads slightly.
function fixFlat(inputPath: string, outputPath: string): boolean {
  return magick(
    inputPath,
    '-alpha', 'on',
    '-bordercolor', 'none',
    '-border', '1',
    '-fill', 'none',
    '-fuzz', '12%',
    '-floodfill', '+0+0', 'white',
    '-floodfill', '+1+1', 'white',
    '-shave', '1x1',
    '-trim', '+repage',
    '-bordercolor', 'none',
    '-border', '6',
    outputPath,
  );
}

// Invert colors of the opposite-theme file to produce the missing variant.
// E.g. if onDark is just an icon but onLight has a great wordmark, we can
// invert the onLight → produces a white-on-transparent for dark BGs.
function fixByInvertingOther(otherPath: string, outputPath: string): boolean {
  return magick(otherPath, '-alpha', 'on', '-channel', 'RGB', '-negate', '+channel', outputPath);
}

// Upscale tiny logos 2x with lanczos + mild sharpen.
function fixTiny(inputPath: string, outputPath: string): boolean {
  return magick(inputPath, '-filter', 'Lanczos', '-resize', '200%', '-unsharp', '0x0.75+0.75+0.008', outputPath);
}

function ext(file: string): string {
  return file.split('.').pop() ?? 'png';
}

type Fix = { path: string | null; strategy: string };

function attemptFix(
  slug: string,
  variant: 'on-light' | 'on-dark',
  current: VariantInfo,
  other: VariantInfo,
): Fix {
  if (current.quality === 'good' || current.quality === 'missing' || !current.file) {
    return { path: null, strategy: 'none' };
  }
  const inputPath = join(CLIENTS_DIR, current.file);
  const outputName = `${slug}-${variant}-fixed.png`;
  const outputPath = join(FIXES_DIR, outputName);

  let success = false;
  let strategy = '';

  if (current.quality === 'flat') {
    strategy = 'flood-fill corners';
    success = fixFlat(inputPath, outputPath);
  } else if (current.quality === 'icon') {
    // Try inverting the OTHER variant if it's good
    if (other.quality === 'good' && other.file) {
      strategy = `invert ${variant === 'on-light' ? 'on-dark' : 'on-light'}`;
      success = fixByInvertingOther(join(CLIENTS_DIR, other.file), outputPath);
    } else if (current.file) {
      // Fall back to flood-filling the icon's bg (often has alpha already, but try anyway)
      strategy = 'flood-fill corners';
      success = fixFlat(inputPath, outputPath);
    }
  } else if (current.quality === 'tiny') {
    strategy = 'upscale 2x lanczos';
    success = fixTiny(inputPath, outputPath);
  }

  if (success && existsSync(outputPath)) {
    return { path: `fixes/${outputName}`, strategy };
  }
  return { path: null, strategy: `${strategy} (failed)` };
}

const audit = JSON.parse(readFileSync(AUDIT_PATH, 'utf-8')) as { counts: any; audits: CustomerAudit[] };

let fixCount = 0;
let skipCount = 0;

for (const a of audit.audits) {
  if (a.status === 'all-good') continue;

  const fixLight = attemptFix(a.slug, 'on-light', a.onLight, a.onDark);
  const fixDark = attemptFix(a.slug, 'on-dark', a.onDark, a.onLight);

  // Attach to audit record
  (a as any).fixLight = fixLight;
  (a as any).fixDark = fixDark;

  if (fixLight.path) fixCount++;
  if (fixDark.path) fixCount++;
  if (a.onLight.quality !== 'good' && !fixLight.path) skipCount++;
  if (a.onDark.quality !== 'good' && !fixDark.path) skipCount++;
}

writeFileSync(AUDIT_PATH, JSON.stringify(audit, null, 2));

console.log(`[fix] Generated ${fixCount} fix candidates  (${skipCount} variants skipped — no strategy)`);
