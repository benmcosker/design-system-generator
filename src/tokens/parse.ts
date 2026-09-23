import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import YAML from 'yaml';
import { tokenSpecSchema, type ResolvedTokens, type Target, type TokenSpec } from './schema.js';
import {
  bestTextOn,
  findContrastIssues,
  firstMixMeeting,
  mixHex,
  type ContrastCheck,
  type ContrastIssue,
} from './contrast.js';

export class TokenSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenSpecError';
  }
}

export class AccessibilityError extends Error {
  constructor(public readonly issues: ContrastIssue[]) {
    super(
      'Token spec fails WCAG AA contrast requirements:\n' +
        issues
          .map(
            (i) =>
              `  - ${i.pair}: ${i.foreground} on ${i.background} is ${i.ratio}:1 (needs ${i.required}:1)`,
          )
          .join('\n'),
    );
    this.name = 'AccessibilityError';
  }
}

/** Parse a JSON or YAML token spec file and validate it against the schema. */
export async function parseTokenFile(path: string): Promise<TokenSpec> {
  const raw = await readFile(path, 'utf8');
  const ext = extname(path).toLowerCase();
  let data: unknown;
  try {
    data = ext === '.json' ? JSON.parse(raw) : YAML.parse(raw);
  } catch (err) {
    throw new TokenSpecError(`Could not parse ${path}: ${(err as Error).message}`);
  }
  return parseTokens(data, path);
}

export function parseTokens(data: unknown, source = 'token spec'): TokenSpec {
  const result = tokenSpecSchema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new TokenSpecError(`Invalid ${source}:\n${details}`);
  }
  return result.data;
}

export interface ResolveOptions {
  /** Output target; `shadcn` adds the extra pairs its components use. Default `react`. */
  target?: Target;
}

/**
 * Compute derived tokens and enforce WCAG AA contrast. Throws
 * AccessibilityError when the palette cannot produce accessible
 * components — the generator refuses to emit an inaccessible system.
 *
 * Label colors come from bestTextOn() unless the spec sets an override
 * (colors.onPrimary etc.); either way they are checked against their fill.
 */
export function resolveTokens(spec: TokenSpec, options: ResolveOptions = {}): ResolvedTokens {
  const target = options.target ?? 'react';
  const { colors } = spec;
  const secondary = colors.secondary ?? colors.surface;
  const accent = colors.accent ?? colors.surface;
  const muted = colors.muted ?? colors.surface;
  const computed = {
    onPrimary: colors.onPrimary ?? bestTextOn(colors.primary),
    onDanger: colors.onDanger ?? bestTextOn(colors.danger),
    onSuccess: colors.onSuccess ?? bestTextOn(colors.success),
    onWarning: colors.onWarning ?? bestTextOn(colors.warning),
    focusRingColor: spec.focus.ringColor ?? colors.primary,
    onSecondary: colors.onSecondary ?? bestTextOn(secondary),
    onAccent: colors.onAccent ?? bestTextOn(accent),
    onMuted: bestTextOn(muted),
    secondary,
    accent,
    muted,
    border: colors.border ?? mixHex(colors.background, colors.text, 0.15),
    input: colors.input ?? firstMixMeeting(colors.background, colors.text, colors.background, 3),
    chart: colors.chart ?? [colors.primary, colors.success, colors.warning, colors.danger, colors.textMuted],
  };

  const checks: ContrastCheck[] = [
    { pair: 'text on background', foreground: colors.text, background: colors.background, required: 4.5 },
    { pair: 'text on surface', foreground: colors.text, background: colors.surface, required: 4.5 },
    { pair: 'muted text on background', foreground: colors.textMuted, background: colors.background, required: 4.5 },
    { pair: 'label on primary button', foreground: computed.onPrimary, background: colors.primary, required: 4.5 },
    { pair: 'label on danger button', foreground: computed.onDanger, background: colors.danger, required: 4.5 },
    { pair: 'danger text on background', foreground: colors.danger, background: colors.background, required: 4.5 },
    { pair: 'success text on background', foreground: colors.success, background: colors.background, required: 4.5 },
    { pair: 'primary as UI boundary', foreground: colors.primary, background: colors.background, required: 3 },
    { pair: 'focus ring on background', foreground: computed.focusRingColor, background: colors.background, required: 3 },
  ];

  // No pair checks the computed success/warning labels today, so these only
  // run when an override is set — existing specs can't gain new failures.
  if (colors.onSuccess) {
    checks.push({ pair: 'label on success', foreground: computed.onSuccess, background: colors.success, required: 4.5 });
  }
  if (colors.onWarning) {
    checks.push({ pair: 'label on warning', foreground: computed.onWarning, background: colors.warning, required: 4.5 });
  }

  if (target === 'shadcn') {
    checks.push(
      { pair: 'label on secondary', foreground: computed.onSecondary, background: secondary, required: 4.5 },
      { pair: 'label on accent', foreground: computed.onAccent, background: accent, required: 4.5 },
      { pair: 'muted text on muted', foreground: colors.textMuted, background: muted, required: 4.5 },
      { pair: 'muted text on surface', foreground: colors.textMuted, background: colors.surface, required: 4.5 },
      { pair: 'text on muted', foreground: colors.text, background: muted, required: 4.5 },
      { pair: 'input boundary', foreground: computed.input, background: colors.background, required: 3 },
      { pair: 'focus ring on surface', foreground: computed.focusRingColor, background: colors.surface, required: 3 },
      ...computed.chart.map((color, i) => ({
        pair: `chart color ${i + 1}`,
        foreground: color,
        background: colors.background,
        required: 3,
      })),
    );
  }

  const issues = findContrastIssues(checks);
  if (issues.length > 0) {
    throw new AccessibilityError(issues);
  }

  return { ...spec, computed };
}
