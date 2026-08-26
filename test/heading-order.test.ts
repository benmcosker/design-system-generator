// @vitest-environment jsdom
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { parseTokens, resolveTokens } from '../src/tokens/parse.js';
import { generate } from '../src/generator/generate.js';

/**
 * "Gate has teeth" test: proves axe-core's heading-order rule — already
 * active by default on every generated axe test — actually fires on a
 * skipped heading level. Generates a real design system (so this exercises
 * the shipped Heading component, not a hand-written stand-in) into an
 * in-repo temp dir so Node module resolution can still find this repo's
 * node_modules when the generated .tsx is imported.
 */

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

type HeadingComponent = (props: {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children?: React.ReactNode;
}) => React.ReactElement;

let outDir: string;
let Heading: HeadingComponent;
let expectNoAxeViolations: (container: HTMLElement) => Promise<void>;

beforeAll(async () => {
  outDir = await mkdtemp(join(process.cwd(), 'test', 'tmp-heading-order-'));
  const tokens = resolveTokens(parseTokens(spec));
  await generate(tokens, { outDir, aiDocs: false });

  const headingMod = (await import(
    pathToFileURL(join(outDir, 'src/Heading/Heading.tsx')).href
  )) as { Heading: HeadingComponent };
  Heading = headingMod.Heading;

  const axeMod = (await import(pathToFileURL(join(outDir, 'src/testing/axe.ts')).href)) as {
    expectNoAxeViolations: (container: HTMLElement) => Promise<void>;
  };
  expectNoAxeViolations = axeMod.expectNoAxeViolations;
});

afterAll(async () => {
  await rm(outDir, { recursive: true, force: true });
});

// Each `it` below renders its own <main>; unmount between tests so axe
// doesn't also trip landmark-no-duplicate-main on a leftover render.
afterEach(cleanup);

describe('heading-order gate has teeth', () => {
  it('passes axe on a correctly nested h1 -> h2 -> h3 structure', async () => {
    const { container } = render(
      React.createElement(
        'main',
        null,
        React.createElement(Heading, { level: 1 }, 'Page title'),
        React.createElement(Heading, { level: 2 }, 'Section title'),
        React.createElement(Heading, { level: 3 }, 'Subsection title'),
      ),
    );
    await expect(expectNoAxeViolations(container)).resolves.toBeUndefined();
  });

  it('throws via axe-core heading-order when a level is skipped (h1 -> h3)', async () => {
    const { container } = render(
      React.createElement(
        'main',
        null,
        React.createElement(Heading, { level: 1 }, 'Page title'),
        React.createElement(Heading, { level: 3 }, 'Skipped level two'),
      ),
    );
    await expect(expectNoAxeViolations(container)).rejects.toThrow(/heading-order/);
  });
});
