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
 * "Gate has teeth" test: proves axe-core's button-name rule — already
 * active by default on every generated axe test — actually catches an
 * IconButton with an empty aria-label. TypeScript blocks this at the
 * consumer's call site (aria-label is required, not optional); this test
 * bypasses that deliberately, the same way the contrast fail-fixtures are
 * deliberately invalid, to prove the runtime/axe backstop actually fires.
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

type IconButtonComponent = (props: {
  icon: React.ReactNode;
  'aria-label': string;
}) => React.ReactElement;

let outDir: string;
let IconButton: IconButtonComponent;
let expectNoAxeViolations: (container: HTMLElement) => Promise<void>;

beforeAll(async () => {
  outDir = await mkdtemp(join(process.cwd(), 'test', 'tmp-icon-button-name-'));
  const tokens = resolveTokens(parseTokens(spec));
  await generate(tokens, { outDir, aiDocs: false });

  const iconButtonMod = (await import(
    pathToFileURL(join(outDir, 'src/IconButton/IconButton.tsx')).href
  )) as { IconButton: IconButtonComponent };
  IconButton = iconButtonMod.IconButton;

  const axeMod = (await import(pathToFileURL(join(outDir, 'src/testing/axe.ts')).href)) as {
    expectNoAxeViolations: (container: HTMLElement) => Promise<void>;
  };
  expectNoAxeViolations = axeMod.expectNoAxeViolations;
});

afterAll(async () => {
  await rm(outDir, { recursive: true, force: true });
});

afterEach(cleanup);

const icon = React.createElement('svg', { width: 16, height: 16 });

describe('icon-button-name gate has teeth', () => {
  it('passes axe with a valid aria-label', async () => {
    const { container } = render(
      React.createElement(IconButton, { icon, 'aria-label': 'Delete item' }),
    );
    await expect(expectNoAxeViolations(container)).resolves.toBeUndefined();
  });

  it('throws via axe-core button-name when aria-label is empty', async () => {
    // Deliberately bypasses the required-prop type check, the same way the
    // contrast fail-fixtures are deliberately invalid tokens.
    const { container } = render(
      React.createElement(IconButton, { icon, 'aria-label': '' } as unknown as Parameters<
        IconButtonComponent
      >[0]),
    );
    await expect(expectNoAxeViolations(container)).rejects.toThrow(/button-name/);
  });
});
