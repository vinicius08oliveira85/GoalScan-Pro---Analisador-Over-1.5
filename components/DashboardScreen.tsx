
import React, { useMemo, useState } from 'react';
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
  Hash,
  Sparkles,
  ChevronDown,
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
import { getBetDisplayFinancials } from '../utils/betFinancials';
import { animations } from '../utils/animations';
import { useWindowSize } from '../hooks/useWindowSize';
import { getDisplayEV } from '../utils/betMetrics';
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
import DashboardLoadingSkeleton from './DashboardLoadingSkeleton';

interface DashboardScreenProps {
  savedMatches: SavedAnalysis[];
  bankSettings?: BankSettings;
  onMatchClick?: (match: SavedAnalysis) => void;
  isLoading: boolean;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({
  savedMatches,
  bankSettings,
  onMatchClick,
  isLoading,
}) => {
  const windowSize = useWindowSize();
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

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

  const recentMatches = useMemo(() => {
    return [...savedMatches].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  }, [savedMatches]);

  const bankTrendData = useMemo(() => {
    if (bankEvolutionData.length === 0) return [];
    return bankEvolutionData.slice(-20);
  }, [bankEvolutionData]);

  if (isLoading) {
    return <DashboardLoadingSkeleton />;
  }

  const CHART_COLORS = {
    won: chartColors.won,
    lost: chartColors.lost,
    pending: chartColors.pending,
  };

  const getColorForCategory = (name: string): string => {
    if (name.toLowerCase().includes('ganha')) return CHART_COLORS.won;
    if (name.toLowerCase().includes('perdida')) return CHART_COLORS.lost;
    return CHART_COLORS.pending;
  };

  const totalBets = resultDistributionData.reduce((sum, item) => sum + item.value, 0);

  const showBankEvolutionChart = bankEvolutionData.length > 0;
  const showResultPieChart = resultDistributionData.some((d) => d.value > 0);
  const onlyOneMainChart =
    (showBankEvolutionChart && !showResultPieChart) || (!showBankEvolutionChart && showResultPieChart);

  const bankChartHeight = windowSize.isMobile ? 232 : windowSize.isTablet ? 288 : 328;
  const areaChartMargin = {
    top: 8,
    right: windowSize.isMobile ? 4 : 12,
    left: windowSize.isMobile ? 0 : 4,
    bottom: windowSize.isMobile ? 20 : 8,
  } as const;

  const statCards = [
    {
      title: 'Total de Partidas',
      value: stats.totalMatches,
      icon: Activity,
      color: 'neutral',
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
      color: stats.totalProfit > 0 ? 'success' : stats.totalProfit < 0 ? 'error' : 'neutral',
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
      color: 'info',
      subtitle: 'Odd média das partidas',
    },
  ];

  const bankHeroMetricTitles = new Set(['Banca Atual', 'Lucro Total', 'Taxa de Acerto', 'ROI']);
  const statCardsFiltered = bankSettings
    ? statCards.filter((c) => !bankHeroMetricTitles.has(c.title))
    : statCards;

  type StatCardTone = 'primary' | 'success' | 'error' | 'warning' | 'info' | 'neutral';

  const toneClasses: Record<StatCardTone, { bg: string; border: string; text: string }> = {
    primary: { bg: 'bg-primary/10', border: 'border-primary/20', text: 'text-primary' },
    success: { bg: 'bg-success/10', border: 'border-success/20', text: 'text-success' },
    error: { bg: 'bg-error/10', border: 'border-error/20', text: 'text-error' },
    warning: { bg: 'bg-warning/10', border: 'border-warning/20', text: 'text-warning' },
    info: { bg: 'bg-info/10', border: 'border-info/20', text: 'text-info' },
    neutral: { bg: 'bg-neutral-content/10', border: 'border-neutral-content/20', text: 'text-neutral' }
  };

  const getTone = (tone: string): StatCardTone => {
    return (tone in toneClasses ? tone : 'primary') as StatCardTone;
  };

  const bankHeroGlassCard =
    'relative overflow-hidden rounded-3xl border border-white/10 bg-base-100/40 shadow-xl shadow-black/10 ring-1 ring-white/5 backdrop-blur-xl dark:border-white/10 dark:bg-base-100/25 dark:shadow-black/30';

  const BankHeroMetricsGrid = bankSettings ? (
    <motion.section
      aria-label="Resumo da banca"
      variants={animations.staggerChildren}
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-5"
    >
      <motion.div
        variants={animations.fadeInUp}
        className={cn(
          bankHeroGlassCard,
          'bg-gradient-to-br from-primary/12 via-base-100/35 to-transparent p-5 md:p-6'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/15 text-primary shadow-inner shadow-primary/10">
                <Wallet className="h-7 w-7 md:h-8 md:w-8" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-widest text-base-content/60">Banca Atual</p>
                <p className="mt-1 break-all text-2xl font-black tabular-nums leading-none text-primary sm:text-3xl md:break-normal">
                  {getCurrencySymbol(bankSettings.currency)} {stats.currentBank.toFixed(2)}
                </p>
              </div>
            </div>
            <p className="text-xs font-medium leading-snug text-base-content/55 md:text-sm">Capital disponível</p>
          </div>
        </div>
        {bankTrendData.length > 1 && (
          <div className="mt-4 h-[100px] w-full min-w-0 sm:h-[110px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bankTrendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bankHeroTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.equity} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={chartColors.equity} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload?.length) {
                      const p = payload[0].payload as { date: string; equity: number };
                      return (
                        <div className={chartTooltipCompactClassName}>
                          <span className="font-bold">{p.date}</span>
                          <span className="ml-2 tabular-nums">R$ {p.equity.toFixed(2)}</span>
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
                  fill="url(#bankHeroTrend)"
                  fillOpacity={1}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      <motion.div
        variants={animations.fadeInUp}
        className={cn(
          bankHeroGlassCard,
          'via-base-100/35 to-transparent p-5 md:p-6 bg-gradient-to-br',
          stats.totalProfit >= 0 ? 'from-success/12' : 'from-error/12'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-inner',
              stats.totalProfit >= 0
                ? 'border-success/25 bg-success/15 text-success'
                : 'border-error/25 bg-error/15 text-error'
            )}
          >
            <DollarSign className="h-7 w-7 md:h-8 md:w-8" aria-hidden />
          </div>
          {stats.totalProfit > 0 ? (
            <ArrowUpRight className="h-5 w-5 shrink-0 text-success" aria-hidden />
          ) : stats.totalProfit < 0 ? (
            <ArrowDownRight className="h-5 w-5 shrink-0 text-error" aria-hidden />
          ) : null}
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-widest text-base-content/60">Lucro Total</p>
        <p
          className={cn(
            'mt-2 text-2xl font-black tabular-nums leading-none sm:text-3xl',
            stats.totalProfit > 0 ? 'text-success' : stats.totalProfit < 0 ? 'text-error' : 'text-base-content/80'
          )}
        >
          {getCurrencySymbol(bankSettings.currency)} {stats.totalProfit.toFixed(2)}
        </p>
      </motion.div>

      <motion.div
        variants={animations.fadeInUp}
        className={cn(
          bankHeroGlassCard,
          'bg-gradient-to-br from-secondary/12 via-base-100/35 to-transparent p-5 md:p-6'
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-secondary/25 bg-secondary/15 text-secondary shadow-inner shadow-secondary/10">
          <Target className="h-7 w-7 md:h-8 md:w-8" aria-hidden />
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-widest text-base-content/60">Taxa de Acerto</p>
        <p className="mt-2 text-2xl font-black tabular-nums leading-none text-primary sm:text-3xl">{stats.winRate.toFixed(1)}%</p>
        <p className="mt-2 text-xs font-medium text-base-content/55">Win rate</p>
      </motion.div>

      <motion.div
        variants={animations.fadeInUp}
        className={cn(
          bankHeroGlassCard,
          'via-base-100/35 to-transparent p-5 md:p-6 bg-gradient-to-br',
          stats.roi >= 0 ? 'from-info/12' : 'from-error/12'
        )}
      >
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-2xl border shadow-inner',
            stats.roi >= 0 ? 'border-info/25 bg-info/15 text-info' : 'border-error/25 bg-error/15 text-error'
          )}
        >
          <Percent className="h-7 w-7 md:h-8 md:w-8" aria-hidden />
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-widest text-base-content/60">ROI</p>
        <p
          className={cn(
            'mt-2 text-2xl font-black tabular-nums leading-none sm:text-3xl',
            stats.roi > 0 ? 'text-success' : stats.roi < 0 ? 'text-error' : 'text-base-content/80'
          )}
        >
          {stats.roi > 0 ? '+' : ''}
          {stats.roi.toFixed(1)}%
        </p>
        <p className="mt-2 text-xs font-medium text-base-content/55">Return on Investment</p>
      </motion.div>
    </motion.section>
  ) : null;

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8">
      {bankSettings && savedMatches.length === 0 && BankHeroMetricsGrid}
      {savedMatches.length > 0 ? (
        <>
          {bankSettings && BankHeroMetricsGrid}
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-widest opacity-60">Resumo rápido</p>
          </div>
          <motion.div
            variants={animations.staggerChildren}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 md:gap-6"
          >
            {statCardsFiltered.map((card) => {
              const Icon = card.icon;
              const tone = getTone(card.color);
              const toneClass = toneClasses[tone];
              const valueColor = 
                card.color === 'success' ? 'text-success' 
                : card.color === 'error' ? 'text-error' 
                : card.color === 'primary' ? 'text-primary'
                : card.color === 'info' ? 'text-info'
                : 'text-neutral';

              return (
                <motion.div
                  key={card.title}
                  variants={animations.fadeInUp}
                  className="custom-card rounded-3xl border border-white/10 bg-base-100/35 p-4 shadow-lg shadow-black/5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/10 dark:border-white/10 dark:bg-base-100/20 md:p-6"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn('p-2 md:p-3 rounded-xl border', toneClass.bg, toneClass.border)}>
                      <Icon className={cn('w-5 h-5 md:w-6 md:h-6', toneClass.text)} />
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
                  <div>
                    <p className="mb-1.5 text-xs font-black uppercase tracking-wide opacity-60 md:text-sm">
                      {card.title}
                    </p>
                    <p className={`text-2xl md:text-3xl font-black leading-none ${valueColor}`}>
                      {card.value}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed opacity-60">{card.subtitle}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:gap-8 md:grid-cols-2">
            {showBankEvolutionChart && (
              <motion.div
                variants={animations.fadeInUp}
                initial="initial"
                animate="animate"
                className={cn(
                  'min-w-0 w-full overflow-hidden rounded-3xl border border-white/10 bg-base-100/30 p-3 shadow-2xl shadow-primary/10 ring-1 ring-white/5 backdrop-blur-xl transition-shadow duration-300 hover:shadow-2xl hover:shadow-primary/15 dark:border-white/10 dark:bg-base-100/20 sm:p-4 md:p-6',
                  onlyOneMainChart && 'md:col-span-2 md:max-w-4xl md:justify-self-center'
                )}
              >
                <SectionHeader
                  className="mb-3 sm:mb-4"
                  title="Evolução da Banca"
                  subtitle="Cash (disponível) e Equity (cash + pendentes) ao longo do tempo"
                />
                <div className="relative w-full min-w-0 -mx-1 px-1 sm:mx-0 sm:px-0">
                  <ResponsiveContainer width="100%" height={bankChartHeight} debounce={50}>
                    <AreaChart data={bankEvolutionData} margin={areaChartMargin}>
                    <defs>
                      <linearGradient id="bankEquityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors.equity} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={chartColors.equity} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...chartGridProps} />
                    <XAxis
                      dataKey="date"
                      tick={getChartAxisTick(windowSize.isMobile)}
                      tickLine={chartAxisTickLine}
                      interval="preserveStartEnd"
                      angle={windowSize.isMobile ? -35 : 0}
                      textAnchor={windowSize.isMobile ? 'end' : 'middle'}
                      height={windowSize.isMobile ? 52 : 36}
                    />
                    <YAxis
                      width={windowSize.isMobile ? 44 : 56}
                      tick={getChartAxisTick(windowSize.isMobile)}
                      tickLine={chartAxisTickLine}
                      tickFormatter={(value) => `R$ ${value.toFixed(0)}`}
                    />
                    <Tooltip content={({ active, payload }) => {
                       if (active && payload && payload.length) {
                          const p = payload[0].payload as { date: string; timestamp: number; cash: number; equity: number; };
                          return (
                            <div className={chartTooltipClassName}>
                              <p className="text-sm font-bold mb-2">{p.date}</p>
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: chartColors.cash }}></span>
                                <span>Cash:</span>
                                <span className="font-bold ml-auto">R$ {p.cash.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: chartColors.equity }}></span>
                                <span>Equity:</span>
                                <span className="font-bold ml-auto">R$ {p.equity.toFixed(2)}</span>
                              </div>
                            </div>
                          );
                       }
                       return null;
                    }} />
                    <Area type="monotone" dataKey="equity" stroke={chartColors.equity} strokeWidth={2} fill="url(#bankEquityGradient)" fillOpacity={1} />
                    <Line type="monotone" dataKey="cash" stroke={chartColors.cash} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 7 }} />
                  </AreaChart>
                </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {showResultPieChart && (
              <motion.div
                variants={animations.fadeInUp}
                initial="initial"
                animate="animate"
                className={cn(
                  'min-w-0 w-full overflow-visible rounded-3xl border border-white/10 bg-base-100/30 p-3 shadow-2xl shadow-primary/10 ring-1 ring-white/5 backdrop-blur-xl transition-shadow duration-300 hover:shadow-2xl hover:shadow-primary/15 dark:border-white/10 dark:bg-base-100/20 sm:p-4 md:p-6',
                  onlyOneMainChart && 'md:col-span-2 md:max-w-4xl md:justify-self-center'
                )}
              >
                <SectionHeader className="mb-3 sm:mb-4" title="Distribuição de Resultados" subtitle="Breakdown das apostas" />
                {/* Coluna até lg: evita pizza + legenda lado a lado em ~350px (cortava o gráfico) */}
                <div className="flex min-w-0 flex-col items-stretch gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-center lg:gap-8">
                  <div className="mx-auto w-full min-w-0 max-w-[min(100%,320px)] shrink-0 lg:mx-0 lg:max-w-[min(100%,360px)] lg:flex-1">
                    <div className="mx-auto aspect-square w-full min-h-[200px] max-h-[min(92vw,320px)] lg:max-h-[280px]">
                      <ResponsiveContainer width="100%" height="100%" minHeight={200} debounce={50}>
                        <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                      <Tooltip content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                            const data = payload[0];
                            const percentage = totalBets > 0 ? (((data.value as number) / totalBets) * 100).toFixed(1) : '0';
                            return (
                                <div className={chartTooltipCompactClassName}>
                                    <span className="font-bold text-sm">{data.name}</span>: <span className="font-bold">{data.value}</span> ({percentage}%)
                                </div>
                            );
                        }
                        return null;
                      }} />
                      <Pie
                        data={resultDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius="42%"
                        outerRadius="72%"
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {resultDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getColorForCategory(entry.name)} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                    </div>
                  </div>
                  <ul className="grid w-full min-w-0 grid-cols-1 gap-2 sm:gap-3 xs:grid-cols-2 lg:flex lg:w-auto lg:min-w-[12rem] lg:max-w-[14rem] lg:flex-col lg:justify-center lg:shrink-0">
                    {resultDistributionData.map((item) => {
                      const color = getColorForCategory(item.name);
                      const percentage = totalBets > 0 ? ((item.value / totalBets) * 100).toFixed(1) : '0';
                      return (
                        <li
                          key={item.name}
                          className="flex min-w-0 items-center gap-2 rounded-lg border border-base-content/10 bg-base-200/40 px-3 py-2 text-sm sm:gap-3"
                        >
                          <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          <span className="min-w-0 truncate font-bold">{item.name}</span>
                          <span className="ml-auto shrink-0 tabular-nums text-base-content/70">{item.value}</span>
                          <span className="shrink-0 text-xs text-base-content/50">({percentage}%)</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </motion.div>
            )}
          </div>

          {recentMatches.length > 0 && (
            <motion.div
              variants={animations.fadeInUp}
              initial="initial"
              animate="animate"
              className="rounded-3xl border border-white/10 bg-base-100/30 p-4 shadow-xl shadow-black/5 ring-1 ring-white/5 backdrop-blur-xl dark:border-white/10 dark:bg-base-100/20 md:p-6"
            >
              <SectionHeader
                className="mb-4 md:mb-6"
                title="Partidas recentes"
                subtitle="Abra cada jogo para ver detalhes — use o botão para ir à análise completa"
              />
              <div className="flex flex-col gap-3 md:gap-4">
                {recentMatches.map((match) => {
                  const hasBet = match.betInfo && match.betInfo.betAmount > 0;
                  const profit =
                    hasBet && match.betInfo?.status === 'won'
                      ? getBetDisplayFinancials(match).potentialProfit
                      : hasBet && match.betInfo?.status === 'lost'
                        ? -match.betInfo.betAmount
                        : 0;
                  const displayEv = getDisplayEV(match);
                  const isOpen = expandedMatchId === match.id;
                  const betStatus = match.betInfo?.status;
                  const statusBarClass =
                    hasBet && betStatus === 'won'
                      ? 'bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.65)]'
                      : hasBet && betStatus === 'lost'
                        ? 'bg-rose-500 shadow-[0_0_16px_rgba(244,63,94,0.55)]'
                        : hasBet && (betStatus === 'pending' || betStatus === 'cancelled')
                          ? 'bg-amber-400/90 shadow-[0_0_12px_rgba(251,191,36,0.45)]'
                          : 'bg-base-content/20';

                  return (
                    <motion.div
                      key={match.id}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-base-200/50 shadow-md transition-all duration-200 hover:-translate-y-1 hover:border-primary/25 hover:bg-primary/5 hover:shadow-lg dark:border-white/10 dark:bg-base-200/40"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedMatchId(isOpen ? null : match.id)}
                        aria-expanded={isOpen}
                        aria-controls={`recent-match-${match.id}`}
                        className="flex w-full min-w-0 items-stretch gap-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <span
                          className={cn('w-1.5 shrink-0 self-stretch rounded-full', statusBarClass)}
                          aria-hidden
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-1 py-3 pl-3 pr-2 sm:flex-row sm:items-center sm:gap-3 sm:py-3.5 sm:pl-4">
                          <div className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-sm font-bold leading-snug md:text-base">
                              {match.data.homeTeam}{' '}
                              <span className="font-black text-primary">vs</span> {match.data.awayTeam}
                            </span>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="text-xs text-base-content/60">{formatTimestampInBrasilia(match.timestamp)}</span>
                              <span
                                className={`badge badge-sm font-bold tabular-nums ${displayEv > 0 ? 'badge-success' : displayEv < 0 ? 'badge-error' : 'badge-ghost'}`}
                              >
                                EV {displayEv > 0 ? '+' : ''}
                                {displayEv.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 self-center sm:flex-col sm:items-end">
                            {hasBet ? (
                              <span
                                className={`badge badge-sm font-black uppercase tracking-wide ${betStatus === 'won' ? 'border border-emerald-400/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : betStatus === 'lost' ? 'border border-rose-400/50 bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'badge-warning'}`}
                              >
                                {betStatus === 'won' ? 'Ganhou' : betStatus === 'lost' ? 'Perdeu' : 'Pendente'}
                              </span>
                            ) : (
                              <span className="badge badge-sm badge-ghost font-semibold">Sem aposta</span>
                            )}
                            <ChevronDown
                              className={cn(
                                'h-5 w-5 shrink-0 text-base-content/50 transition-transform duration-200',
                                isOpen && 'rotate-180'
                              )}
                              aria-hidden
                            />
                          </div>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="border-t border-base-content/10 px-3 pb-4 pt-3 sm:px-4" id={`recent-match-${match.id}`}>
                          <p className="mb-3 text-xs text-base-content/65">Resumo da análise salva</p>
                          <div className="mb-3 flex flex-wrap gap-2">
                            <span className="badge badge-ghost badge-sm font-mono tabular-nums">
                              Odd {match.data.oddOver15?.toFixed(2) || '—'}
                            </span>
                            <span
                              className={`badge badge-sm font-bold tabular-nums ${displayEv > 0 ? 'badge-success' : displayEv < 0 ? 'badge-error' : 'badge-ghost'}`}
                            >
                              EV {displayEv > 0 ? '+' : ''}
                              {displayEv.toFixed(1)}%
                            </span>
                            {hasBet ? (
                              <span
                                className={`badge badge-sm ${betStatus === 'won' ? 'badge-success' : betStatus === 'lost' ? 'badge-error' : 'badge-warning'}`}
                              >
                                {betStatus === 'won' ? 'Ganhou' : betStatus === 'lost' ? 'Perdeu' : 'Pendente'}
                              </span>
                            ) : (
                              <span className="badge badge-sm badge-ghost">Sem aposta</span>
                            )}
                          </div>
                          <p
                            className={`mb-4 text-sm font-bold tabular-nums ${profit > 0 ? 'text-success' : profit < 0 ? 'text-error' : 'text-base-content/55'}`}
                          >
                            {profit !== 0
                              ? `${profit > 0 ? 'Lucro +' : 'Prejuízo '}${getCurrencySymbol(bankSettings?.currency || 'BRL')} ${Math.abs(profit).toFixed(2)}`
                              : 'Sem resultado financeiro registrado'}
                          </p>
                          <button
                            type="button"
                            className="btn btn-primary btn-block sm:btn-wide"
                            onClick={() => onMatchClick?.(match)}
                          >
                            Abrir análise
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </>
      ) : (
        <motion.div
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
          className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-base-content/15 bg-base-100/25 p-12 text-center shadow-inner shadow-primary/5 backdrop-blur-xl dark:border-base-content/20 dark:bg-base-100/15 md:p-16"
        >
          <svg
            className="pointer-events-none absolute inset-0 mx-auto w-[min(100%,28rem)] opacity-[0.07]"
            viewBox="0 0 320 200"
            aria-hidden
          >
            <ellipse cx="160" cy="100" rx="120" ry="72" fill="none" stroke="currentColor" strokeWidth="1" />
            <ellipse cx="160" cy="100" rx="88" ry="52" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
          <div className="relative mb-6 flex h-28 w-28 items-center justify-center rounded-full border border-primary/25 bg-gradient-to-br from-primary/12 to-secondary/10 shadow-lg shadow-primary/10 md:h-36 md:w-36">
            <Sparkles className="h-14 w-14 text-primary opacity-35 md:h-[4.5rem] md:w-[4.5rem]" strokeWidth={1.25} aria-hidden />
          </div>
          <h3 className="relative text-2xl font-black text-base-content md:text-3xl">Nenhuma Partida Ainda</h3>
          <p className="relative mt-3 max-w-md text-sm text-base-content/70 md:text-base">
            Comece criando análises de partidas para ver estatísticas e gráficos aqui.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default DashboardScreen;
