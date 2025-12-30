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
  ArrowDownRight
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { SavedAnalysis, BankSettings } from '../types';
import { 
  calculateDashboardStats, 
  prepareBankEvolutionData, 
  prepareResultDistributionData 
} from '../utils/dashboardStats';
import { getCurrencySymbol } from '../utils/currency';
import { animations } from '../utils/animations';

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
  const stats = useMemo(() => calculateDashboardStats(savedMatches, bankSettings), [savedMatches, bankSettings]);
  const bankEvolutionData = useMemo(() => prepareBankEvolutionData(savedMatches, bankSettings), [savedMatches, bankSettings]);
  const resultDistributionData = useMemo(() => prepareResultDistributionData(savedMatches), [savedMatches]);

  // Partidas recentes (últimas 10)
  const recentMatches = useMemo(() => {
    return [...savedMatches]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }, [savedMatches]);

  const COLORS = ['hsl(var(--su))', 'hsl(var(--er))', 'hsl(var(--wa))'];

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
      subtitle: stats.totalProfit > 0 ? 'Lucro positivo' : stats.totalProfit < 0 ? 'Prejuízo' : 'Sem lucro',
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
  ];

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8">
      {/* Grid de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6">
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
                <div className={`p-2 md:p-3 rounded-xl bg-${card.color}/10 border border-${card.color}/20`}>
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
                <p className={`text-2xl md:text-3xl font-black ${
                  card.color === 'success' ? 'text-success' :
                  card.color === 'error' ? 'text-error' :
                  'text-primary'
                }`}>
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
              <p className="text-xs md:text-sm opacity-60">Crescimento do capital ao longo do tempo</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={bankEvolutionData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  tick={{ fill: 'currentColor', opacity: 0.6 }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'currentColor', opacity: 0.6 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--b2))',
                    border: '1px solid hsl(var(--b3))',
                    borderRadius: '8px',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="hsl(var(--p))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--p))', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Distribuição de Resultados */}
        {resultDistributionData.some(d => d.value > 0) && (
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
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={resultDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {resultDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {resultDistributionData.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-sm" 
                      style={{ backgroundColor: COLORS[index] }}
                    />
                    <span className="text-sm font-semibold">{item.name}</span>
                    <span className="text-sm opacity-60">({item.value})</span>
                  </div>
                ))}
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
                  const profit = hasBet && match.betInfo?.status === 'won' 
                    ? match.betInfo.potentialProfit 
                    : hasBet && match.betInfo?.status === 'lost'
                    ? -match.betInfo.betAmount
                    : 0;

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
                          {new Date(match.timestamp).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="py-3 px-2 md:px-4 text-right text-sm font-semibold">
                        {match.data.oddOver15?.toFixed(2) || '-'}
                      </td>
                      <td className={`py-3 px-2 md:px-4 text-right text-sm font-semibold ${
                        match.result.ev > 0 ? 'text-success' : match.result.ev < 0 ? 'text-error' : ''
                      }`}>
                        {match.result.ev > 0 ? '+' : ''}{match.result.ev.toFixed(1)}%
                      </td>
                      <td className="py-3 px-2 md:px-4 text-center">
                        {hasBet ? (
                          <span className={`badge badge-sm ${
                            match.betInfo?.status === 'won' ? 'badge-success' :
                            match.betInfo?.status === 'lost' ? 'badge-error' :
                            'badge-warning'
                          }`}>
                            {match.betInfo?.status === 'won' ? 'Ganhou' :
                             match.betInfo?.status === 'lost' ? 'Perdeu' :
                             'Pendente'}
                          </span>
                        ) : (
                          <span className="badge badge-sm badge-ghost">Sem aposta</span>
                        )}
                      </td>
                      <td className={`py-3 px-2 md:px-4 text-right text-sm font-semibold ${
                        profit > 0 ? 'text-success' : profit < 0 ? 'text-error' : ''
                      }`}>
                        {profit !== 0 ? (
                          <>
                            {profit > 0 ? '+' : ''}
                            {getCurrencySymbol(bankSettings?.currency || 'BRL')} {Math.abs(profit).toFixed(2)}
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

