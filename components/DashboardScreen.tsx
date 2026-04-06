
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

  const statCardsFiltered = bankSettings
    ? statCards.filter((c) => c.title !== 'Banca Atual')
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

  const BankHero = bankSettings ? (
    <motion.div
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
      className="card bg-gradient-to-br from-primary/18 via-base-100 to-base-100 border-2 border-primary/35 shadow-xl ring-1 ring-base-content/10 p-6 md:p-10"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs md:text-sm font-black uppercase tracking-widest text-base-content/70 mb-2">Saldo da banca</p>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0 font-black text-primary leading-none">
            <span className="text-3xl sm:text-4xl tabular-nums shrink-0">{getCurrencySymbol(bankSettings.currency)}</span>
            <span className="text-5xl sm:text-6xl md:text-7xl tabular-nums tracking-tight break-all sm:break-normal">
              {stats.currentBank.toFixed(2)}
            </span>
          </div>
          <p className="text-sm md:text-base text-base-content/70 mt-3 font-medium">Capital disponível para suas apostas</p>
        </div>
        {bankTrendData.length > 1 && (
          <div className="w-full lg:w-[min(100%,280px)] h-[120px] shrink-0">
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
                <Area type="monotone" dataKey="equity" stroke={chartColors.equity} strokeWidth={2} fill="url(#bankHeroTrend)" fillOpacity={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  ) : null;

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8">
      {bankSettings && savedMatches.length === 0 && BankHero}
      {savedMatches.length > 0 ? (
        <>
          {bankSettings && BankHero}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-base-content/55 mb-3">Resumo rápido</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 md:gap-6">
            {statCardsFiltered.map((card, index) => {
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
                  initial="initial"
                  animate="animate"
                  custom={index}
                  className="card bg-base-100 shadow-sm border border-base-content/12 p-4 md:p-6"
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
                    <p className="text-xs md:text-sm font-semibold text-base-content/70 uppercase tracking-wide mb-1.5 leading-tight">
                      {card.title}
                    </p>
                    <p className={`text-2xl md:text-3xl font-black leading-none ${valueColor}`}>
                      {card.value}
                    </p>
                    <p className="text-xs text-base-content/60 mt-1.5 leading-relaxed">{card.subtitle}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            {bankEvolutionData.length > 0 && (
              <motion.div
                variants={animations.fadeInUp}
                initial="initial"
                animate="animate"
                className="card bg-base-100 shadow-sm border border-base-content/12 p-4 md:p-6"
              >
                <SectionHeader
                  className="mb-4"
                  title="Evolução da Banca"
                  subtitle="Cash (disponível) e Equity (cash + pendentes) ao longo do tempo"
                />
                <ResponsiveContainer width="100%" height={windowSize.isMobile ? 250 : 350}>
                  <AreaChart data={bankEvolutionData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="bankEquityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors.equity} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={chartColors.equity} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...chartGridProps} />
                    <XAxis dataKey="date" tick={getChartAxisTick(windowSize.isMobile)} tickLine={chartAxisTickLine} />
                    <YAxis tick={getChartAxisTick(windowSize.isMobile)} tickLine={chartAxisTickLine} tickFormatter={(value) => `R$ ${value.toFixed(0)}`} />
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
              </motion.div>
            )}

            {resultDistributionData.some((d) => d.value > 0) && (
              <motion.div
                variants={animations.fadeInUp}
                initial="initial"
                animate="animate"
                className="card bg-base-100 shadow-sm border border-base-content/12 p-4 md:p-6"
              >
                <SectionHeader className="mb-4" title="Distribuição de Resultados" subtitle="Breakdown das apostas" />
                <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8">
                  <ResponsiveContainer width="100%" height={windowSize.isMobile ? 250 : 300}>
                    <PieChart>
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
                      <Pie data={resultDistributionData} cx="50%" cy="50%" innerRadius={windowSize.isMobile ? 50 : 70} outerRadius={windowSize.isMobile ? 90 : 110} paddingAngle={5} dataKey="value">
                        {resultDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getColorForCategory(entry.name)} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3 w-full md:w-auto">
                    {resultDistributionData.map((item) => {
                      const color = getColorForCategory(item.name);
                      const percentage = totalBets > 0 ? ((item.value / totalBets) * 100).toFixed(1) : '0';
                      return (
                        <div key={item.name} className="flex items-center gap-3 text-sm">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-bold">{item.name}</span>
                          <span className="text-base-content/70 ml-auto">{item.value}</span>
                          <span className="text-xs text-base-content/50">({percentage}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {recentMatches.length > 0 && (
            <motion.div
              variants={animations.fadeInUp}
              initial="initial"
              animate="animate"
              className="card bg-base-100 shadow-sm border border-base-content/12 p-4 md:p-6"
            >
              <SectionHeader
                className="mb-4 md:mb-6"
                title="Partidas recentes"
                subtitle="Abra cada jogo para ver detalhes — use o botão para ir à análise completa"
              />
              <div className="flex flex-col gap-2 md:gap-3">
                {recentMatches.map((match) => {
                  const hasBet = match.betInfo && match.betInfo.betAmount > 0;
                  const profit =
                    hasBet && match.betInfo?.status === 'won'
                      ? match.betInfo.potentialProfit
                      : hasBet && match.betInfo?.status === 'lost'
                        ? -match.betInfo.betAmount
                        : 0;
                  const displayEv = getDisplayEV(match);
                  const isOpen = expandedMatchId === match.id;

                  return (
                    <div
                      key={match.id}
                      className="collapse collapse-arrow rounded-xl border border-base-content/15 bg-base-200/80 shadow-sm"
                    >
                      <input
                        type="checkbox"
                        checked={isOpen}
                        onChange={(e) => setExpandedMatchId(e.target.checked ? match.id : null)}
                        aria-expanded={isOpen}
                        aria-controls={`recent-match-${match.id}`}
                        className="min-h-0"
                      />
                      <div className="collapse-title py-3 md:py-4 pr-10 text-left font-bold text-sm md:text-base leading-snug">
                        <span className="line-clamp-2">
                          {match.data.homeTeam}{' '}
                          <span className="text-primary font-black">vs</span> {match.data.awayTeam}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 font-normal">
                          <span className="text-xs text-base-content/60">{formatTimestampInBrasilia(match.timestamp)}</span>
                          <span
                            className={`badge badge-sm font-bold tabular-nums ${displayEv > 0 ? 'badge-success' : displayEv < 0 ? 'badge-error' : 'badge-ghost'}`}
                          >
                            EV {displayEv > 0 ? '+' : ''}
                            {displayEv.toFixed(1)}%
                          </span>
                        </span>
                      </div>
                      <div className="collapse-content" id={`recent-match-${match.id}`}>
                        <div className="pb-4 pt-0 border-t border-base-content/10 mt-0">
                          <p className="text-xs text-base-content/65 mb-3">Resumo da análise salva</p>
                          <div className="flex flex-wrap gap-2 mb-3">
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
                                className={`badge badge-sm ${match.betInfo?.status === 'won' ? 'badge-success' : match.betInfo?.status === 'lost' ? 'badge-error' : 'badge-warning'}`}
                              >
                                {match.betInfo?.status === 'won' ? 'Ganhou' : match.betInfo?.status === 'lost' ? 'Perdeu' : 'Pendente'}
                              </span>
                            ) : (
                              <span className="badge badge-sm badge-ghost">Sem aposta</span>
                            )}
                          </div>
                          <p
                            className={`text-sm font-bold tabular-nums mb-4 ${profit > 0 ? 'text-success' : profit < 0 ? 'text-error' : 'text-base-content/55'}`}
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
                      </div>
                    </div>
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
          className="card bg-base-100 border-2 border-dashed border-base-300 p-12 md:p-16 flex flex-col items-center justify-center text-center"
        >
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-6">
            <Activity className="w-12 h-12 md:w-16 md:h-16 text-primary opacity-60" />
          </div>
          <h3 className="text-2xl md:text-3xl font-black mb-3 text-base-content">Nenhuma Partida Ainda</h3>
          <p className="text-sm md:text-base text-base-content/70 max-w-md">
            Comece criando análises de partidas para ver estatísticas e gráficos aqui.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default DashboardScreen;
