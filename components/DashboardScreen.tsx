import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  TrendingUp,
  Target,
  DollarSign,
  Percent,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  XCircle,
  Clock,
  Hash,
  ChevronDown,
  Trophy,
  BarChart3,
} from 'lucide-react';
import { formatTimestampInBrasilia } from '../utils/dateFormatter';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from 'recharts';
import { SavedAnalysis, BankSettings } from '../types';
import {
  calculateDashboardStats,
  prepareBankEvolutionData,
  prepareResultDistributionData,
} from '../utils/dashboardStats';
import { getCurrencySymbol } from '../utils/currency';
import { animations } from '../utils/animations';
import { useWindowSize } from '../hooks/useWindowSize';
import { getDisplayProbability } from '../utils/probability';
import { cn } from '../utils/cn';
import {
  chartAxisTickLine,
  chartColors,
  chartGridProps,
  chartTooltipClassName,
  chartTooltipCompactClassName,
  getChartAxisTick,
} from '../utils/chartTheme';
import SectionHeader from './ui/SectionHeader';
import EmptyState from './ui/EmptyState';
import { SkeletonMetricCard, SkeletonCard } from './Skeleton';
import { getChampionshipMap } from '../utils/championshipUtils';

interface DashboardScreenProps {
  savedMatches: SavedAnalysis[];
  bankSettings?: BankSettings;
  onMatchClick?: (match: SavedAnalysis) => void;
  isLoading?: boolean;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({
  savedMatches,
  bankSettings,
  onMatchClick,
  isLoading = false,
}) => {
  const windowSize = useWindowSize();
  const stats = useMemo(
    () => calculateDashboardStats(savedMatches, bankSettings),
    [savedMatches, bankSettings]
  );
  const bankEvolutionData = useMemo(
    () => prepareBankEvolutionData(savedMatches, bankSettings),
    [savedMatches, bankSettings]
  );
  const resultDistributionData = useMemo(
    () => prepareResultDistributionData(savedMatches),
    [savedMatches]
  );

  // Partidas recentes (últimas 10)
  const recentMatches = useMemo(() => {
    return [...savedMatches].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  }, [savedMatches]);

  // Cores consistentes (alinhadas ao design system)
  const CHART_COLORS = {
    won: chartColors.won,
    lost: chartColors.lost,
    pending: chartColors.pending,
  };

  // Mapear dados para cores
  const getColorForCategory = (name: string): string => {
    if (name.toLowerCase().includes('ganha')) return CHART_COLORS.won;
    if (name.toLowerCase().includes('perdida')) return CHART_COLORS.lost;
    return CHART_COLORS.pending;
  };

  // Calcular total para percentuais
  const totalBets = resultDistributionData.reduce((sum, item) => sum + item.value, 0);

  // Estado para expandir por campeonato
  const [expandedChamp, setExpandedChamp] = useState<string | null>(null);
  const [championshipMap, setChampionshipMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    getChampionshipMap().then(setChampionshipMap);
  }, []);

  // Agrupar partidas por campeonato
  const matchesByChampionship = useMemo(() => {
    const groups = new Map<string, SavedAnalysis[]>();
    const uncategorized: SavedAnalysis[] = [];

    savedMatches.forEach((match) => {
      const id = match.data.championshipId;
      if (id) {
        const existing = groups.get(id) || [];
        existing.push(match);
        groups.set(id, existing);
      } else {
        uncategorized.push(match);
      }
    });

    const sorted = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
    if (uncategorized.length > 0) {
      sorted.push(['__uncategorized__', uncategorized]);
    }
    return sorted;
  }, [savedMatches]);

  // Stats por campeonato (expandido)
  const champStats = useMemo(() => {
    return new Map(
      matchesByChampionship.map(([id, matches]) => [id, calculateDashboardStats(matches, bankSettings)])
    );
  }, [matchesByChampionship, bankSettings]);

