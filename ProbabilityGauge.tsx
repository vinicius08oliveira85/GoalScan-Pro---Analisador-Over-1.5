import React from 'react';
import { motion } from 'framer-motion';

interface ProbabilityGaugeProps {
  probability: number;
  selectedProbability?: number;
  selectedLabel?: string;
  odd?: number;
  ev?: number;
  onOddChange?: (odd: number) => void;
  size?: number;
  strokeWidth?: number;
}

const ProbabilityGauge: React.FC<ProbabilityGaugeProps> = ({
  probability,
  selectedProbability,
  selectedLabel,
  odd,
  ev,
  onOddChange,
  size = 140,
  strokeWidth = 12
}) => {
  const displayProb = selectedProbability ?? probability;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (displayProb / 100) * circumference;

  const getColor = (p: number) => {
    if (p >= 70) return 'text-success';
    if (p >= 50) return 'text-warning';
    return 'text-error';
  };

  const colorClass = getColor(displayProb);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Círculo de Fundo */}
        <svg className="transform -rotate-90 w-full h-full">
          <circle
            className="text-base-300"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          {/* Círculo de Progresso Animado */}
          <motion.circle
            className={colorClass}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut" }}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>
        {/* Valor Central */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${size < 100 ? 'text-xl' : 'text-3xl'}`}>
            {Math.round(displayProb)}%
          </span>
          {selectedLabel && (
            <span className="text-xs text-base-content/60 max-w-[80%] text-center truncate">
              {selectedLabel}
            </span>
          )}
        </div>
      </div>
      
      {/* EV Display se disponível */}
      {ev !== undefined && (
        <div className={`mt-2 text-sm font-bold ${ev > 0 ? 'text-success' : 'text-error'}`}>
          EV: {ev.toFixed(1)}%
        </div>
      )}
    </div>
  );
};

export default ProbabilityGauge;