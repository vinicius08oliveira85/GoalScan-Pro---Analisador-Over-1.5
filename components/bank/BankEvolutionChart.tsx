import React from 'react';
import { motion } from 'framer-motion';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { animations } from '../../utils/animations';
import { useWindowSize } from '../../hooks/useWindowSize';

type BankEvolutionPoint = {
  date: string;
  timestamp: number;
  cash: number;
  equity: number;
};

interface BankEvolutionChartProps {
  data: BankEvolutionPoint[];
}

const BankEvolutionChart: React.FC<BankEvolutionChartProps> = ({ data }) => {
  const windowSize = useWindowSize();
  if (!data || data.length === 0) return null;

  return (
    <motion.div
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
      custom={11}
      className="custom-card p-4 md:p-6"
    >
      <div className="mb-4">
        <h3 className="text-lg md:text-xl font-black mb-1">Evolução da Banca</h3>
        <p className="text-xs md:text-sm opacity-60">
          Cash (disponível) e Equity (cash + pendentes) ao longo do tempo
        </p>
      </div>

      <ResponsiveContainer width="100%" height={windowSize.isMobile ? 250 : 350}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="bankEquityGradientBank" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
            </linearGradient>
            <filter id="glowBank">
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
            tickFormatter={(value) => `R$ ${Number(value).toFixed(0)}`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const p = payload[0].payload as BankEvolutionPoint;
                const currentIndex = data.findIndex((d) => d.timestamp === p.timestamp);
                const previous = currentIndex > 0 ? data[currentIndex - 1] : null;

                const cashChange = previous ? p.cash - previous.cash : null;
                const cashChangePct =
                  previous && previous.cash > 0
                    ? Number((((cashChange || 0) / previous.cash) * 100).toFixed(1))
                    : null;

                const equityChange = previous ? p.equity - previous.equity : null;

                return (
                  <div className="bg-base-200/95 backdrop-blur-md border border-base-300 rounded-lg p-4 shadow-xl">
                    <div className="mb-2">
                      <p className="text-xs opacity-70 mb-1">{p.date}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-black text-primary">R$ {p.cash.toFixed(2)}</p>
                        {cashChange !== null && (
                          <span
                            className={`text-sm font-bold flex items-center gap-1 ${
                              cashChange > 0 ? 'text-success' : cashChange < 0 ? 'text-error' : ''
                            }`}
                          >
                            {cashChange > 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : cashChange < 0 ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : null}
                            {cashChange > 0 ? '+' : ''}
                            {cashChange.toFixed(2)}
                            {cashChangePct !== null && ` (${cashChangePct > 0 ? '+' : ''}${cashChangePct}%)`}
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
                                equityChange > 0 ? 'text-success' : equityChange < 0 ? 'text-error' : ''
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
            fill="url(#bankEquityGradientBank)"
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
              filter: 'url(#glowBank)',
            }}
            activeDot={{
              r: windowSize.isMobile ? 7 : 8,
              stroke: '#ffffff',
              strokeWidth: 2,
              filter: 'url(#glowBank)',
            }}
            animationBegin={0}
            animationDuration={1000}
            animationEasing="ease-in-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

export default BankEvolutionChart;


