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
import { animations } from '../../utils/animations';
import { useWindowSize } from '../../hooks/useWindowSize';
import {
  chartAxisTickLine,
  chartColors,
  chartGridProps,
  chartTooltipClassName,
  getChartAxisTick,
} from '../../utils/chartTheme';
import SectionHeader from '../ui/SectionHeader';

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
      className="card bg-base-100 shadow-sm border border-base-300/50 p-4 md:p-6"
    >
      <SectionHeader
        className="mb-4"
        title="Evolução da Banca"
        subtitle="Cash (disponível) e Equity (cash + pendentes) ao longo do tempo"
      />

      <div className="min-w-0 w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <div
          className={`min-w-[280px] w-full ${windowSize.isMobile ? 'h-[250px]' : 'h-[350px]'}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="bankEquityGradientBank" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.equity} stopOpacity={0.1} />
                  <stop offset="95%" stopColor={chartColors.equity} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="date" tick={getChartAxisTick(windowSize.isMobile)} tickLine={chartAxisTickLine} />
              <YAxis
                tick={getChartAxisTick(windowSize.isMobile)}
                tickLine={chartAxisTickLine}
                tickFormatter={(value) => `R$ ${Number(value).toFixed(0)}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const p = payload[0].payload as BankEvolutionPoint;
                    return (
                      <div className={chartTooltipClassName}>
                        <p className="mb-2 text-xs text-base-content/70">{p.date}</p>
                        <p className="mb-1 text-xl font-bold text-primary">R$ {p.cash.toFixed(2)}</p>
                        <div className="text-xs text-base-content/80">
                          <span className="font-semibold">Equity:</span> R$ {p.equity.toFixed(2)}
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
                fill="url(#bankEquityGradientBank)"
                fillOpacity={1}
                animationDuration={1000}
              />
              <Line
                type="monotone"
                dataKey="cash"
                stroke={chartColors.cash}
                strokeWidth={3}
                dot={{ r: windowSize.isMobile ? 3 : 4, strokeWidth: 2 }}
                activeDot={{ r: windowSize.isMobile ? 6 : 7, strokeWidth: 2 }}
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
};

export default BankEvolutionChart;
