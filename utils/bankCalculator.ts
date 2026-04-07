import Decimal from 'decimal.js';
import { BetInfo } from '../types';
import { roundMoney2, decimalMoney } from './bankMoney';

type BetStatus = BetInfo['status'] | undefined | null;

/**
 * Define o impacto financeiro líquido de cada status na banca.
 * 'pending' e 'lost' representam o valor saindo (-betAmount).
 * 'won' representa o lucro líquido (potentialReturn - betAmount).
 * 'cancelled' ou inexistente representa zero impacto (0).
 */
const getStatusImpact = (status: BetStatus, amount: number, potentialReturn: number): Decimal => {
  const a = decimalMoney(amount);
  const pr = decimalMoney(potentialReturn);
  switch (status) {
    case 'pending':
    case 'lost':
      return a.neg();
    case 'won':
      return pr.minus(a);
    case 'cancelled':
    default:
      return new Decimal(0);
  }
};

/**
 * Calcula a diferença na banca baseada na mudança de status da aposta.
 * Segue a lógica de Delta: (Novo Estado - Estado Anterior).
 */
export function calculateBankUpdate(
  oldStatus: BetStatus,
  newStatus: BetStatus,
  betAmount: number,
  potentialReturn: number
): number {
  if (oldStatus === newStatus) return 0;

  const oldImpact = getStatusImpact(oldStatus, betAmount, potentialReturn);
  const newImpact = getStatusImpact(newStatus, betAmount, potentialReturn);

  return roundMoney2(newImpact.minus(oldImpact));
}

/**
 * Calcula a banca total baseada no estado atual de todas as apostas.
 */
export function calculateCurrentBank(
  initialBank: number,
  allBets: Array<{ betInfo: BetInfo }>
): number {
  let total = decimalMoney(initialBank);
  for (const { betInfo } of allBets) {
    total = total.plus(getStatusImpact(betInfo.status, betInfo.betAmount, betInfo.potentialReturn));
  }
  return roundMoney2(Decimal.max(total, 0));
}