import { describe, it, expect } from 'vitest';
import { calculateEVPercent } from '../../utils/evDecimal';

describe('calculateEVPercent', () => {
  it('retorna 0 para odd inválida', () => {
    expect(calculateEVPercent(50, 1)).toBe(0);
    expect(calculateEVPercent(50, 0.5)).toBe(0);
  });

  it('retorna 0 para probabilidade fora de 0–100', () => {
    expect(calculateEVPercent(-1, 2)).toBe(0);
    expect(calculateEVPercent(101, 2)).toBe(0);
  });

  it('calcula EV esperado para prob 50% e odd 2.0', () => {
    expect(calculateEVPercent(50, 2)).toBe(0);
  });

  it('EV positivo quando prob × odd > 1', () => {
    const ev = calculateEVPercent(60, 2);
    expect(ev).toBeGreaterThan(0);
    expect(ev).toBeCloseTo(20, 2);
  });
});
