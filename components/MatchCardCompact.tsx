import React from 'react';
import { motion } from 'framer-motion';
import { SavedAnalysis } from '../types';
import { TrendingUp, TrendingDown, Calendar, X, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cardHover } from '../utils/animations';
import { getDisplayProbability, getSelectedProbabilityLabel } from '../utils/probability';
import { getRiskLevelFromProbability } from '../utils/risk';
import { formatMatchDate, formatTimestampInBrasilia } from '../utils/dateFormatter';

interface MatchCardCompactProps {
  match: SavedAnalysis;
  index: number;
  onMatchClick: (match: SavedAnalysis) => void;
  onDeleteMatch: (e: React.MouseEvent, id: string) => void;
}

const MatchCardCompact: React.FC<MatchCardCompactProps> = ({
  match,
  index,
  onMatchClick,
  onDeleteMatch,
}) => {
  const getStatusColor = () => {
    if (match.betInfo && match.betInfo.betAmount > 0) {
      if (match.betInfo.status === 'won') return 'border-l-2 border-success bg-success/5';
      if (match.betInfo.status === 'lost') return 'border-l-2 border-error bg-error/5';
      if (match.betInfo.status === 'pending') return 'border-l-2 border-warning bg-warning/5';
    }
    return 'border-l-2 border-primary bg-base-200/30';
  };

  const probability = getDisplayProbability(match);
  const selectedLabel = getSelectedProbabilityLabel(match.selectedBets);
  const riskLevel = getRiskLevelFromProbability(probability);
  
  // Calcular EV com a probabilidade correta (selecionada/combinada ou padrão)
  const displayEv = match.data.oddOver15 && match.data.oddOver15 > 1
    ? ((probability / 100) * match.data.oddOver15 - 1) * 100
    : match.result.ev;

  const getRiskBadge = (risk: string) => {
    const colors = {
      Baixo: 'bg-success/20 text-success border-success/40',
      Moderado: 'bg-warning/20 text-warning border-warning/40',
      Alto: 'bg-error/20 text-error border-error/40',
      'Muito Alto': 'bg-error/20 text-error border-error/40',
    };
    return (
      colors[risk as keyof typeof colors] ||
      'bg-base-300/20 text-base-content/60 border-base-300/40'
    );
  };

  return (
    <motion.div
      key={match.id}
      onClick={() => onMatchClick(match)}
      custom={index}
      initial="initial"
      animate="animate"
      whileHover="hover"
      whileTap="tap"
      variants={cardHover}
      className={`group custom-card ${getStatusColor()} p-2.5 hover:shadow-lg cursor-pointer transition-all duration-300`}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Times - Compacto */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="truncate">{match.data.homeTeam}</span>
            <span className="text-primary opacity-60 shrink-0">vs</span>
            <span className="truncate">{match.data.awayTeam}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1 text-[10px] opacity-60">
              <Calendar className="w-2.5 h-2.5" />
              {match.data.matchDate ? (
                <span>
                  {formatMatchDate(match.data.matchDate, match.data.matchTime, {
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </span>
              ) : (
                <span>
                  {formatTimestampInBrasilia(match.timestamp, {
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </span>
              )}
            </div>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getRiskBadge(riskLevel)}`}
            >
              {riskLevel}
            </span>
          </div>
        </div>

        {/* Métricas Compactas */}
        <div className="flex items-center gap-3">
          {/* Probabilidade */}
          <div className="flex flex-col items-center min-w-[45px]">
            <div className="text-[9px] font-semibold opacity-70 uppercase">Prob</div>
            <div className="text-sm font-black">{probability.toFixed(0)}%</div>
            {selectedLabel && (
              <div className="text-[8px] font-semibold opacity-60 mt-0.5 text-center leading-tight">
                {selectedLabel}
              </div>
            )}
            <div className="w-12 h-1 bg-base-300/50 rounded-full overflow-hidden mt-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${probability}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  probability >= 70 ? 'bg-success' : probability >= 50 ? 'bg-warning' : 'bg-error'
                }`}
              />
            </div>
          </div>

          {/* EV */}
          <div className="flex flex-col items-center min-w-[40px]">
            <div className="text-[9px] font-semibold opacity-70 uppercase">EV</div>
            <div
              className={`text-sm font-black flex items-center gap-0.5 ${
                displayEv > 0
                  ? 'text-success'
                  : displayEv < 0
                    ? 'text-error'
                    : 'opacity-50'
              }`}
            >
              {displayEv > 0 && <TrendingUp className="w-3 h-3" />}
              {displayEv < 0 && <TrendingDown className="w-3 h-3" />}
              <span className="text-xs">
                {displayEv > 0 ? '+' : ''}
                {displayEv.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Odd */}
          <div className="flex flex-col items-center min-w-[35px]">
            <div className="text-[9px] font-semibold opacity-70 uppercase">Odd</div>
            <div className="text-sm font-black text-primary">
              {match.data.oddOver15?.toFixed(2) || '-'}
            </div>
          </div>

          {/* Status Badge */}
          {match.betInfo && match.betInfo.betAmount > 0 && (
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                match.betInfo.status === 'won'
                  ? 'bg-success/20 text-success'
                  : match.betInfo.status === 'lost'
                    ? 'bg-error/20 text-error'
                    : match.betInfo.status === 'pending'
                      ? 'bg-warning/20 text-warning'
                      : 'bg-base-300/20 text-base-content/60'
              }`}
            >
              {match.betInfo.status === 'won' && <CheckCircle className="w-2.5 h-2.5" />}
              {match.betInfo.status === 'lost' && <XCircle className="w-2.5 h-2.5" />}
              {match.betInfo.status === 'pending' && <Clock className="w-2.5 h-2.5" />}
              <span>
                {match.betInfo.status === 'won'
                  ? '✓'
                  : match.betInfo.status === 'lost'
                    ? '✗'
                    : match.betInfo.status === 'pending'
                      ? '⏱'
                      : ''}
              </span>
            </div>
          )}

          {/* Botão Delete */}
          <button
            onClick={(e) => onDeleteMatch(e, match.id)}
            className="opacity-0 group-hover:opacity-100 btn btn-xs btn-circle btn-ghost text-error hover:bg-error/20 transition-all flex-shrink-0 focus:opacity-100"
            aria-label={`Remover partida ${match.data.homeTeam} vs ${match.data.awayTeam}`}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default MatchCardCompact;
