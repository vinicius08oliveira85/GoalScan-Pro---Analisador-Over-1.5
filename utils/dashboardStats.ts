import { SavedAnalysis, BankSettings } from '../types';

export interface DashboardStats {
  totalMatches: number;
  averageEV: number;
  winRate: number;
  totalProfit: number;
  roi: number;
  currentBank: number;
  positiveEVCount: number;
  avgProbability: number;
}

export interface BankStats {
  totalProfit: number;
  roi: number;
  wonBets: number;
  lostBets: number;
  pendingBets: number;
  biggestWin: number;
  biggestLoss: number;
  initialBank: number;
  currentBank: number;
  totalBets: number;
}

/**
 * Calcula estatísticas gerais do Dashboard
 */
export function calculateDashboardStats(
  savedMatches: SavedAnalysis[],
  bankSettings?: BankSettings
): DashboardStats {
  const totalMatches = savedMatches.length;

  if (totalMatches === 0) {
    return {
      totalMatches: 0,
      averageEV: 0,
      winRate: 0,
      totalProfit: 0,
      roi: 0,
      currentBank: bankSettings?.totalBank || 0,
      positiveEVCount: 0,
      avgProbability: 0,
    };
  }

  // Calcular EV médio
  const totalEV = savedMatches.reduce((sum, match) => sum + match.result.ev, 0);
  const averageEV = totalEV / totalMatches;

  // Calcular taxa de acerto (win rate)
  const matchesWithBets = savedMatches.filter(
    (match) => match.betInfo && match.betInfo.betAmount > 0
  );
  const wonMatches = matchesWithBets.filter((match) => match.betInfo?.status === 'won');
  const winRate =
    matchesWithBets.length > 0 ? (wonMatches.length / matchesWithBets.length) * 100 : 0;

  // Calcular lucro total
  const totalProfit = savedMatches.reduce((sum, match) => {
    if (match.betInfo && match.betInfo.betAmount > 0) {
      if (match.betInfo.status === 'won') {
        return sum + match.betInfo.potentialProfit;
      } else if (match.betInfo.status === 'lost') {
        return sum - match.betInfo.betAmount;
      }
    }
    return sum;
  }, 0);

  // Calcular ROI
  const totalInvested = savedMatches.reduce((sum, match) => {
    if (match.betInfo && match.betInfo.betAmount > 0 && match.betInfo.status !== 'cancelled') {
      return sum + match.betInfo.betAmount;
    }
    return sum;
  }, 0);
  const roi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  // Contar partidas com EV positivo
  const positiveEVCount = savedMatches.filter((match) => match.result.ev > 0).length;

  // Calcular probabilidade média
  const totalProbability = savedMatches.reduce((sum, match) => {
    const prob = match.result.combinedProbability ?? match.result.probabilityOver15;
    return sum + prob;
  }, 0);
  const avgProbability = totalProbability / totalMatches;

  // Banca atual
  const currentBank = bankSettings?.totalBank || 0;

  return {
    totalMatches,
    averageEV,
    winRate,
    totalProfit,
    roi,
    currentBank,
    positiveEVCount,
    avgProbability,
  };
}

/**
 * Calcula estatísticas da Banca
 */
