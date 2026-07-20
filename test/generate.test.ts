import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseTokens, resolveTokens } from '../src/tokens/parse.js';
import { generate, type GenerateResult } from '../src/generator/generate.js';

const spec = {
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

let outDir: string;
let result: GenerateResult;

beforeAll(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'dsg-test-'));
  const tokens = resolveTokens(parseTokens(spec));
  result = await generate(tokens, { outDir, aiDocs: false });
});

afterAll(async () => {
  await rm(outDir, { recursive: true, force: true });
});

describe('generate', () => {
  it('emits all components with source, story, test, and docs', () => {
    expect(result.components).toEqual(['Button', 'TextField', 'Badge', 'Alert', 'Checkbox']);
    for (const name of result.components) {
      expect(result.files).toContain(`src/${name}/${name}.tsx`);
      expect(result.files).toContain(`src/${name}/${name}.stories.tsx`);
      expect(result.files).toContain(`src/${name}/${name}.test.tsx`);
      expect(result.files).toContain(`src/${name}/${name}.docs.md`);
    }
  });

  it('emits token values as CSS custom properties', async () => {
    const css = await readFile(join(outDir, 'src/tokens.css'), 'utf8');
    expect(css).toContain('--ds-color-primary: #1d4ed8;');
    expect(css).toContain('--ds-color-on-primary: #ffffff;');
    expect(css).toContain('--ds-focus-ring-width: 3px;');
  });

  it('generates a Button with a real button element and busy state', async () => {
    const button = await readFile(join(outDir, 'src/Button/Button.tsx'), 'utf8');
    expect(button).toContain('<button');
    expect(button).toContain("type = 'button'");
    expect(button).toContain('aria-busy');
  });

  it('generates a TextField with a wired label and described-by plumbing', async () => {
    const field = await readFile(join(outDir, 'src/TextField/TextField.tsx'), 'utf8');
    expect(field).toContain('htmlFor={id}');
    expect(field).toContain('aria-describedby');
    expect(field).toContain('aria-invalid');
    expect(field).toContain('aria-live="polite"');
  });

  it('generates an Alert whose role depends on severity', async () => {
    const alert = await readFile(join(outDir, 'src/Alert/Alert.tsx'), 'utf8');
    expect(alert).toContain(`tone === 'danger' ? 'alert' : 'status'`);
  });

  it('generates a Checkbox with a wired label and optional description', async () => {
    const checkbox = await readFile(join(outDir, 'src/Checkbox/Checkbox.tsx'), 'utf8');
    expect(checkbox).toContain("type=\"checkbox\"");
    expect(checkbox).toContain('htmlFor={id}');
    expect(checkbox).toContain('aria-describedby');
  });

  it('emits an axe-core test per component', async () => {
    const test = await readFile(join(outDir, 'src/Badge/Badge.test.tsx'), 'utf8');
    expect(test).toContain('expectNoAxeViolations');
  });

  it('emits a publishable package.json with storybook and test scripts', async () => {
    const pkg = JSON.parse(await readFile(join(outDir, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('acme-design-system');
    expect(pkg.scripts.test).toBe('vitest run');
    expect(pkg.scripts.storybook).toContain('storybook dev');
    expect(pkg.devDependencies['axe-core']).toBeDefined();
  });

  it('writes fallback docs when AI docs are disabled', async () => {
    const docs = await readFile(join(outDir, 'src/Button/Button.docs.md'), 'utf8');
    expect(docs).toContain('# Button');
    expect(docs).toContain('--ai-docs');
  });
});
