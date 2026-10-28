import { describe, expect, it } from 'vitest';
import { parseTokens, resolveTokens } from '../src/tokens/parse.js';
import { renderStylesCss, renderTokensCss } from '../src/generator/css.js';

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

const tokensCss = renderTokensCss(resolveTokens(parseTokens(spec)));
const stylesCss = renderStylesCss();

// Workstream C — scalable fonts (WCAG 1.4.4): the font-size ladder is emitted in
// rem so it scales with the user's browser text-size setting.
describe('scalable fonts', () => {
  it('emits the font-size ladder in rem, not px', () => {
    // baseSizePx 16, scale 1.25 → the ladder in rem (px at the default root is unchanged).
    expect(tokensCss).toContain('--ds-font-size-sm: 0.8125rem;');
    expect(tokensCss).toContain('--ds-font-size-base: 1rem;');
    expect(tokensCss).toContain('--ds-font-size-lg: 1.25rem;');
    expect(tokensCss).toContain('--ds-font-size-xl: 1.5625rem;');
    expect(tokensCss).toContain('--ds-font-size-2xl: 1.9375rem;');
    expect(tokensCss).toContain('--ds-font-size-3xl: 2.4375rem;');
  });

  it('emits no px font sizes', () => {
    expect(tokensCss).not.toMatch(/--ds-font-size-[\w]+: \d+px;/);
  });
});

// Workstream A — touch targets (WCAG 2.5.8, AA): every interactive control has a
// ≥24×24px hit area.
describe('touch targets', () => {
  it('pins a 24px minimum on padded controls', () => {
    for (const selector of ['.ds-button', '.ds-input', '.ds-select']) {
      const block = stylesCss.slice(stylesCss.indexOf(selector + ' {'));
      expect(block).toContain('min-block-size: 24px;');
    }
  });

  it('pins both dimensions on the icon button', () => {
    const block = stylesCss.slice(stylesCss.indexOf('.ds-button--icon {'));
    expect(block).toContain('min-inline-size: 24px;');
    expect(block).toContain('min-block-size: 24px;');
  });

  it('pins a 24px minimum on the tab and accordion summary', () => {
    for (const selector of ['.ds-tabs__tab', '.ds-accordion__summary']) {
      const block = stylesCss.slice(stylesCss.indexOf(selector + ' {'));
      expect(block).toContain('min-block-size: 24px;');
    }
  });

  it('renders checkbox and radio inputs at 24px', () => {
    for (const selector of ['.ds-checkbox__input', '.ds-radio-group__input']) {
      const block = stylesCss.slice(stylesCss.indexOf(selector + ' {'));
      expect(block).toContain('width: 1.5rem;');
      expect(block).toContain('height: 1.5rem;');
    }
  });

  it('renders the switch track at least 24px tall with a matching knob travel', () => {
    const track = stylesCss.slice(stylesCss.indexOf('.ds-switch__input {'));
    expect(track).toContain('width: 2.75rem;');
    expect(track).toContain('height: 1.5rem;');
    const knob = stylesCss.slice(stylesCss.indexOf('.ds-switch__input::after {'));
    expect(knob).toContain('width: 1.25rem;');
    expect(knob).toContain('height: 1.25rem;');
    expect(stylesCss).toContain('transform: translateX(1.25rem);');
  });
});

// Workstream B — reduced motion (WCAG 2.3.3): all transitions collapse under
// prefers-reduced-motion: reduce.
describe('reduced motion', () => {
  it('emits a prefers-reduced-motion block covering every animated selector', () => {
    const at = stylesCss.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(at).toBeGreaterThan(-1);
    const block = stylesCss.slice(at);
    for (const selector of [
      '.ds-button',
      '.ds-switch__input',
      '.ds-switch__input::after',
      '.ds-accordion__summary::before',
      '.ds-tooltip',
    ]) {
      expect(block).toContain(selector);
    }
    expect(block).toContain('transition-duration: 0.01ms;');
  });
});

// v2.8.0 — Listbox, Menu, Combobox: interactive classes join the shared
// :focus-visible list and meet the 24px target size.
describe('listbox, menu and combobox styles', () => {
  it('adds the focusable classes to the shared :focus-visible selector list', () => {
    const list = stylesCss.slice(0, stylesCss.indexOf('{', stylesCss.indexOf('.ds-listbox:focus-visible')));
    expect(list).toContain('.ds-listbox:focus-visible');
    expect(list).toContain('.ds-menu__item:focus-visible');
  });

  it('pins a 24px minimum on options and menu items', () => {
    for (const selector of ['.ds-listbox__option,', '.ds-menu__item {']) {
      const block = stylesCss.slice(stylesCss.indexOf(selector));
      expect(block).toContain('min-block-size: 24px;');
    }
  });

  it('conveys the active option by an outline, not background color alone', () => {
    const block = stylesCss.slice(stylesCss.indexOf('.ds-listbox__option--active,'));
    expect(block.slice(0, block.indexOf('}'))).toContain('outline:');
  });

  it('adds no transitions, so nothing needs a reduced-motion override', () => {
    const start = stylesCss.indexOf('.ds-listbox {');
    const end = stylesCss.indexOf('.ds-visually-hidden {');
    expect(stylesCss.slice(start, end)).not.toContain('transition');
  });
});

// Workstream C (v2.9.0) — scalable line-height (WCAG 1.4.12).
describe('line-height', () => {
  it('emits unitless line-height tokens', () => {
    expect(tokensCss).toContain('--ds-line-height: 1.5;');
    expect(tokensCss).toContain('--ds-line-height-tight: 1.25;');
  });

  it('sets line-height in every rule that sets font-family', () => {
    const blocks = stylesCss.split('}').filter((b) => b.includes('font-family'));
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) expect(block).toContain('line-height: var(--ds-line-height');
  });

  it('uses the tight token for headings', () => {
    expect(stylesCss).toMatch(/\.ds-heading \{[^}]*line-height: var\(--ds-line-height-tight\)/);
  });
});
