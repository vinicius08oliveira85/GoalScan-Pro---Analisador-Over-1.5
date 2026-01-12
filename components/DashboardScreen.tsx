import React, { useMemo } from 'react';
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

interface DashboardScreenProps {
  savedMatches: SavedAnalysis[];
  bankSettings?: BankSettings;
  onMatchClick?: (match: SavedAnalysis) => void;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({
  savedMatches,
  bankSettings,
  onMatchClick,
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

  // Cores vibrantes para o gráfico de distribuição
  const CHART_COLORS = {
    won: '#22c55e', // Verde vibrante
    lost: '#ef4444', // Vermelho vibrante
    pending: '#f59e0b', // Amarelo/Laranja vibrante
  };

  // Mapear dados para cores
  const getColorForCategory = (name: string): string => {
    if (name.toLowerCase().includes('ganha')) return CHART_COLORS.won;
    if (name.toLowerCase().includes('perdida')) return CHART_COLORS.lost;
    return CHART_COLORS.pending;
  };

  // Calcular total para percentuais
  const totalBets = resultDistributionData.reduce((sum, item) => sum + item.value, 0);

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

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8">
      {/* Grid de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4 md:gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              variants={animations.fadeInUp}
              initial="initial"
              animate="animate"
              custom={index}
              className="custom-card p-4 md:p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`p-2 md:p-3 rounded-xl bg-${card.color}/10 border border-${card.color}/20`}
                >
                  <Icon className={`w-5 h-5 md:w-6 md:h-6 text-${card.color}`} />
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
                <p className="text-xs md:text-sm font-semibold opacity-60 uppercase tracking-wide mb-1">
                  {card.title}
                </p>
                <p
                  className={`text-2xl md:text-3xl font-black ${
                    card.color === 'success'
                      ? 'text-success'
                      : card.color === 'error'
                        ? 'text-error'
                        : 'text-primary'
                  }`}
                >
                  {card.value}
                </p>
                <p className="text-xs opacity-50 mt-1">{card.subtitle}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Evolução da Banca */}
        {bankEvolutionData.length > 0 && (
          <motion.div
            variants={animations.fadeInUp}
            initial="initial"
            animate="animate"
            className="custom-card p-4 md:p-6"
          >
            <div className="mb-4">
              <h3 className="text-lg md:text-xl font-black mb-1">Evolução da Banca</h3>
              <p className="text-xs md:text-sm opacity-60">
                Cash (disponível) e Equity (cash + pendentes) ao longo do tempo
              </p>
            </div>
            <ResponsiveContainer width="100%" height={windowSize.isMobile ? 250 : 350}>
              <AreaChart
                data={bankEvolutionData}
                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="bankEquityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  tick={{
                    fill: 'currentColor',
                    opacity: 0.7,
                    fontSize: windowSize.isMobile ? 10 : 12,
                  }}
                  tickLine={{ stroke: 'currentColor', opacity: 0.3 }}
                />
                <YAxis
                  tick={{
                    fill: 'currentColor',
                    opacity: 0.7,
                    fontSize: windowSize.isMobile ? 10 : 12,
                  }}
                  tickLine={{ stroke: 'currentColor', opacity: 0.3 }}
                  tickFormatter={(value) => `R$ ${value.toFixed(0)}`}
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
                        <div className="bg-base-200/95 backdrop-blur-md border border-base-300 rounded-lg p-4 shadow-xl">
                          <div className="mb-2">
                            <p className="text-xs opacity-70 mb-1">{p.date}</p>
                            <div className="flex items-baseline gap-2">
                              <p className="text-2xl font-black text-primary">R$ {p.cash.toFixed(2)}</p>
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
                                <span className="font-bold">R$ {p.equity.toFixed(2)}</span>
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
                  stroke="#a855f7"
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
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{
                    fill: '#3b82f6',
                    strokeWidth: 2,
                    stroke: '#ffffff',
                    r: windowSize.isMobile ? 4 : 5,
                    filter: 'url(#glow)',
                  }}
                  activeDot={{
                    r: windowSize.isMobile ? 7 : 8,
                    stroke: '#ffffff',
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
            className="custom-card p-4 md:p-6"
          >
            <div className="mb-4">
              <h3 className="text-lg md:text-xl font-black mb-1">Distribuição de Resultados</h3>
              <p className="text-xs md:text-sm opacity-60">Breakdown das apostas</p>
            </div>
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
                          <div className="bg-base-200/95 backdrop-blur-md border border-base-300 rounded-lg p-3 shadow-xl">
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
              <div className="space-y-4 w-full md:w-auto">
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
                      className="flex items-center gap-3 p-3 rounded-lg bg-base-200/50 hover:bg-base-200 transition-colors"
                    >
                      <div
                        className="w-5 h-5 rounded-full shadow-md flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" style={{ color }} />
                          <span className="text-sm md:text-base font-bold">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-lg font-black" style={{ color }}>
                            {item.value}
                          </span>
                          <span className="text-xs opacity-60">({percentage}%)</span>
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
          className="custom-card p-4 md:p-6"
        >
          <div className="mb-4">
            <h3 className="text-lg md:text-xl font-black mb-1">Partidas Recentes</h3>
            <p className="text-xs md:text-sm opacity-60">Suas últimas análises</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-base-300">
                  <th className="text-left py-3 px-2 md:px-4 text-xs md:text-sm font-bold opacity-70 uppercase tracking-wide">
                    Partida
                  </th>
                  <th className="text-right py-3 px-2 md:px-4 text-xs md:text-sm font-bold opacity-70 uppercase tracking-wide">
                    Odd
                  </th>
                  <th className="text-right py-3 px-2 md:px-4 text-xs md:text-sm font-bold opacity-70 uppercase tracking-wide">
                    EV
                  </th>
                  <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-bold opacity-70 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-right py-3 px-2 md:px-4 text-xs md:text-sm font-bold opacity-70 uppercase tracking-wide">
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
                      className="border-b border-base-300 hover:bg-base-200/50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-2 md:px-4">
                        <div className="text-sm font-semibold">
                          {match.data.homeTeam} vs {match.data.awayTeam}
                        </div>
                        <div className="text-xs opacity-60">
                          {formatTimestampInBrasilia(match.timestamp)}
                        </div>
                      </td>
                      <td className="py-3 px-2 md:px-4 text-right text-sm font-semibold">
                        {match.data.oddOver15?.toFixed(2) || '-'}
                      </td>
                      <td
                        className={`py-3 px-2 md:px-4 text-right text-sm font-semibold ${
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
                      <td className="py-3 px-2 md:px-4 text-center">
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
                        className={`py-3 px-2 md:px-4 text-right text-sm font-semibold ${
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
        <motion.div
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
          className="custom-card p-12 md:p-16 flex flex-col items-center justify-center text-center border-dashed border-2"
        >
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-6">
            <Activity className="w-12 h-12 md:w-16 md:h-16 text-primary opacity-60" />
          </div>
          <h3 className="text-2xl md:text-3xl font-black mb-3">Nenhuma Partida Ainda</h3>
          <p className="text-sm md:text-base opacity-70 max-w-md">
            Comece criando análises de partidas para ver estatísticas e gráficos aqui.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default DashboardScreen;
