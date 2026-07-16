import { describe, expect, it } from 'vitest';
import { bestTextOn, contrastRatio, relativeLuminance } from '../src/tokens/contrast.js';

describe('contrast math', () => {
  it('computes 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('computes 1:1 for identical colors', () => {
    expect(contrastRatio('#2563eb', '#2563eb')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#1d4ed8', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#1d4ed8'), 10);
  });

  it('expands 3-digit hex', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(relativeLuminance('#ffffff'), 10);
  });

  it('picks white text on a dark primary', () => {
    expect(bestTextOn('#1d4ed8')).toBe('#ffffff');
  });

  it('picks dark text on a light background', () => {
    expect(bestTextOn('#f8fafc')).toBe('#111827');
  });
});
