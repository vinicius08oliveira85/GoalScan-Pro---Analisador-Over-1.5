
import { BetInfo } from '../types';

/**
 * Calcula a diferença na banca baseada na mudança de status da aposta
 * @param oldStatus Status anterior da aposta
 * @param newStatus Novo status da aposta
 * @param betAmount Valor apostado
 * @param potentialReturn Retorno potencial (valor apostado × odd)
 * @returns Diferença a ser aplicada na banca (+valor aumenta, -valor diminui)
 */
export function calculateBankUpdate(
  oldStatus: BetInfo['status'],
  newStatus: BetInfo['status'],
  betAmount: number,
  potentialReturn: number
): number {
  // Se não houve mudança, retorna 0
  if (oldStatus === newStatus) {
    return 0;
  }

  // Se ambos são pending ou cancelled, não altera banca
  if ((oldStatus === 'pending' || oldStatus === 'cancelled') && 
      (newStatus === 'pending' || newStatus === 'cancelled')) {
    return 0;
  }

  // Calcular impacto do status anterior
  let oldImpact = 0;
  if (oldStatus === 'won') {
    oldImpact = potentialReturn; // Se estava ganho, tinha adicionado o retorno
  } else if (oldStatus === 'lost') {
    oldImpact = -betAmount; // Se estava perdido, tinha subtraído o valor apostado
  }

  // Calcular impacto do novo status
  let newImpact = 0;
  if (newStatus === 'won') {
    newImpact = potentialReturn; // Ganhou = adiciona retorno total
  } else if (newStatus === 'lost') {
    newImpact = -betAmount; // Perdeu = subtrai valor apostado
  }

  // Retorna a diferença (novo impacto - impacto anterior)
  return newImpact - oldImpact;
}

/**
 * Calcula a banca atualizada baseada em todas as apostas
 * @param initialBank Banca inicial
 * @param allBets Array com todas as apostas e seus status
 * @returns Banca atual calculada
 */
export function calculateCurrentBank(
  initialBank: number,
  allBets: Array<{ betInfo: BetInfo }>
): number {
  let currentBank = initialBank;

  allBets.forEach(({ betInfo }) => {
    if (betInfo.status === 'won') {
      currentBank += betInfo.potentialReturn;
    } else if (betInfo.status === 'lost') {
      currentBank -= betInfo.betAmount;
    }
    // pending e cancelled não alteram a banca
  });

  return Math.max(0, currentBank); // Banca não pode ser negativa
}