export function calculateBankStats(
  savedMatches: SavedAnalysis[],
  _bankSettings?: BankSettings
): BankStats {
  const matchesWithBets = savedMatches.filter(
    (match) => match.betInfo && match.betInfo.betAmount > 0
  );

  const wonBets = matchesWithBets.filter((match) => match.betInfo?.status === 'won');
  const lostBets = matchesWithBets.filter((match) => match.betInfo?.status === 'lost');
  const pendingBets = matchesWithBets.filter((match) => match.betInfo?.status === 'pending');

  // Calcular lucro total
  const totalProfit = matchesWithBets.reduce((sum, match) => {
    if (!match.betInfo) return sum;
    if (match.betInfo.status === 'won') {
      return sum + match.betInfo.potentialProfit;
    } else if (match.betInfo.status === 'lost') {
      return sum - match.betInfo.betAmount;
    }
    return sum;
  }, 0);

  // Calcular ROI
  const totalInvested = matchesWithBets.reduce((sum, match) => {
    if (match.betInfo && match.betInfo.status !== 'cancelled') {
      return sum + match.betInfo.betAmount;
    }
    return sum;
  }, 0);
  const roi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  // Maior ganho
  const biggestWin = wonBets.reduce((max, match) => {
    const profit = match.betInfo?.potentialProfit || 0;
    return profit > max ? profit : max;
  }, 0);

  // Maior perda
  const biggestLoss = lostBets.reduce((max, match) => {
    const amount = match.betInfo?.betAmount || 0;
    return amount > max ? amount : max;
  }, 0);

  // Calcular valor total em apostas pendentes
  const pendingAmount = pendingBets.reduce((sum, match) => {
    return sum + (match.betInfo?.betAmount || 0);
  }, 0);

  // Banca inicial definida como 20 reais
  const initialBank = 20;
  const currentBank = initialBank + totalProfit - pendingAmount;

  return {
    totalProfit,
    roi,
    wonBets: wonBets.length,
    lostBets: lostBets.length,
    pendingBets: pendingBets.length,
    biggestWin,
    biggestLoss,
    initialBank: Math.max(0, initialBank),
    currentBank,
    totalBets: matchesWithBets.length,
  };
}

/**
 * Prepara dados para gráfico de evolução da banca
 */
export function prepareBankEvolutionData(
  savedMatches: SavedAnalysis[],
  bankSettings?: BankSettings
): Array<{ date: string; value: number }> {
  if (!bankSettings) return [];

  // Ordenar partidas por data
  const sortedMatches = [...savedMatches].sort((a, b) => a.timestamp - b.timestamp);

  // Banca inicial definida como 20 reais
  const initialBank = 20;

  // Simular evolução da banca ao longo do tempo
  let currentBank = initialBank;
  const data: Array<{ date: string; value: number }> = [
    {
      date: new Date(sortedMatches[0]?.timestamp || Date.now()).toLocaleDateString('pt-BR', {
        month: 'short',
        day: 'numeric',
      }),
      value: initialBank,
    },
  ];

  sortedMatches.forEach((match) => {
    if (match.betInfo && match.betInfo.betAmount > 0) {
      if (match.betInfo.status === 'pending') {
        currentBank -= match.betInfo.betAmount;
      } else if (match.betInfo.status === 'won') {
        currentBank += match.betInfo.potentialReturn;
      } else if (match.betInfo.status === 'lost') {
        // Já foi descontado quando pending
      } else if (match.betInfo.status === 'cancelled') {
        currentBank += match.betInfo.betAmount;
      }

      data.push({
        date: new Date(match.timestamp).toLocaleDateString('pt-BR', {
          month: 'short',
          day: 'numeric',
        }),
        value: Math.max(0, currentBank),
      });
    }
  });

  // Adicionar ponto final (banca atual)
  if (data.length > 0) {
    data.push({
      date: 'Atual',
      value: currentBank,
    });
  }

  return data;
}

/**
 * Prepara dados para gráfico de distribuição de resultados
 */
export function prepareResultDistributionData(
  savedMatches: SavedAnalysis[]
): Array<{ name: string; value: number; color: string }> {
  const matchesWithBets = savedMatches.filter(
    (match) => match.betInfo && match.betInfo.betAmount > 0
  );

  const won = matchesWithBets.filter((m) => m.betInfo?.status === 'won').length;
  const lost = matchesWithBets.filter((m) => m.betInfo?.status === 'lost').length;
  const pending = matchesWithBets.filter((m) => m.betInfo?.status === 'pending').length;

  return [
    { name: 'Ganhas', value: won, color: 'hsl(var(--su))' },
    { name: 'Perdidas', value: lost, color: 'hsl(var(--er))' },
    { name: 'Pendentes', value: pending, color: 'hsl(var(--wa))' },
  ];
}
