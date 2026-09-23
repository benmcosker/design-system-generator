#!/usr/bin/env node
// Runs `dsg check` over the fixtures matrices and asserts the exit code
// matches the fixture's directory: every "pass" fixture must exit 0, every
// "fail" fixture must exit non-zero. test/fixtures/contrast runs with the
// default (react) target; test/fixtures/shadcn runs with --target shadcn. Exercises
// the gate exactly as CI and consumers run it — via the built CLI, not the
// library internals.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const cli = join(root, 'dist', 'cli.js');
const fixturesRoot = join(root, 'test', 'fixtures');

const cases = [
  { dir: 'contrast/pass', expectZero: true, args: [] },
  { dir: 'contrast/fail', expectZero: false, args: [] },
  { dir: 'shadcn/pass', expectZero: true, args: ['--target', 'shadcn'] },
  { dir: 'shadcn/fail', expectZero: false, args: ['--target', 'shadcn'] },
];

let failures = 0;
let checked = 0;

for (const { dir, expectZero, args } of cases) {
  const caseDir = join(fixturesRoot, dir);
  const files = readdirSync(caseDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.json'));
  if (files.length === 0) {
    console.error(`No fixtures found in ${caseDir}`);
    failures++;
    continue;
  }
  for (const file of files) {
    const fixturePath = join(caseDir, file);
    const result = spawnSync('node', [cli, 'check', fixturePath, ...args], { encoding: 'utf8' });
    const exitedZero = result.status === 0;
    checked++;
    if (exitedZero === expectZero) {
      console.log(`  ok  ${dir}/${file}`);
    } else {
      console.error(
        `FAIL  ${dir}/${file} — expected exit ${expectZero ? '0' : 'non-zero'}, got ${result.status}`,
      );
      if (result.stdout) console.error(result.stdout.trim());
      if (result.stderr) console.error(result.stderr.trim());
      failures++;
    }
  }
}

console.log(`\n${checked - failures}/${checked} fixtures behaved as expected.`);
if (failures > 0) {
  console.error(`${failures} fixture(s) did not match the expected gate outcome.`);
  process.exit(1);
}
