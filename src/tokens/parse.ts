import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import YAML from 'yaml';
import { tokenSpecSchema, type ResolvedTokens, type ThemeComputed, type TokenSpec } from './schema.js';
import { bestTextOn, findContrastIssues, type ContrastCheck, type ContrastIssue } from './contrast.js';

type Colors = TokenSpec['colors'];
type Focus = TokenSpec['focus'];

function computeThemeColors(colors: Colors, focus: Focus): ThemeComputed {
  return {
    onPrimary: bestTextOn(colors.primary),
    onDanger: bestTextOn(colors.danger),
    onSuccess: bestTextOn(colors.success),
    onWarning: bestTextOn(colors.warning),
    focusRingColor: focus.ringColor ?? colors.primary,
  };
}

/** Contrast checks for one palette. `label` prefixes each pair name (e.g. "dark: "). */
function contrastChecksFor(colors: Colors, computed: ThemeComputed, label = ''): ContrastCheck[] {
  const p = label ? `${label}: ` : '';
  return [
    { pair: `${p}text on background`, foreground: colors.text, background: colors.background, required: 4.5 },
    { pair: `${p}text on surface`, foreground: colors.text, background: colors.surface, required: 4.5 },
    { pair: `${p}muted text on background`, foreground: colors.textMuted, background: colors.background, required: 4.5 },
    { pair: `${p}label on primary button`, foreground: computed.onPrimary, background: colors.primary, required: 4.5 },
    { pair: `${p}label on danger button`, foreground: computed.onDanger, background: colors.danger, required: 4.5 },
    { pair: `${p}danger text on background`, foreground: colors.danger, background: colors.background, required: 4.5 },
    { pair: `${p}success text on background`, foreground: colors.success, background: colors.background, required: 4.5 },
    { pair: `${p}primary as UI boundary`, foreground: colors.primary, background: colors.background, required: 3 },
    { pair: `${p}focus ring on background`, foreground: computed.focusRingColor, background: colors.background, required: 3 },
  ];
}

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

/**
 * Compute derived tokens and enforce WCAG AA contrast. Throws
 * AccessibilityError when the palette cannot produce accessible
 * components — the generator refuses to emit an inaccessible system.
 */
export function resolveTokens(spec: TokenSpec): ResolvedTokens {
  const computed = computeThemeColors(spec.colors, spec.focus);
  let issues = findContrastIssues(contrastChecksFor(spec.colors, computed));

  let dark: ThemeComputed | undefined;
  if (spec.darkColors) {
    dark = computeThemeColors(spec.darkColors, spec.focus);
    issues = issues.concat(findContrastIssues(contrastChecksFor(spec.darkColors, dark, 'dark')));
  }

  if (issues.length > 0) {
    throw new AccessibilityError(issues);
  }

  return { ...spec, computed: { ...computed, dark } };
}
