import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ResolvedTokens, Target } from '../tokens/schema.js';
import { renderTokensCss, renderStylesCss } from './css.js';
import { allTemplates, type ComponentFiles } from './templates.js';
import {
  renderAxeHelper,
  renderContrastWorkflow,
  renderGeneratedReadme,
  renderIndexTs,
  renderPackageJson,
  renderStorybookMain,
  renderStorybookPreview,
  renderTokenSpecYaml,
  renderTsConfig,
  renderVitestConfig,
} from './scaffold.js';
import { fallbackDocs, generateAiDocs } from '../ai/docs.js';
import { renderShadcnReadme, renderShadcnRegistryItem, renderShadcnThemeCss } from './shadcn.js';

export interface GenerateOptions {
  outDir: string;
  /** When true, docs are written by the Claude API; otherwise a static fallback. */
  aiDocs?: boolean;
  /** `react` (default): a component library. `shadcn`: a shadcn/ui + Tailwind v4 theme. */
  target?: Target;
  /** Token file name, shown in the shadcn theme's header and README. */
  source?: string;
  log?: (message: string) => void;
}

export interface GenerateResult {
  outDir: string;
  components: string[];
  files: string[];
}

export async function generate(
  tokens: ResolvedTokens,
  options: GenerateOptions,
): Promise<GenerateResult> {
  const log = options.log ?? (() => {});
  const out = options.outDir;
  const files: string[] = [];

  const write = async (relPath: string, content: string) => {
    const fullPath = join(out, relPath);
    await mkdir(join(fullPath, '..'), { recursive: true });
    await writeFile(fullPath, content, 'utf8');
    files.push(relPath);
    log(`  wrote ${relPath}`);
  };

  if (options.target === 'shadcn') {
    if (options.aiDocs) {
      throw new Error('--ai-docs is not supported with --target shadcn (there are no components to document).');
    }
    const renderOptions = { source: options.source };
    await mkdir(out, { recursive: true });
    await write('theme.css', renderShadcnThemeCss(tokens, renderOptions));
    await write('registry-item.json', renderShadcnRegistryItem(tokens));
    await write('README.md', renderShadcnReadme(tokens, renderOptions));
    return { outDir: out, components: [], files };
  }

  const src = join(out, 'src');
  const components = allTemplates(tokens);
  await mkdir(src, { recursive: true });

  await write('package.json', renderPackageJson(tokens));
  await write('tsconfig.json', renderTsConfig());
  await write('vitest.config.ts', renderVitestConfig());
  await write('README.md', renderGeneratedReadme(tokens, components));
  await write('.storybook/main.ts', renderStorybookMain());
  await write('.storybook/preview.ts', renderStorybookPreview());
  await write('.github/workflows/contrast.yml', renderContrastWorkflow());
  await write('tokens.yaml', renderTokenSpecYaml(tokens));
  await write('src/tokens.css', renderTokensCss(tokens));
  await write('src/styles.css', renderStylesCss());
  await write('src/index.ts', renderIndexTs(components));
  await write('src/testing/axe.ts', renderAxeHelper());

  for (const component of components) {
    await write(`src/${component.name}/${component.name}.tsx`, component.component);
    await write(`src/${component.name}/${component.name}.stories.tsx`, component.story);
    await write(`src/${component.name}/${component.name}.test.tsx`, component.test);
    await write(
      `src/${component.name}/${component.name}.docs.md`,
      await buildDocs(component, tokens, options, log),
    );
  }

  return { outDir: out, components: components.map((c) => c.name), files };
}

async function buildDocs(
  component: ComponentFiles,
  tokens: ResolvedTokens,
  options: GenerateOptions,
  log: (message: string) => void,
): Promise<string> {
  if (!options.aiDocs) {
    return fallbackDocs({ name: component.name, source: component.component }, tokens);
  }
  try {
    log(`  asking Claude to document ${component.name}…`);
    return await generateAiDocs({ name: component.name, source: component.component }, tokens);
  } catch (err) {
    log(
      `  ! AI docs failed for ${component.name} (${(err as Error).message}); using fallback docs`,
    );
    return fallbackDocs({ name: component.name, source: component.component }, tokens);
  }
}
