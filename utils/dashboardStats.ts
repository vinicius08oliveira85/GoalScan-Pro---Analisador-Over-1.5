import { SavedAnalysis, BankSettings } from '../types';
import { getDisplayProbability } from './probability';
import { buildBankCurve, computeNetCashDelta } from './bankLedger';

export interface DashboardStats {
  totalMatches: number;
  averageEV: number;
  winRate: number;
  totalProfit: number;
  roi: number;
  currentBank: number;
  positiveEVCount: number;
  avgProbability: number;
  averageOdd: number;
}

export interface BankStats {
  totalProfit: number;
  roi: number;
  wonBets: number;
  lostBets: number;
  pendingBets: number;
  cancelledBets: number;
  pendingExposure: number;
  biggestWin: number;
  biggestLoss: number;
  initialBank: number;
  currentCash: number;
  currentEquity: number;
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
      averageOdd: 0,
    };
  }

  // Calcular EV médio usando a mesma lógica dos cards (considera probabilidade selecionada/combinada)
  const totalEV = savedMatches.reduce((sum, match) => {
    const probability = getDisplayProbability(match);
    const displayEv = match.data.oddOver15 && match.data.oddOver15 > 1
      ? ((probability / 100) * match.data.oddOver15 - 1) * 100
      : match.result.ev;
    return sum + displayEv;
  }, 0);
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
    // ROI apenas em apostas finalizadas (won/lost) para não distorcer com pendentes
    if (match.betInfo && match.betInfo.betAmount > 0 && (match.betInfo.status === 'won' || match.betInfo.status === 'lost')) {
      return sum + match.betInfo.betAmount;
    }
    return sum;
  }, 0);
  const roi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  // Contar partidas com EV positivo usando a mesma lógica dos cards
  const positiveEVCount = savedMatches.filter((match) => {
    const probability = getDisplayProbability(match);
    const displayEv = match.data.oddOver15 && match.data.oddOver15 > 1
      ? ((probability / 100) * match.data.oddOver15 - 1) * 100
      : match.result.ev;
    return displayEv > 0;
  }).length;

  // Calcular probabilidade média
  const totalProbability = savedMatches.reduce((sum, match) => {
    const prob = match.result.combinedProbability ?? match.result.probabilityOver15;
    return sum + prob;
  }, 0);
  const avgProbability = totalProbability / totalMatches;

  // Calcular média das odds
  const matchesWithOdd = savedMatches.filter((match) => match.data.oddOver15 && match.data.oddOver15 > 0);
  const totalOdd = matchesWithOdd.reduce((sum, match) => sum + (match.data.oddOver15 || 0), 0);
  const averageOdd = matchesWithOdd.length > 0 ? totalOdd / matchesWithOdd.length : 0;

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
    averageOdd,
  };
}

/**
 * Calcula estatísticas da Banca
 */
export function calculateBankStats(
  savedMatches: SavedAnalysis[],
  bankSettings?: BankSettings
): BankStats {
  const matchesWithBets = savedMatches.filter(
    (match) => match.betInfo && match.betInfo.betAmount > 0
  );

  const wonBets = matchesWithBets.filter((match) => match.betInfo?.status === 'won');
  const lostBets = matchesWithBets.filter((match) => match.betInfo?.status === 'lost');
  const pendingBets = matchesWithBets.filter((match) => match.betInfo?.status === 'pending');
  const cancelledBets = matchesWithBets.filter((match) => match.betInfo?.status === 'cancelled');

  // Resumo financeiro (apenas apostas finalizadas para lucro/ROI)
  const totalProfit = matchesWithBets.reduce((sum, match) => {
    if (!match.betInfo) return sum;
    if (match.betInfo.status === 'won') return sum + match.betInfo.potentialProfit;
    if (match.betInfo.status === 'lost') return sum - match.betInfo.betAmount;
    return sum;
  }, 0);

  const totalInvestedSettled = matchesWithBets.reduce((sum, match) => {
    if (!match.betInfo) return sum;
    if (match.betInfo.status === 'won' || match.betInfo.status === 'lost') {
      return sum + match.betInfo.betAmount;
    }
    return sum;
  }, 0);
  const roi = totalInvestedSettled > 0 ? (totalProfit / totalInvestedSettled) * 100 : 0;

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

  const currentCash = bankSettings?.totalBank || 0;
  const currentEquity = currentCash + pendingAmount;
  // Base inferida para manter o gráfico consistente com a banca atual (caso não exista base armazenada)
  const netDelta = computeNetCashDelta(savedMatches);
  const initialBank = Math.max(0, Number((currentCash - netDelta).toFixed(2)));

  return {
    totalProfit,
    roi,
    wonBets: wonBets.length,
    lostBets: lostBets.length,
    pendingBets: pendingBets.length,
    cancelledBets: cancelledBets.length,
    pendingExposure: pendingAmount,
    biggestWin,
    biggestLoss,
    initialBank,
    currentCash,
    currentEquity,
    totalBets: matchesWithBets.length,
  };
}

/**
 * Prepara dados para gráfico de evolução da banca
 */
export function prepareBankEvolutionData(
  savedMatches: SavedAnalysis[],
  bankSettings?: BankSettings
): Array<{ date: string; timestamp: number; cash: number; equity: number }> {
  if (!bankSettings) return [];

  // Base inferida: garante que o último ponto de cash bata com bankSettings.totalBank
  const netDelta = computeNetCashDelta(savedMatches);
  const baseCash = Math.max(0, Number((bankSettings.totalBank - netDelta).toFixed(2)));

  const { series } = buildBankCurve(savedMatches, baseCash);
  return series;
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
