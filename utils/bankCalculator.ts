import { BetInfo } from '../types';

/**
 * Calcula a diferença na banca baseada na mudança de status da aposta
 * NOVA LÓGICA: O valor é descontado imediatamente quando a aposta é criada (pending)
 * @param oldStatus Status anterior da aposta (undefined/null = nova aposta)
 * @param newStatus Novo status da aposta
 * @param betAmount Valor apostado
 * @param potentialReturn Retorno potencial (valor apostado × odd)
 * @returns Diferença a ser aplicada na banca (+valor aumenta, -valor diminui)
 */
export function calculateBankUpdate(
  oldStatus: BetInfo['status'] | undefined | null,
  newStatus: BetInfo['status'],
  betAmount: number,
  potentialReturn: number
): number {
  // Se não houve mudança, retorna 0
  if (oldStatus === newStatus) {
    return 0;
  }

  // NOVA APOSTA: Quando criar aposta (oldStatus não existe e newStatus é 'pending')
  // Descontar o valor apostado imediatamente
  if (
    (oldStatus === undefined || oldStatus === null || oldStatus === 'cancelled') &&
    newStatus === 'pending'
  ) {
    return -betAmount; // Desconta o valor apostado
  }

  // CANCELAR APOSTA PENDING: Devolver o valor se estava pending
  if (
    oldStatus === 'pending' &&
    (newStatus === 'cancelled' || newStatus === undefined || newStatus === null)
  ) {
    return betAmount; // Devolve o valor apostado
  }

  // Se ambos são pending ou cancelled, não altera banca
  if (
    (oldStatus === 'pending' || oldStatus === 'cancelled') &&
    (newStatus === 'pending' || newStatus === 'cancelled')
  ) {
    return 0;
  }

  // Calcular impacto do status anterior
  let oldImpact = 0;
  if (oldStatus === 'pending') {
    // Pending já descontou o valor apostado, então impacto é -betAmount
    oldImpact = -betAmount;
  } else if (oldStatus === 'won') {
    // Won: tinha adicionado o retorno total (potentialReturn)
    // Mas como pending já descontou betAmount, o impacto líquido é potentialReturn
    oldImpact = potentialReturn;
  } else if (oldStatus === 'lost') {
    // Lost: já estava descontado quando pending, então impacto é -betAmount
    oldImpact = -betAmount;
  }

  // Calcular impacto do novo status
  let newImpact = 0;
  if (newStatus === 'pending') {
    // Pending: desconta o valor apostado
    newImpact = -betAmount;
  } else if (newStatus === 'won') {
    // Won: o impacto líquido é o lucro (retorno total - valor apostado)
    // Mas como o valor apostado já foi descontado quando pending,
    // ao mudar de pending para won, adicionamos apenas o lucro
    // para compensar e adicionar o lucro
    newImpact = potentialReturn - betAmount;
  } else if (newStatus === 'lost') {
    // Lost: se veio de pending, não precisa descontar novamente (já foi descontado)
    // O impacto líquido é o mesmo de pending: -betAmount (já descontado)
    newImpact = -betAmount;
  }

  // Retorna a diferença (novo impacto - impacto anterior)
  return newImpact - oldImpact;
}

/**
 * Calcula a banca atualizada baseada em todas as apostas
 * NOVA LÓGICA: Apostas pending já descontaram o valor, won adiciona retorno total
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
    if (betInfo.status === 'pending') {
      // Pending: já descontou o valor apostado quando foi criada
      currentBank -= betInfo.betAmount;
    } else if (betInfo.status === 'won') {
      // Won: descontou quando pending, então adiciona apenas o lucro
      // Lucro = retorno total - valor apostado (que já foi descontado)
      currentBank += betInfo.potentialReturn - betInfo.betAmount;
    } else if (betInfo.status === 'lost') {
      // Lost: já estava descontado quando pending, então não precisa fazer nada
      // O valor já foi descontado quando a aposta foi criada
      // Não descontamos novamente aqui
    }
    // cancelled não altera a banca (valor foi devolvido ou nunca foi descontado)
  });

  return Math.max(0, currentBank); // Banca não pode ser negativa
}
