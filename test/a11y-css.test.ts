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
