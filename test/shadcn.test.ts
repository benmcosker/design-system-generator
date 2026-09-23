import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccessibilityError, parseTokenFile, parseTokens, resolveTokens } from '../src/tokens/parse.js';
import { contrastRatio, firstMixMeeting, mixHex } from '../src/tokens/contrast.js';
import { renderTokensCss } from '../src/generator/css.js';
import {
  renderShadcnRegistryItem,
  renderShadcnThemeCss,
  shadcnRootVars,
  stripShadcnHeader,
} from '../src/generator/shadcn.js';
import { generate } from '../src/generator/generate.js';
import { renderTokenSpecYaml } from '../src/generator/scaffold.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const examplePath = join(root, 'example', 'tokens.yaml');

const lightSpec = {
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

/** A pure-red brand on black: accessible with black labels, but not with bestTextOn()'s #111827. */
const redSpec = {
  name: 'crimson',
  colors: {
    primary: '#ff0000',
    background: '#000000',
    surface: '#0e0e0e',
    text: '#ffffff',
    textMuted: '#c8c8c8',
    danger: '#ff0000',
    success: '#4ade80',
    warning: '#fbbf24',
  },
};

function issuePairs(fn: () => unknown): string[] {
  try {
    fn();
  } catch (err) {
    if (err instanceof AccessibilityError) return err.issues.map((i) => i.pair);
    throw err;
  }
  return [];
}

describe('mix helpers', () => {
  it('mixes linearly between two colors', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#ffffff', '#0f172a', 0.15)).toBe('#dbdcdf');
  });

  it('finds the mix closest to the start that meets a ratio, on light and dark backgrounds', () => {
    const onLight = firstMixMeeting('#ffffff', '#0f172a', '#ffffff', 3);
    expect(contrastRatio(onLight, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(mixHex('#ffffff', '#0f172a', 0.4), '#ffffff')).toBeLessThan(3);

    const onDark = firstMixMeeting('#000000', '#ffffff', '#000000', 3);
    expect(contrastRatio(onDark, '#000000')).toBeGreaterThanOrEqual(3);
  });

  it('falls back to the end color when no mix gets there', () => {
    expect(firstMixMeeting('#ffffff', '#eeeeee', '#ffffff', 3)).toBe('#eeeeee');
  });
});

describe('optional tokens', () => {
  it('resolves every optional color for a minimal spec', () => {
    const { computed } = resolveTokens(parseTokens(lightSpec), { target: 'shadcn' });
    expect(computed.secondary).toBe('#f8fafc');
    expect(computed.accent).toBe('#f8fafc');
    expect(computed.muted).toBe('#f8fafc');
    expect(computed.border).toBe('#dbdcdf');
    expect(contrastRatio(computed.input, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(computed.chart).toEqual(['#1d4ed8', '#15803d', '#b45309', '#b91c1c', '#475569']);
  });

  it('keeps explicit optional colors', () => {
    const spec = parseTokens({ ...lightSpec, colors: { ...lightSpec.colors, accent: '#eef2ff', chart: ['#1d4ed8'] } });
    const { computed } = resolveTokens(spec, { target: 'shadcn' });
    expect(computed.accent).toBe('#eef2ff');
    expect(computed.chart).toEqual(['#1d4ed8']);
  });

  it('rejects more than five chart colors', () => {
    const chart = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666'];
    expect(() => parseTokens({ ...lightSpec, colors: { ...lightSpec.colors, chart } })).toThrowError(/chart/);
  });

  it('does not add unset optional keys to the serialized spec', () => {
    const yaml = renderTokenSpecYaml(resolveTokens(parseTokens(lightSpec)));
    expect(yaml).not.toMatch(/secondary|onPrimary|chart/);
  });
});

describe('shadcn contrast pairs', () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['label on secondary', { secondary: '#1d4ed8', onSecondary: '#0f172a' }],
    ['label on accent', { accent: '#b91c1c', onAccent: '#111827' }],
    ['muted text on muted', { muted: '#94a3b8' }],
    ['text on muted', { muted: '#1e293b', textMuted: '#475569' }],
    ['input boundary', { input: '#e5e7eb' }],
    ['chart color 1', { chart: ['#e5e7eb'] }],
  ];

  for (const [pair, overrides] of cases) {
    it(`fails "${pair}" when it is too low`, () => {
      const spec = parseTokens({ ...lightSpec, colors: { ...lightSpec.colors, ...overrides } });
      expect(issuePairs(() => resolveTokens(spec, { target: 'shadcn' }))).toContain(pair);
    });
  }

  it('fails "muted text on surface" and "focus ring on surface" on a dark surface', () => {
    const spec = parseTokens({ ...lightSpec, colors: { ...lightSpec.colors, surface: '#1d4ed8' } });
    const pairs = issuePairs(() => resolveTokens(spec, { target: 'shadcn' }));
    expect(pairs).toContain('muted text on surface');
    expect(pairs).toContain('focus ring on surface');
  });

  it('does not run shadcn pairs for the react target', () => {
    const spec = parseTokens({ ...lightSpec, colors: { ...lightSpec.colors, muted: '#94a3b8' } });
    expect(() => resolveTokens(spec)).not.toThrow();
    expect(issuePairs(() => resolveTokens(spec, { target: 'shadcn' }))).toContain('muted text on muted');
  });

  it('passes the example tokens', async () => {
    const spec = await parseTokenFile(examplePath);
    expect(() => resolveTokens(spec, { target: 'shadcn' })).not.toThrow();
  });
});

describe('label-color overrides', () => {
  it('fails a pure-red primary without an override (#111827 on #ff0000 is 4.44:1)', () => {
    const pairs = issuePairs(() => resolveTokens(parseTokens(redSpec)));
    expect(pairs).toContain('label on primary button');
  });

  it('passes with onPrimary/onDanger set to black, on both targets', () => {
    const spec = parseTokens({ ...redSpec, colors: { ...redSpec.colors, onPrimary: '#000000', onDanger: '#000000' } });
    const react = resolveTokens(spec);
    expect(react.computed.onPrimary).toBe('#000000');
    expect(renderTokensCss(react)).toContain('--ds-color-on-primary: #000000;');

    const shadcn = resolveTokens(spec, { target: 'shadcn' });
    expect(renderShadcnThemeCss(shadcn)).toContain('--primary-foreground: #000000;');
  });

  it('rejects a failing override and names its value', () => {
    const spec = parseTokens({ ...redSpec, colors: { ...redSpec.colors, onPrimary: '#444444' } });
    let error: unknown;
    try {
      resolveTokens(spec);
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(AccessibilityError);
    expect((error as Error).message).toContain('label on primary button: #444444 on #ff0000');
  });

  it('checks success/warning labels only when overridden', () => {
    expect(issuePairs(() => resolveTokens(parseTokens(lightSpec)))).not.toContain('label on success');
    const spec = parseTokens({ ...lightSpec, colors: { ...lightSpec.colors, onSuccess: '#0f172a' } });
    expect(issuePairs(() => resolveTokens(spec))).toContain('label on success');
  });

  it('leaves resolution unchanged when no override is set', () => {
    const { computed } = resolveTokens(parseTokens(lightSpec));
    expect(computed.onPrimary).toBe('#ffffff');
    expect(computed.onDanger).toBe('#ffffff');
  });
});

describe('shadcn emitter', () => {
  it('emits every mapped variable exactly once, plus the Tailwind bridge', async () => {
    const tokens = resolveTokens(await parseTokenFile(examplePath), { target: 'shadcn' });
    const css = renderShadcnThemeCss(tokens, { source: 'tokens.yaml' });
    for (const [name, value] of shadcnRootVars(tokens)) {
      const matches = css.match(new RegExp(`^  --${name}: `, 'gm')) ?? [];
      expect(matches, name).toHaveLength(1);
      expect(css).toContain(`  --${name}: ${value};`);
    }
    expect(css).toContain('@theme inline {');
    expect(css).toContain('--color-primary-foreground: var(--primary-foreground);');
    expect(css).toContain('--radius-md: 8px;');
    expect(css).toContain('--font-sans: ');
    expect(css).toMatchSnapshot();
  });

  it('writes a registry item with the expected shape', async () => {
    const tokens = resolveTokens(await parseTokenFile(examplePath), { target: 'shadcn' });
    const item = JSON.parse(renderShadcnRegistryItem(tokens));
    expect(item.type).toBe('registry:theme');
    expect(item.name).toBe('acme-theme');
    expect(item.cssVars.light.primary).toBe('#1d4ed8');
    expect(item.cssVars.theme['color-primary']).toBe('var(--primary)');
  });

  it('ignores only the header when comparing themes', () => {
    const tokens = resolveTokens(parseTokens(lightSpec), { target: 'shadcn' });
    const a = renderShadcnThemeCss(tokens, { source: 'a.yaml' });
    const b = renderShadcnThemeCss(tokens, { source: 'b.yaml' });
    expect(a).not.toBe(b);
    expect(stripShadcnHeader(a)).toBe(stripShadcnHeader(b));
  });

  it('refuses --ai-docs for the shadcn target', async () => {
    const tokens = resolveTokens(parseTokens(lightSpec), { target: 'shadcn' });
    await expect(generate(tokens, { outDir: join(tmpdir(), 'dsg-unused'), target: 'shadcn', aiDocs: true })).rejects.toThrow(
      /not supported with --target shadcn/,
    );
  });
});

describe('CLI: generate --target shadcn and check --theme', () => {
  const cli = join(root, 'dist', 'cli.js');
  let dir: string;
  let tokensPath: string;
  const run = (...args: string[]) => spawnSync('node', [cli, ...args], { encoding: 'utf8' });

  beforeAll(() => {
    // These tests exercise the built CLI, exactly as users run it.
    const build = spawnSync('npm', ['run', 'build', '--silent'], { cwd: root, encoding: 'utf8' });
    if (build.status !== 0) throw new Error(build.stderr || build.stdout);
    dir = mkdtempSync(join(tmpdir(), 'dsg-shadcn-'));
    tokensPath = join(dir, 'tokens.yaml');
    writeFileSync(tokensPath, readFileSync(examplePath, 'utf8'));
    const result = run('generate', tokensPath, '--target', 'shadcn', '-o', join(dir, 'out'));
    if (result.status !== 0) throw new Error(result.stderr);
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('writes theme.css, registry-item.json and README.md', () => {
    for (const file of ['theme.css', 'registry-item.json', 'README.md']) {
      expect(readFileSync(join(dir, 'out', file), 'utf8').length).toBeGreaterThan(0);
    }
    expect(readFileSync(join(dir, 'out', 'README.md'), 'utf8')).toContain('ring-ring/50');
  });

  it('passes the drift check on a fresh theme', () => {
    const result = run('check', tokensPath, '--theme', join(dir, 'out', 'theme.css'));
    expect(result.status).toBe(0);
  });

  it('ignores header-only differences', () => {
    const edited = join(dir, 'header.css');
    const css = readFileSync(join(dir, 'out', 'theme.css'), 'utf8');
    writeFileSync(edited, css.replace('do not edit by hand', 'edited header'));
    expect(run('check', tokensPath, '--theme', edited).status).toBe(0);
  });

  it('fails with a diff when a color is edited by hand', () => {
    const edited = join(dir, 'edited.css');
    const css = readFileSync(join(dir, 'out', 'theme.css'), 'utf8');
    writeFileSync(edited, css.replace('--primary: #1d4ed8;', '--primary: #60a5fa;'));
    const result = run('check', tokensPath, '--theme', edited);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('-  --primary: #1d4ed8;');
    expect(result.stderr).toContain('+  --primary: #60a5fa;');
    expect(result.stderr).toContain('Theme file has drifted from tokens');
  });

  it('reports a contrast failure, not a diff, when the tokens themselves fail', () => {
    const bad = join(dir, 'bad.yaml');
    writeFileSync(bad, readFileSync(examplePath, 'utf8').replace('"#475569"', '"#cbd5e1"'));
    const result = run('check', bad, '--theme', join(dir, 'out', 'theme.css'));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('fails WCAG AA contrast');
    expect(result.stderr).not.toContain('drifted');
  });

  it('rejects --ai-docs with --target shadcn', () => {
    const result = run('generate', tokensPath, '--target', 'shadcn', '--ai-docs', '-o', join(dir, 'x'));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('not supported with --target shadcn');
  });
});
