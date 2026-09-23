#!/usr/bin/env node
// Compiles a generated shadcn theme.css with Tailwind v4 against a tiny HTML
// fixture and asserts the utilities it uses exist in the output. That proves
// the `@theme inline` bridge actually produces working Tailwind classes.
//
// Usage: node scripts/check-shadcn-tailwind.mjs <path/to/theme.css>
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const themePath = process.argv[2];
if (!themePath) {
  console.error('Usage: node scripts/check-shadcn-tailwind.mjs <path/to/theme.css>');
  process.exit(2);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Inside the repo so `@import "tailwindcss"` resolves from its node_modules.
const cacheDir = join(root, 'node_modules', '.cache');
mkdirSync(cacheDir, { recursive: true });
const work = mkdtempSync(join(cacheDir, 'dsg-tailwind-'));

const utilities = ['bg-primary', 'text-primary-foreground', 'rounded-md', 'border-border', 'text-muted-foreground', 'bg-success'];
writeFileSync(join(work, 'index.html'), `<button class="${utilities.join(' ')}">Buy</button>\n`);
writeFileSync(
  join(work, 'input.css'),
  `@import "tailwindcss" source(none);\n@source "./index.html";\n${readFileSync(resolve(themePath), 'utf8')}`,
);

const cli = join(root, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');
const result = spawnSync('node', [cli, '-i', join(work, 'input.css'), '-o', join(work, 'out.css')], {
  cwd: root,
  encoding: 'utf8',
});
if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  rmSync(work, { recursive: true, force: true });
  process.exit(1);
}

const out = readFileSync(join(work, 'out.css'), 'utf8');
rmSync(work, { recursive: true, force: true });

let missing = 0;
for (const utility of utilities) {
  if (out.includes(`.${utility}`)) {
    console.log(`  ok  .${utility}`);
  } else {
    console.error(`FAIL  .${utility} was not generated`);
    missing++;
  }
}
if (!out.includes('var(--primary)')) {
  console.error('FAIL  utilities do not reference the theme variables');
  missing++;
}
if (missing > 0) process.exit(1);
console.log('\nTailwind v4 compiled the theme and produced every expected utility.');
