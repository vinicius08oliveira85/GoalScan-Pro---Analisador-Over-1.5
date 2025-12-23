
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
    // Se estava ganho, tinha adicionado apenas o lucro (retorno - aposta)
    oldImpact = potentialReturn - betAmount;
  } else if (oldStatus === 'lost') {
    // Se estava perdido, tinha subtraído o valor apostado
    oldImpact = -betAmount;
  }

  // Calcular impacto do novo status
  let newImpact = 0;
  if (newStatus === 'won') {
    // Ganhou = adiciona apenas o lucro (retorno - valor apostado)
    // O valor apostado já foi descontado quando a aposta foi feita
    newImpact = potentialReturn - betAmount;
  } else if (newStatus === 'lost') {
    // Perdeu = subtrai valor apostado (confirma a perda)
    newImpact = -betAmount;
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
      // Adiciona apenas o lucro (retorno - valor apostado)
      // O valor apostado já foi descontado quando a aposta foi feita
      currentBank += (betInfo.potentialReturn - betInfo.betAmount);
    } else if (betInfo.status === 'lost') {
      // Subtrai o valor apostado (confirma a perda)
      currentBank -= betInfo.betAmount;
    }
    // pending e cancelled não alteram a banca
  });

  return Math.max(0, currentBank); // Banca não pode ser negativa
}

