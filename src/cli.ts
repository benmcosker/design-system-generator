#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { Command, Option } from 'commander';
import { parseTokenFile, resolveTokens, AccessibilityError, TokenSpecError } from './tokens/parse.js';
import type { Target } from './tokens/schema.js';
import { generate } from './generator/generate.js';
import { renderShadcnThemeCss, stripShadcnHeader } from './generator/shadcn.js';
import { unifiedDiff } from './diff.js';

const targetOption = () =>
  new Option('--target <target>', 'output target: react (component library) or shadcn (shadcn/ui + Tailwind v4 theme)')
    .choices(['react', 'shadcn'])
    .default('react');

const program = new Command();

program
  .name('dsg')
  .description(
    'Generate an accessible React + TypeScript component library from a design-token spec.',
  )
  .version('0.0.0-development');

program
  .command('generate')
  .argument('<tokens>', 'path to a JSON or YAML design-token spec')
  .option('-o, --out <dir>', 'output directory', 'generated-ds')
  .option(
    '--ai-docs',
    'use the Claude API to write component usage docs and accessibility notes (requires ANTHROPIC_API_KEY)',
  )
  .addOption(targetOption())
  .description('Generate a component library (or, with --target shadcn, a shadcn/ui theme) from a token spec')
  .action(async (tokensPath: string, opts: { out: string; aiDocs?: boolean; target: Target }) => {
    try {
      if (opts.target === 'shadcn' && opts.aiDocs) {
        console.error('\n--ai-docs is not supported with --target shadcn (there are no components to document).');
        process.exitCode = 1;
        return;
      }
      console.log(`Reading tokens from ${tokensPath}…`);
      const spec = await parseTokenFile(tokensPath);
      console.log('Checking WCAG AA contrast…');
      const tokens = resolveTokens(spec, { target: opts.target });
      console.log(`Generating into ${opts.out}…`);
      const result = await generate(tokens, {
        outDir: opts.out,
        aiDocs: opts.aiDocs,
        target: opts.target,
        source: basename(tokensPath),
        log: (message) => console.log(message),
      });
      if (opts.target === 'shadcn') {
        console.log(`\nDone. Wrote a shadcn/ui theme (${result.files.join(', ')}).`);
        console.log(`Next steps: see ${opts.out}/README.md to install it and keep it in sync.`);
        return;
      }
      console.log(
        `\nDone. Generated ${result.components.length} components (${result.components.join(', ')}).`,
      );
      console.log(`Next steps:\n  cd ${opts.out}\n  npm install\n  npm test          # axe-core a11y tests\n  npm run storybook # generated docs`);
    } catch (err) {
      if (err instanceof AccessibilityError || err instanceof TokenSpecError) {
        console.error(`\n${err.message}`);
        process.exitCode = 1;
        return;
      }
      throw err;
    }
  });

program
  .command('check')
  .argument('<tokens>', 'path to a JSON or YAML design-token spec')
  .addOption(targetOption())
  .option('--theme <file>', 'also check that a generated shadcn theme.css still matches the tokens (implies --target shadcn)')
  .description('Validate a token spec and its WCAG AA contrast without generating anything')
  .action(async (tokensPath: string, opts: { target: Target; theme?: string }) => {
    try {
      const target: Target = opts.theme ? 'shadcn' : opts.target;
      const spec = await parseTokenFile(tokensPath);
      const tokens = resolveTokens(spec, { target });
      if (opts.theme) {
        const expected = stripShadcnHeader(renderShadcnThemeCss(tokens));
        const actual = stripShadcnHeader(await readFile(opts.theme, 'utf8'));
        if (expected !== actual) {
          console.error(unifiedDiff(expected, actual));
          console.error(
            `\nTheme file has drifted from tokens; regenerate with: dsg generate ${tokensPath} --target shadcn`,
          );
          process.exitCode = 1;
          return;
        }
        console.log(`✓ ${opts.theme} matches ${tokensPath}.`);
      }
      const suffix = target === 'shadcn' ? ' (including the shadcn/ui pairs)' : '';
      console.log(`✓ ${tokensPath} is valid and meets WCAG AA contrast requirements${suffix}.`);
    } catch (err) {
      if (err instanceof AccessibilityError || err instanceof TokenSpecError) {
        console.error(`\n${err.message}`);
        process.exitCode = 1;
        return;
      }
      throw err;
    }
  });

program.parseAsync().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
