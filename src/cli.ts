#!/usr/bin/env node
import { Command } from 'commander';
import { parseTokenFile, resolveTokens, AccessibilityError, TokenSpecError } from './tokens/parse.js';
import { generate } from './generator/generate.js';

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
  .description('Generate a component library from a token spec')
  .action(async (tokensPath: string, opts: { out: string; aiDocs?: boolean }) => {
    try {
      console.log(`Reading tokens from ${tokensPath}…`);
      const spec = await parseTokenFile(tokensPath);
      console.log('Checking WCAG AA contrast…');
      const tokens = resolveTokens(spec);
      console.log(`Generating into ${opts.out}…`);
      const result = await generate(tokens, {
        outDir: opts.out,
        aiDocs: opts.aiDocs,
        log: (message) => console.log(message),
      });
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
  .description('Validate a token spec and its WCAG AA contrast without generating anything')
  .action(async (tokensPath: string) => {
    try {
      const spec = await parseTokenFile(tokensPath);
      resolveTokens(spec);
      console.log(`✓ ${tokensPath} is valid and meets WCAG AA contrast requirements.`);
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
