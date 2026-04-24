import { describe, expect, it } from 'vitest';
import { computeBankDifferenceForBetSave, ledgerForSignedDelta } from '../../utils/bankDifferenceCore';
import type { BetInfo } from '../../types';

describe('bankDifferenceCore', () => {
  it('ledger classifica lucro pendente→ganhou como PROFIT', () => {
    const r = ledgerForSignedDelta(50, { oldStatus: 'pending', newStatus: 'won' });
    expect(r.type).toBe('PROFIT');
    expect(r.amount).toBe(50);
  });

  it('ledger classifica débito', () => {
    const r = ledgerForSignedDelta(-25, { oldStatus: 'pending', newStatus: 'pending' });
    expect(r.type).toBe('DEBIT');
    expect(r.amount).toBe(25);
  });

  it('computeBankDifferenceForBetSave: nova aposta pendente debita stake', () => {
    const betInfo: BetInfo = {
      betAmount: 10,
      odd: 2,
      potentialReturn: 20,
      potentialProfit: 10,
      bankPercentage: 1,
      status: 'pending',
    };
    const d = computeBankDifferenceForBetSave({ betInfo });
    expect(d).toBe(-10);
  });
});