  const statCards = [
    {
      title: 'Total de Partidas',
      value: stats.totalMatches,
      icon: Activity,
      color: 'primary',
      subtitle: 'Análises realizadas',
    },
    {
      title: 'EV Médio',
      value: `${stats.averageEV > 0 ? '+' : ''}${stats.averageEV.toFixed(1)}%`,
      icon: TrendingUp,
      color: stats.averageEV > 0 ? 'success' : 'error',
      subtitle: `${stats.positiveEVCount} com EV positivo`,
    },
    {
      title: 'Taxa de Acerto',
      value: `${stats.winRate.toFixed(1)}%`,
      icon: Target,
      color: 'primary',
      subtitle: 'Win rate',
    },
    {
      title: 'Lucro Total',
      value: `${getCurrencySymbol(bankSettings?.currency || 'BRL')} ${stats.totalProfit.toFixed(2)}`,
      icon: DollarSign,
      color: stats.totalProfit > 0 ? 'success' : stats.totalProfit < 0 ? 'error' : 'primary',
      subtitle:
        stats.totalProfit > 0 ? 'Lucro positivo' : stats.totalProfit < 0 ? 'Prejuízo' : 'Sem lucro',
    },
    {
      title: 'ROI',
      value: `${stats.roi > 0 ? '+' : ''}${stats.roi.toFixed(1)}%`,
      icon: Percent,
      color: stats.roi > 0 ? 'success' : 'error',
      subtitle: 'Return on Investment',
    },
    {
      title: 'Banca Atual',
      value: `${getCurrencySymbol(bankSettings?.currency || 'BRL')} ${stats.currentBank.toFixed(2)}`,
      icon: Wallet,
      color: 'primary',
      subtitle: 'Capital disponível',
    },
    {
      title: 'Média das Odds',
      value: stats.averageOdd > 0 ? stats.averageOdd.toFixed(2) : '-',
      icon: Hash,
      color: 'primary',
      subtitle: 'Odd média das partidas',
    },
  ];

  type StatCardTone = 'primary' | 'success' | 'error' | 'warning' | 'info';

  const toneClasses: Record<StatCardTone, { bg: string; border: string; text: string; accentBorder: string; gradient: string }> = {
    primary: { bg: 'bg-primary/10', border: 'border-primary/20', text: 'text-primary', accentBorder: 'border-l-primary/50', gradient: 'from-primary/5 via-transparent to-transparent' },
    success: { bg: 'bg-success/10', border: 'border-success/20', text: 'text-success', accentBorder: 'border-l-success/50', gradient: 'from-success/5 via-transparent to-transparent' },
    error: { bg: 'bg-error/10', border: 'border-error/20', text: 'text-error', accentBorder: 'border-l-error/50', gradient: 'from-error/5 via-transparent to-transparent' },
    warning: { bg: 'bg-warning/10', border: 'border-warning/20', text: 'text-warning', accentBorder: 'border-l-warning/50', gradient: 'from-warning/5 via-transparent to-transparent' },
    info: { bg: 'bg-info/10', border: 'border-info/20', text: 'text-info', accentBorder: 'border-l-info/50', gradient: 'from-info/5 via-transparent to-transparent' },
  };

