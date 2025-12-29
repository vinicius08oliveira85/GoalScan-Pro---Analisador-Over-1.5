import React from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Target, TrendingUp, TrendingDown } from 'lucide-react';
import { animations } from '../utils/animations';

interface ProbabilityGaugeProps {
  probability: number;
  odd?: number;
  ev: number;
}

const ProbabilityGauge: React.FC<ProbabilityGaugeProps> = ({ probability, odd, ev }) => {
  const chartData = [
    { name: 'Over 1.5', value: probability },
    { name: 'Under 1.5', value: 100 - probability },
  ];

  const COLORS = ['#2dd4bf', '#f87171'];

  return (
    <div 
      className="group relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-teal-500/10 via-base-200/50 to-base-200/50 backdrop-blur-xl border border-teal-500/20 hover:border-teal-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-teal-500/20 cursor-help"
      title="Probabilidade de Over 1.5 gols na partida. Calculada com base em estatísticas históricas e análise da IA (quando disponível)."
    >
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-base-200/40 backdrop-blur-md" />
      
      {/* Animated gradient orb */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br from-teal-500/20 to-cyan-500/20 opacity-0 group-hover:opacity-100 blur-3xl transition-opacity duration-700" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center">
        {/* Header */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5">
          <Target className="w-3 h-3 opacity-30" />
          <span className="text-[10px] font-bold opacity-30 uppercase">V3.8</span>
        </div>
        
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-teal-400" />
          <h3 className="text-sm font-black uppercase tracking-widest">PROBABILIDADE OVER 1.5</h3>
        </div>

        {/* Gauge com Probability Ring */}
        <div className="w-full h-48 relative mb-4">
          {/* SVG Probability Ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
              {/* Background ring */}
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-base-300"
                opacity="0.3"
              />
              {/* Progress ring com gradiente */}
              <motion.circle
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke="url(#probabilityGradient)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 80}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 80 }}
                animate={{ 
                  strokeDashoffset: 2 * Math.PI * 80 * (1 - probability / 100)
                }}
                transition={{ 
                  type: "spring", 
                  stiffness: 50, 
                  damping: 15,
                  duration: 1.5
                }}
              />
              <defs>
                <linearGradient id="probabilityGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--p))" />
                  <stop offset="50%" stopColor="hsl(var(--s))" />
                  <stop offset="100%" stopColor="#2dd4bf" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          
          {/* Pie Chart (mantido para compatibilidade visual) */}
          <div className="absolute inset-0 opacity-30">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={chartData} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={65} 
                  outerRadius={85} 
                  paddingAngle={5} 
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Valor central animado */}
          <motion.div 
            className="absolute inset-0 flex flex-col items-center justify-center"
            variants={animations.scaleIn}
            initial="initial"
            animate="animate"
          >
            <div className="flex items-baseline gap-1">
              <motion.span 
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-teal-400 leading-none tracking-tight"
                key={probability}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
              >
                {probability.toFixed(1)}
              </motion.span>
              <span className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-teal-400 opacity-80">
                %
              </span>
            </div>
            <span className="text-[10px] font-bold opacity-40 mt-1 uppercase">CONFIANÇA</span>
          </motion.div>
        </div>

        {/* Odd and EV */}
        <div className="flex justify-between w-full mt-4 px-2 pt-4 border-t border-white/10 gap-4">
          <div 
            className="text-center flex-1 bg-base-100/30 p-3 rounded-xl border border-white/5 cursor-help"
            title="Odd atual do mercado Over 1.5 gols. Usada para calcular o Expected Value (EV) e Edge da aposta."
          >
            <p className="text-[9px] font-bold opacity-40 uppercase mb-1">Odd Atual</p>
            <p className="text-lg md:text-xl font-black">{odd?.toFixed(2) || '-'}</p>
          </div>
          <div 
            className="text-center flex-1 bg-base-100/30 p-3 rounded-xl border border-white/5 cursor-help"
            title="Expected Value (EV): valor esperado da aposta em percentual. Valores positivos indicam apostas com valor esperado positivo a longo prazo. EV = (Probabilidade × Odd - 1) × 100"
          >
            <p className="text-[9px] font-bold opacity-40 uppercase mb-1">EV %</p>
            <div className="flex items-center justify-center gap-1">
              {ev > 0 ? (
                <TrendingUp className="w-4 h-4 text-success" />
              ) : ev < 0 ? (
                <TrendingDown className="w-4 h-4 text-error" />
              ) : null}
              <p className={`text-lg md:text-xl font-black ${ev > 0 ? 'text-success' : ev < 0 ? 'text-error' : ''}`}>
                {ev > 0 ? '+' : ''}{ev.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Shine effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-all duration-1000" />
    </div>
  );
};

export default ProbabilityGauge;

