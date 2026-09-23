/**
 * WCAG 2.1 contrast math. Used at generation time to reject token specs
 * that would produce an inaccessible design system — accessibility is
 * enforced before a single component is emitted, not bolted on after.
 */

export function hexToRgb(hex: string): [number, number, number] {
  let value = hex.replace('#', '');
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const int = parseInt(value, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Pick the more readable of near-black / white for text on the given background. */
export function bestTextOn(background: string): string {
  const dark = '#111827';
  const light = '#ffffff';
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
}

/**
 * Linear mix of two hex colors in sRGB: t = 0 returns `from`, t = 1 returns `to`.
 * Channels are rounded to the nearest integer.
 */
export function mixHex(from: string, to: string, t: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return (
    '#' +
    a
      .map((channel, i) => Math.round(channel + (b[i]! - channel) * t))
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * The mix of `from` toward `to` closest to `from` (smallest t, in 1% steps)
 * whose contrast against `against` reaches `ratio`. Falls back to `to` when
 * no mix gets there.
 */
export function firstMixMeeting(from: string, to: string, against: string, ratio: number): string {
  for (let step = 0; step <= 100; step++) {
    const candidate = mixHex(from, to, step / 100);
    if (contrastRatio(candidate, against) >= ratio) return candidate;
  }
  return to;
}

export interface ContrastIssue {
  pair: string;
  foreground: string;
  background: string;
  ratio: number;
  required: number;
}

export interface ContrastCheck {
  pair: string;
  foreground: string;
  background: string;
  /** WCAG AA for normal text is 4.5:1; UI component boundaries need 3:1. */
  required: number;
}

export function findContrastIssues(checks: ContrastCheck[]): ContrastIssue[] {
  return checks
    .map((check) => ({
      ...check,
      ratio: Math.round(contrastRatio(check.foreground, check.background) * 100) / 100,
    }))
    .filter((check) => check.ratio < check.required);
}
