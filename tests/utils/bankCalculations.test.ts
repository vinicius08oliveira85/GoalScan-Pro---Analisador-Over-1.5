import { describe, it, expect } from 'vitest';
import { kellyFraction, fractionalKellyBankFraction } from '../../utils/bankCalculations';

describe('kellyFraction', () => {
  it('retorna 0 para odd ≤ 1 ou prob inválida', () => {
    expect(kellyFraction(50, 1)).toBe(0);
    expect(kellyFraction(50, 1.01)).toBeGreaterThanOrEqual(0);
    expect(kellyFraction(0, 2)).toBe(0);
    expect(kellyFraction(100, 2)).toBe(0);
  });

  it('Kelly positivo quando há edge', () => {
    const f = kellyFraction(55, 2);
    expect(f).toBeGreaterThan(0);
  });
});

describe('fractionalKellyBankFraction', () => {
  it('aplica fração e respeita teto', () => {
    const full = kellyFraction(60, 2);
    const frac = fractionalKellyBankFraction(60, 2, 0.25, 1);
    expect(frac).toBeLessThanOrEqual(0.1);
    expect(frac).toBeCloseTo(Math.min(0.1, full * 0.25), 5);
  });
});
