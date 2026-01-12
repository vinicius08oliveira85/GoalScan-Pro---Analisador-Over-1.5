import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Target, TrendingUp, TrendingDown } from 'lucide-react';
import { animations } from '../utils/animations';

interface ProbabilityGaugeProps {
  probability: number; // Probabilidade padrão (Over 1.5)
  selectedProbability?: number; // Probabilidade selecionada/combinada (quando houver seleção)
  selectedLabel?: string; // Label descritivo da aposta selecionada/combinada
  odd?: number;
  ev: number;
  onOddChange?: (odd: number) => void;
}

const ProbabilityGauge: React.FC<ProbabilityGaugeProps> = ({ 
  probability, 
  selectedProbability,
  selectedLabel,
  odd, 
  ev, 
  onOddChange 
}) => {
  // Usar probabilidade selecionada se disponível, caso contrário usar padrão
  const displayProbability = selectedProbability ?? probability;
  const displayLabel = selectedLabel ?? 'Over 1.5';
  const [isEditingOdd, setIsEditingOdd] = useState(false);
  const [localOdd, setLocalOdd] = useState<string>(odd?.toFixed(2) || '');
  const [calculatedEv, setCalculatedEv] = useState(ev);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atualizar localOdd quando odd prop mudar externamente
  useEffect(() => {
    if (!isEditingOdd) {
      setLocalOdd(odd?.toFixed(2) || '');
      setCalculatedEv(ev);
    }
  }, [odd, ev, isEditingOdd]);

  // Calcular EV automaticamente quando localOdd mudar
  useEffect(() => {
    if (isEditingOdd) {
      const oddValue = parseFloat(localOdd);
      if (!isNaN(oddValue) && oddValue > 1.0) {
        const newEv = ((displayProbability / 100) * oddValue - 1) * 100;
        setCalculatedEv(newEv);
      } else {
        setCalculatedEv(0);
      }
    }
  }, [localOdd, displayProbability, isEditingOdd]);

  // Focar no input quando entrar em modo de edição
  useEffect(() => {
    if (isEditingOdd && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingOdd]);

  const handleOddClick = () => {
    setIsEditingOdd(true);
    setLocalOdd(odd?.toFixed(2) || '');
  };

  const handleOddSave = () => {
    const oddValue = parseFloat(localOdd);
    if (!isNaN(oddValue) && oddValue > 1.0) {
      if (onOddChange) {
        onOddChange(oddValue);
      }
      setIsEditingOdd(false);
    } else {
      // Se valor inválido, restaurar valor anterior
      setLocalOdd(odd?.toFixed(2) || '');
      setIsEditingOdd(false);
    }
  };

  const handleOddCancel = () => {
    setLocalOdd(odd?.toFixed(2) || '');
    setCalculatedEv(ev);
    setIsEditingOdd(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleOddSave();
    } else if (e.key === 'Escape') {
      handleOddCancel();
    }
  };
  const chartData = [
    { name: displayLabel, value: displayProbability },
    { name: `Não ${displayLabel}`, value: 100 - displayProbability },
  ];

  const COLORS = ['#2dd4bf', '#f87171'];

  return (
    <div
      className="surface surface-hover p-6 cursor-help"
      title={`Probabilidade de ${displayLabel}. ${
        selectedProbability != null
          ? 'Baseada na seleção de apostas (linha/combinação escolhida).'
          : 'Calculada via Poisson com Estatísticas (últimos 10 jogos) + Tabela (temporada), quando disponíveis.'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-teal-400" />
          <h3 className="kpi-label">Probabilidade {displayLabel}</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-base-content/50">
          <Target className="w-3 h-3" />
          <span>Poisson v3.8</span>
        </div>
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
                strokeDashoffset: 2 * Math.PI * 80 * (1 - displayProbability / 100),
              }}
              key={displayProbability}
              transition={{
                type: 'spring',
                stiffness: 50,
                damping: 15,
                duration: 1.5,
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
              className="text-3xl sm:text-4xl md:text-5xl font-black font-mono text-teal-400 leading-none tracking-tight"
              key={displayProbability}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
            >
              {displayProbability.toFixed(1)}
            </motion.span>
            <span className="text-base font-bold text-teal-400 opacity-80">%</span>
          </div>
          <span className="text-[10px] font-bold text-base-content/50 mt-2 uppercase tracking-widest">
            Probabilidade
          </span>
        </motion.div>
      </div>

      {/* Odd and EV */}
      <div className="flex justify-between w-full mt-4 px-2 pt-4 border-t border-white/10 gap-4">
        <div
          className={`text-center flex-1 surface-muted p-3 ${isEditingOdd ? '' : 'cursor-pointer hover:bg-base-300/50 transition-colors'}`}
          title={isEditingOdd ? 'Pressione Enter para salvar ou Escape para cancelar' : 'Clique para editar a odd. Usada para calcular EV e Edge.'}
          onClick={!isEditingOdd ? handleOddClick : undefined}
        >
          <p className="kpi-label mb-2">Odd</p>
          {isEditingOdd ? (
            <input
              ref={inputRef}
              type="number"
              step="0.01"
              min="1.01"
              value={localOdd}
              onChange={(e) => setLocalOdd(e.target.value)}
              onBlur={handleOddSave}
              onKeyDown={handleKeyDown}
              className="text-xl font-black font-mono text-base-content bg-base-200 border-2 border-primary rounded px-2 py-1 w-full text-center focus:outline-none focus:ring-2 focus:ring-primary"
            />
          ) : (
            <p className="text-xl font-black font-mono text-base-content">{odd?.toFixed(2) || '—'}</p>
          )}
        </div>
        <div
          className="text-center flex-1 surface-muted p-3 cursor-help"
          title="EV (Expected Value): valor esperado em %. EV = (Prob × Odd - 1) × 100."
        >
          <p className="kpi-label mb-2">EV</p>
          <div className="flex items-center justify-center gap-1">
            {calculatedEv > 0 ? (
              <TrendingUp className="w-4 h-4 text-success" />
            ) : calculatedEv < 0 ? (
              <TrendingDown className="w-4 h-4 text-error" />
            ) : null}
            <p
              className={`text-xl font-black font-mono ${calculatedEv > 0 ? 'text-success' : calculatedEv < 0 ? 'text-error' : 'text-base-content'}`}
            >
              {calculatedEv > 0 ? '+' : ''}
              {calculatedEv.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProbabilityGauge;