  const getTone = (tone: string): StatCardTone => {
    return (tone in toneClasses ? tone : 'primary') as StatCardTone;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 md:space-y-8 pb-20 md:pb-8 animate-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4 md:gap-6">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonMetricCard key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <SkeletonCard lines={8} />
          <SkeletonCard lines={8} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8">
      {/* Grid de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4 md:gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          const tone = getTone(card.color);
          const toneClass = toneClasses[tone];
          return (
            <motion.div
              key={card.title}
              variants={animations.fadeInUp}
              initial="initial"
              animate="animate"
              custom={index}
              className={`relative overflow-hidden rounded-2xl border border-base-300/50 bg-base-200/80 p-4 md:p-5 border-l-4 ring-1 ring-base-300/20 ${toneClass.accentBorder} hover:bg-base-200/95 transition-all duration-200`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${toneClass.gradient} opacity-60 pointer-events-none`} />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-2">
                  <div
                    className={cn('p-2 rounded-xl border', toneClass.bg, toneClass.border)}
                  >
                    <Icon className={cn('w-4 h-4 md:w-5 md:h-5', toneClass.text)} />
                  </div>
                  {card.title === 'Lucro Total' && (
                    <div>
                      {stats.totalProfit > 0 ? (
                        <ArrowUpRight className="w-4 h-4 text-success" />
                      ) : stats.totalProfit < 0 ? (
                        <ArrowDownRight className="w-4 h-4 text-error" />
                      ) : null}
                    </div>
                  )}
                </div>
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.12em] text-base-content/50 mb-1">
                  {card.title}
                </p>
                <p className={`text-xl sm:text-2xl md:text-3xl font-black leading-none tracking-tight ${toneClass.text}`}>
                  {card.value}
                </p>
                <p className="text-[10px] md:text-xs text-base-content/40 mt-1.5">{card.subtitle}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Evolução da Banca */}
        {bankEvolutionData.length > 0 && (
          <motion.div
            variants={animations.fadeInUp}
            initial="initial"
            animate="animate"
            className="relative overflow-hidden rounded-2xl border border-base-300/50 bg-base-200/80 p-4 md:p-6 border-l-4 border-l-primary/40"
          >
            <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
            <SectionHeader
              className="mb-4"
              title="Evolução da Banca"
              subtitle="Cash (disponível) e Equity (cash + pendentes) ao longo do tempo"
              icon={
                <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                  <TrendingUp className="w-4 h-5 text-primary" />
                </div>
              }
            />
            <ResponsiveContainer width="100%" height={windowSize.isMobile ? 250 : 350}>
              <AreaChart
                data={bankEvolutionData}
                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="bankEquityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.equity} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={chartColors.equity} stopOpacity={0} />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid {...chartGridProps} />
                <XAxis
                  dataKey="date"
                  tick={getChartAxisTick(windowSize.isMobile)}
                  tickLine={chartAxisTickLine}
                />
                <YAxis
                  tick={getChartAxisTick(windowSize.isMobile)}
                  tickLine={chartAxisTickLine}
                  tickFormatter={(value) => `${getCurrencySymbol(bankSettings?.currency || 'BRL')} ${value.toFixed(0)}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const p = payload[0].payload as {
                        date: string;
                        timestamp: number;
                        cash: number;
                        equity: number;
                      };
                      const currentIndex = bankEvolutionData.findIndex(
                        (d) => d.timestamp === p.timestamp
                      );
                      const previousValue =
                        currentIndex > 0 ? bankEvolutionData[currentIndex - 1] : null;

                      const cashChange =
                        previousValue !== null ? p.cash - previousValue.cash : null;
                      const equityChange =
                        previousValue !== null ? p.equity - previousValue.equity : null;

                      return (
                        <div className={chartTooltipClassName}>
                          <div className="mb-2">
                            <p className="text-xs opacity-70 mb-1">{p.date}</p>
                            <div className="flex items-baseline gap-2">
                              <p className="text-2xl font-black text-primary">{getCurrencySymbol(bankSettings?.currency || 'BRL')} {p.cash.toFixed(2)}</p>
                              {cashChange !== null && (
                                <span
                                  className={`text-sm font-bold flex items-center gap-1 ${
                                    cashChange > 0
                                      ? 'text-success'
                                      : cashChange < 0
                                        ? 'text-error'
                                        : ''
                                  }`}
                                >
                                  {cashChange > 0 ? (
                                    <TrendingUp className="w-3 h-3" />
                                  ) : cashChange < 0 ? (
                                    <ArrowDownRight className="w-3 h-3" />
                                  ) : null}
                                  {cashChange > 0 ? '+' : ''}
                                  {cashChange.toFixed(2)}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 text-xs opacity-80">
                              <div className="flex items-center justify-between gap-3">
                                <span className="opacity-70">Equity</span>
                                <span className="font-bold">{getCurrencySymbol(bankSettings?.currency || 'BRL')} {p.equity.toFixed(2)}</span>
                              </div>
                              {equityChange !== null && (
                                <div className="flex items-center justify-between gap-3 mt-1">
                                  <span className="opacity-70">Δ</span>
                                  <span
                                    className={`font-bold ${
                                      equityChange > 0
                                        ? 'text-success'
                                        : equityChange < 0
                                          ? 'text-error'
                                          : ''
                                    }`}
                                  >
                                    {equityChange > 0 ? '+' : ''}
                                    {equityChange.toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke={chartColors.equity}
                  strokeWidth={2}
                  fill="url(#bankEquityGradient)"
                  fillOpacity={1}
                  animationBegin={0}
                  animationDuration={1000}
                  animationEasing="ease-in-out"
                />
                <Line
                  type="monotone"
                  dataKey="cash"
                  stroke={chartColors.cash}
                  strokeWidth={3}
                  dot={{
                    fill: chartColors.cash,
                    strokeWidth: 2,
                    stroke: chartColors.text,
                    r: windowSize.isMobile ? 4 : 5,
                    filter: 'url(#glow)',
                  }}
                  activeDot={{
                    r: windowSize.isMobile ? 7 : 8,
                    stroke: chartColors.text,
                    strokeWidth: 2,
                    filter: 'url(#glow)',
                  }}
                  animationBegin={0}
                  animationDuration={1000}
                  animationEasing="ease-in-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Distribuição de Resultados */}
        {resultDistributionData.some((d) => d.value > 0) && (
          <motion.div
            variants={animations.fadeInUp}
            initial="initial"
            animate="animate"
            className="relative overflow-hidden rounded-2xl border border-base-300/50 bg-base-200/80 p-4 md:p-6 border-l-4 border-l-accent/40"
          >
            <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-accent/8 blur-3xl pointer-events-none" />
            <SectionHeader
              className="mb-4"
              title="Distribuição de Resultados"
              subtitle="Breakdown das apostas"
              icon={
                <div className="p-1.5 rounded-lg bg-accent/10 border border-accent/20">
                  <BarChart3 className="w-4 h-5 text-accent" />
                </div>
              }
            />
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8">
              <ResponsiveContainer width="100%" height={windowSize.isMobile ? 250 : 300}>
                <PieChart>
                  <defs>
                    <filter id="shadow">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
                    </filter>
                  </defs>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0];
                        const percentage =
                          totalBets > 0
                            ? (((data.value as number) / totalBets) * 100).toFixed(1)
                            : '0';
                        const color = getColorForCategory(data.name as string);
                        const icon =
                          data.name === 'Ganhas'
                            ? CheckCircle
                            : data.name === 'Perdidas'
                              ? XCircle
                              : Clock;
                        const Icon = icon;

                        return (
                          <div className={chartTooltipCompactClassName}>
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                              <span className="font-bold text-sm">{data.name}</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-baseline gap-2">
                                <Icon className="w-4 h-4" style={{ color }} />
                                <p className="text-2xl font-black" style={{ color }}>
                                  {data.value}
                                </p>
                              </div>
                              <p className="text-xs opacity-70">{percentage}% do total</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={resultDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={windowSize.isMobile ? 50 : 70}
                    outerRadius={windowSize.isMobile ? 90 : 110}
                    paddingAngle={6}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={800}
                    animationEasing="ease-out"
                  >
                    {resultDistributionData.map((entry, index) => {
                      const color = getColorForCategory(entry.name);
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={color}
                          style={{
                            filter: 'url(#shadow)',
                            transition: 'opacity 0.2s',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.8';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1';
                          }}
                        />
                      );
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 w-full md:w-auto min-w-[180px]">
                {resultDistributionData.map((item) => {
                  const color = getColorForCategory(item.name);
                  const percentage =
                    totalBets > 0 ? ((item.value / totalBets) * 100).toFixed(1) : '0';
                  const icon =
                    item.name === 'Ganhas'
                      ? CheckCircle
                      : item.name === 'Perdidas'
                        ? XCircle
                        : Clock;
                  const Icon = icon;

                  return (
                    <div
                      key={item.name}
                      className="flex items-center gap-3 p-3 rounded-xl bg-base-300/30 hover:bg-base-300/50 transition-all duration-200 border border-transparent hover:border-base-300/40"
                    >
                      <div
                        className="w-4 h-4 rounded-full shadow-md flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" style={{ color }} />
                          <span className="text-xs md:text-sm font-bold">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-base md:text-lg font-black" style={{ color }}>
                            {item.value}
                          </span>
                          <span className="text-[10px] md:text-xs text-base-content/40">({percentage}%)</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Tabela de Partidas Recentes */}
      {recentMatches.length > 0 && (
        <motion.div
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
          className="relative overflow-hidden rounded-2xl border border-base-300/50 bg-base-200/80 p-4 md:p-6 border-l-4 border-l-info/40"
        >
          <div className="absolute -top-16 -right-16 h-36 w-36 rounded-full bg-info/6 blur-3xl pointer-events-none" />
          <div className="mb-4 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-info/10 border border-info/20">
                <Activity className="w-4 h-5 text-info" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-black tracking-tight">Partidas Recentes</h3>
                <p className="text-xs md:text-sm text-base-content/40 mt-0.5">Suas últimas 10 análises</p>
              </div>
            </div>
            <div className="accent-line-info" />
          </div>
            <div className="overflow-x-auto custom-scrollbar -mx-2">
            <table className="w-full">
              <thead>
                <tr className="border-b border-base-300/30 bg-base-300/10">
                  <th className="text-left py-3 px-3 text-[10px] md:text-xs font-bold text-base-content/50 uppercase tracking-wider">
                    Partida
                  </th>
                  <th className="text-right py-3 px-3 text-[10px] md:text-xs font-bold text-base-content/50 uppercase tracking-wider">
                    Odd
                  </th>
                  <th className="text-right py-3 px-3 text-[10px] md:text-xs font-bold text-base-content/50 uppercase tracking-wider">
                    EV
                  </th>
                  <th className="text-center py-3 px-3 text-[10px] md:text-xs font-bold text-base-content/50 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right py-3 px-3 text-[10px] md:text-xs font-bold text-base-content/50 uppercase tracking-wider">
                    Lucro/Prejuízo
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentMatches.map((match) => {
                  const hasBet = match.betInfo && match.betInfo.betAmount > 0;
                  const profit =
                    hasBet && match.betInfo?.status === 'won'
                      ? match.betInfo.potentialProfit
                      : hasBet && match.betInfo?.status === 'lost'
                        ? -match.betInfo.betAmount
                        : 0;

                  // Calcular EV usando a mesma lógica dos cards (considera probabilidade selecionada/combinada)
                  const probability = getDisplayProbability(match);
                  const displayEv = match.data.oddOver15 && match.data.oddOver15 > 1
                    ? ((probability / 100) * match.data.oddOver15 - 1) * 100
                    : match.result.ev;

                  return (
                    <tr
                      key={match.id}
                      onClick={() => onMatchClick?.(match)}
                      className="border-b border-base-300/20 hover:bg-base-300/20 transition-all duration-150 cursor-pointer group relative"
                    >
                      <td className="py-3 px-3">
                        <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-primary/0 group-hover:bg-primary/40 transition-all duration-200" />
                        <div className="text-xs md:text-sm font-semibold leading-snug group-hover:text-primary transition-colors">
                          {match.data.homeTeam} vs {match.data.awayTeam}
                        </div>
                        <div className="text-[10px] md:text-xs text-base-content/40 mt-0.5">
                          {formatTimestampInBrasilia(match.timestamp)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs md:text-sm font-semibold tabular-nums">
                        {match.data.oddOver15?.toFixed(2) || '-'}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right text-xs md:text-sm font-semibold tabular-nums ${
                          displayEv > 0
                            ? 'text-success'
                            : displayEv < 0
                              ? 'text-error'
                              : ''
                        }`}
                      >
                        {displayEv > 0 ? '+' : ''}
                        {displayEv.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {hasBet ? (
                          <span
                            className={`badge badge-sm ${
                              match.betInfo?.status === 'won'
                                ? 'badge-success'
                                : match.betInfo?.status === 'lost'
                                  ? 'badge-error'
                                  : 'badge-warning'
                            }`}
                          >
                            {match.betInfo?.status === 'won'
                              ? 'Ganhou'
                              : match.betInfo?.status === 'lost'
                                ? 'Perdeu'
                                : 'Pendente'}
                          </span>
                        ) : (
                          <span className="badge badge-sm badge-ghost">Sem aposta</span>
                        )}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right text-xs md:text-sm font-semibold tabular-nums ${
                          profit > 0 ? 'text-success' : profit < 0 ? 'text-error' : ''
                        }`}
                      >
                        {profit !== 0 ? (
                          <>
                            {profit > 0 ? '+' : ''}
                            {getCurrencySymbol(bankSettings?.currency || 'BRL')}{' '}
                            {Math.abs(profit).toFixed(2)}
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {savedMatches.length === 0 && (
        <EmptyState
          icon={<Activity className="w-12 h-12 md:w-14 md:h-14" aria-hidden="true" />}
          title="Nenhuma Partida Ainda"
          description="Comece criando análises de partidas para ver estatísticas e gráficos aqui."
        />
      )}

      {/* Expandir por Campeonato */}
      {savedMatches.length > 0 && matchesByChampionship.length > 0 && (
        <motion.div
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
          className="relative overflow-hidden rounded-2xl border border-base-300/50 bg-base-200/80 p-4 md:p-6 border-l-4 border-l-secondary/40"
        >
          <div className="absolute -top-20 -right-20 h-44 w-44 rounded-full bg-secondary/6 blur-3xl pointer-events-none" />

          <SectionHeader
            className="mb-4"
            icon={
              <div className="p-1.5 rounded-lg bg-secondary/10 border border-secondary/20">
                <BarChart3 className="w-4 h-5 text-secondary" />
              </div>
            }
            title="Estatisticas por Campeonato"
            subtitle={`${matchesByChampionship.length} campeonato(s) — clique para expandir`}
          />

          <div className="space-y-2 relative z-10">
            {matchesByChampionship.map(([id, matches]) => {
              const isUncategorized = id === '__uncategorized__';
              const name = isUncategorized ? 'Sem campeonato' : championshipMap.get(id) || 'Carregando...';
              const isExpanded = expandedChamp === id;
              const s = champStats.get(id);
              const matchCount = matches.length;

              return (
                <div
                  key={id}
                  className="rounded-xl border border-l-4 border-base-300/30 bg-base-300/20 overflow-hidden transition-all duration-200 hover:border-base-300/50"
                  style={{ borderLeftColor: isUncategorized ? 'var(--color-base-300)' : 'var(--color-primary)' }}
                >
                  {/* Header clicável */}
                  <button
                    onClick={() => setExpandedChamp(isExpanded ? null : id)}
                    className="w-full flex items-center gap-3 p-3 md:p-4 hover:bg-base-300/30 transition-colors text-left"
                  >
                    <div className={`p-2 rounded-lg shrink-0 transition-colors ${isUncategorized ? 'bg-base-300/40' : 'bg-primary/10'}`}>
                      {isUncategorized ? (
                        <Activity className="w-4 h-5 text-base-content/60" />
                      ) : (
                        <Trophy className="w-4 h-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm md:text-base truncate">{name}</span>
                        <span className="badge-subtle">{matchCount} partida{matchCount !== 1 ? 's' : ''}</span>
                      </div>
                      {s && (
                        <div className="flex items-center gap-3 mt-1 text-xs text-base-content/40">
                          <span>
                            EV{' '}
                            <span className={s.averageEV > 0 ? 'text-success font-semibold' : s.averageEV < 0 ? 'text-error font-semibold' : ''}>
                              {s.averageEV > 0 ? '+' : ''}{s.averageEV.toFixed(1)}%
                            </span>
                          </span>
                          {s.winRate > 0 && (
                            <span>
                              Acerto{' '}
                              <span className="text-success font-semibold">{s.winRate.toFixed(0)}%</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-base-content/40 transition-transform duration-200 shrink-0 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Conteúdo expansível */}
                  {isExpanded && s && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-base-300/20 px-3 md:px-4 pb-4 pt-3"
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {[
                          { label: 'Total', value: s.totalMatches, color: 'text-primary' },
                          { label: 'EV Medio', value: `${s.averageEV > 0 ? '+' : ''}${s.averageEV.toFixed(1)}%`, color: s.averageEV > 0 ? 'text-success' : 'text-error' },
                          { label: 'Acerto', value: `${s.winRate.toFixed(1)}%`, color: s.winRate > 50 ? 'text-success' : s.winRate > 0 ? 'text-warning' : 'text-base-content/60' },
                          { label: 'Lucro', value: `${getCurrencySymbol(bankSettings?.currency || 'BRL')} ${s.totalProfit.toFixed(2)}`, color: s.totalProfit > 0 ? 'text-success' : s.totalProfit < 0 ? 'text-error' : '' },
                          { label: 'ROI', value: `${s.roi > 0 ? '+' : ''}${s.roi.toFixed(1)}%`, color: s.roi > 0 ? 'text-success' : 'text-error' },
                          { label: 'EV+', value: s.positiveEVCount, color: 'text-success' },
                          { label: 'Prob. Media', value: `${s.avgProbability.toFixed(1)}%`, color: 'text-info' },
                          { label: 'Odd Media', value: s.averageOdd > 0 ? s.averageOdd.toFixed(2) : '-', color: '' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="bg-base-300/30 rounded-xl p-2.5 text-center">
                            <p className="text-[9px] text-base-content/40 uppercase tracking-wider mb-0.5">{label}</p>
                            <p className={`text-xs md:text-sm font-black tabular-nums ${color}`}>{value}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DashboardScreen;
