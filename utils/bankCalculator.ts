import { BetInfo } from '../types';

type BetStatus = BetInfo['status'] | undefined | null;

/**
 * Define o impacto financeiro líquido de cada status na banca.
 * 'pending' e 'lost' representam o valor saindo (-betAmount).
 * 'won' representa o lucro líquido (potentialReturn - betAmount).
 * 'cancelled' ou inexistente representa zero impacto (0).
 */
const getStatusImpact = (status: BetStatus, amount: number, potentialReturn: number): number => {
  switch (status) {
    case 'pending':
    case 'lost':
      return -amount;
    case 'won':
      return potentialReturn - amount;
    case 'cancelled':
    default:
      return 0;
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

  return newImpact - oldImpact;
}

/**
 * Calcula a banca total baseada no estado atual de todas as apostas.
 */
export function calculateCurrentBank(
  initialBank: number,
  allBets: Array<{ betInfo: BetInfo }>
): number {
  const totalImpact = allBets.reduce((acc, { betInfo }) => {
    return acc + getStatusImpact(betInfo.status, betInfo.betAmount, betInfo.potentialReturn);
  }, 0);

  return Math.max(0, initialBank + totalImpact);
}