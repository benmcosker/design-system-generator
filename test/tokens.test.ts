import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AccessibilityError,
  parseTokenFile,
  parseTokens,
  resolveTokens,
  TokenSpecError,
} from '../src/tokens/parse.js';

const here = dirname(fileURLToPath(import.meta.url));
const examplePath = join(here, '..', 'example', 'tokens.yaml');

const validSpec = {
  name: 'acme',
  colors: {
    primary: '#1d4ed8',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    textMuted: '#475569',
    danger: '#b91c1c',
    success: '#15803d',
    warning: '#b45309',
  },
};

describe('token parsing', () => {
  it('parses the example YAML spec', async () => {
    const spec = await parseTokenFile(examplePath);
    expect(spec.name).toBe('acme');
    expect(spec.colors.primary).toBe('#1d4ed8');
    expect(spec.typography.baseSizePx).toBe(16);
  });

  it('applies defaults for omitted sections', () => {
    const spec = parseTokens(validSpec);
    expect(spec.spacing.unitPx).toBe(4);
    expect(spec.radius.md).toBe('8px');
    expect(spec.focus.ringWidthPx).toBe(3);
  });

  it('rejects invalid hex colors with a readable error', () => {
    const bad = structuredClone(validSpec);
    bad.colors.primary = 'blue';
    expect(() => parseTokens(bad)).toThrowError(TokenSpecError);
    expect(() => parseTokens(bad)).toThrowError(/colors\.primary/);
  });

  it('rejects non-kebab-case names', () => {
    expect(() => parseTokens({ ...validSpec, name: 'Acme Corp' })).toThrowError(TokenSpecError);
  });
});

describe('token resolution', () => {
  it('computes readable on-colors and focus ring', () => {
    const tokens = resolveTokens(parseTokens(validSpec));
    expect(tokens.computed.onPrimary).toBe('#ffffff');
    expect(tokens.computed.focusRingColor).toBe('#1d4ed8');
  });

  it('rejects palettes that fail WCAG AA with the failing pairs listed', () => {
    const bad = structuredClone(validSpec);
    bad.colors.textMuted = '#cbd5e1'; // light gray on white — unreadable
    let error: unknown;
    try {
      resolveTokens(parseTokens(bad));
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(AccessibilityError);
    const a11yError = error as AccessibilityError;
    expect(a11yError.message).toContain('muted text on background');
    expect(a11yError.issues.length).toBeGreaterThan(0);
    expect(a11yError.issues[0]?.required).toBe(4.5);
  });
});
