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
    expect(result.components).toEqual([
      'Button',
      'TextField',
      'Badge',
      'Alert',
      'Checkbox',
      'Switch',
      'RadioGroup',
      'Select',
      'Tabs',
      'IconButton',
      'Heading',
    ]);
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
    expect(css).toContain('--ds-font-size-2xl:');
    expect(css).toContain('--ds-font-size-3xl:');
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

  it('generates a Switch with role=switch and a wired label', async () => {
    const switchComponent = await readFile(join(outDir, 'src/Switch/Switch.tsx'), 'utf8');
    expect(switchComponent).toContain('role="switch"');
    expect(switchComponent).toContain('htmlFor={id}');
  });

  it('generates a RadioGroup as a native fieldset/legend with shared name', async () => {
    const radioGroup = await readFile(join(outDir, 'src/RadioGroup/RadioGroup.tsx'), 'utf8');
    expect(radioGroup).toContain('<fieldset');
    expect(radioGroup).toContain('<legend');
    expect(radioGroup).toContain('type="radio"');
  });

  it('generates a Select with a wired label, options, and aria-invalid', async () => {
    const select = await readFile(join(outDir, 'src/Select/Select.tsx'), 'utf8');
    expect(select).toContain('<select');
    expect(select).toContain('htmlFor={id}');
    expect(select).toContain('aria-invalid');
  });

  it('generates Tabs with the WAI-ARIA tablist/tab/tabpanel roles and roving tabindex', async () => {
    const tabs = await readFile(join(outDir, 'src/Tabs/Tabs.tsx'), 'utf8');
    expect(tabs).toContain('role="tablist"');
    expect(tabs).toContain('role="tab"');
    expect(tabs).toContain('role="tabpanel"');
    expect(tabs).toContain('aria-selected');
    expect(tabs).toContain("tabIndex={isActive ? 0 : -1}");
  });

  it('generates an IconButton with a required, non-optional aria-label prop', async () => {
    const iconButton = await readFile(join(outDir, 'src/IconButton/IconButton.tsx'), 'utf8');
    expect(iconButton).toContain("'aria-label': string;");
    expect(iconButton).not.toContain("'aria-label'?: string;");
    expect(iconButton).toContain('aria-label={ariaLabel}');
  });

  it('generates a Heading rendering the matching native h1-h6 element', async () => {
    const heading = await readFile(join(outDir, 'src/Heading/Heading.tsx'), 'utf8');
    expect(heading).toContain("React.createElement('h' + level");
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
    expect(pkg.devDependencies['@testing-library/user-event']).toBeDefined();
  });

  it('emits a package.json with the contrast check script and the generator as a devDependency', async () => {
    const pkg = JSON.parse(await readFile(join(outDir, 'package.json'), 'utf8'));
    expect(pkg.scripts.check).toBe('dsg check tokens.yaml');
    expect(pkg.devDependencies['@benjaminmcosker/design-system-generator']).toBeDefined();
  });

  it('emits a non-overridable contrast CI gate', async () => {
    expect(result.files).toContain('.github/workflows/contrast.yml');
    const workflow = await readFile(join(outDir, '.github/workflows/contrast.yml'), 'utf8');
    expect(workflow).toContain('pull_request');
    expect(workflow).toContain('npx dsg check tokens.yaml');
    expect(workflow).not.toContain('continue-on-error:');
  });

  it('emits the source token spec as tokens.yaml', async () => {
    expect(result.files).toContain('tokens.yaml');
    const tokensYaml = await readFile(join(outDir, 'tokens.yaml'), 'utf8');
    expect(tokensYaml).toContain('name: acme');
    expect(tokensYaml).toContain('#1d4ed8');
    expect(tokensYaml).not.toContain('computed');
  });

  it("documents the no-override branch protection setup in the generated README", async () => {
    const readme = await readFile(join(outDir, 'README.md'), 'utf8');
    expect(readme).toContain('Enforce the gate (no override)');
    expect(readme).toContain('gh api');
    expect(readme).toContain('enforce_admins=true');
  });

  it('writes fallback docs when AI docs are disabled', async () => {
    const docs = await readFile(join(outDir, 'src/Button/Button.docs.md'), 'utf8');
    expect(docs).toContain('# Button');
    expect(docs).toContain('--ai-docs');
  });
});
