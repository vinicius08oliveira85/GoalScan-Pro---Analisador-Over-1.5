import { describe, it, expect } from 'vitest';
import { applyBankDelta, isInsufficientBankForBet, subtractMoney } from '../../utils/bankMoney';

describe('bankMoney', () => {
  it('applyBankDelta nunca retorna negativo', () => {
    expect(applyBankDelta(10, -50)).toBe(0);
    expect(applyBankDelta(100, -25.125)).toBe(74.88);
  });

  it('subtractMoney usa precisão decimal', () => {
    expect(subtractMoney(10.0, 0.01)).toBe(9.99);
  });

  it('isInsufficientBankForBet', () => {
    expect(isInsufficientBankForBet(100, 99.99)).toBe(true);
    expect(isInsufficientBankForBet(100, 100)).toBe(false);
    expect(isInsufficientBankForBet(0, 100)).toBe(false);
  });
});
