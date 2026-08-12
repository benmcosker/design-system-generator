import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AccessibilityError, parseTokenFile, resolveTokens } from '../src/tokens/parse.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures', 'contrast');

const passFixtures = readdirSync(join(fixturesDir, 'pass'));
const failFixtures = readdirSync(join(fixturesDir, 'fail'));

describe('contrast fixtures matrix', () => {
  it('has at least one pass and one fail fixture', () => {
    expect(passFixtures.length).toBeGreaterThan(0);
    expect(failFixtures.length).toBeGreaterThan(0);
  });

  for (const file of passFixtures) {
    it(`resolves pass/${file} without throwing`, async () => {
      const spec = await parseTokenFile(join(fixturesDir, 'pass', file));
      expect(() => resolveTokens(spec)).not.toThrow();
    });
  }

  for (const file of failFixtures) {
    it(`rejects fail/${file} with AccessibilityError`, async () => {
      const spec = await parseTokenFile(join(fixturesDir, 'fail', file));
      expect(() => resolveTokens(spec)).toThrowError(AccessibilityError);
    });
  }
});
