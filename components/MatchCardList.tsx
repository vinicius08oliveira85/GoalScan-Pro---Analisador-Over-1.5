import React from 'react';
import { motion } from 'framer-motion';
import { SavedAnalysis } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  X, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Ban 
} from 'lucide-react';
import { cardHover } from '../utils/animations';
import { getPrimaryProbability } from '../utils/probability';

interface MatchCardListProps {
  match: SavedAnalysis;
  index: number;
  onMatchClick: (match: SavedAnalysis) => void;
  onDeleteMatch: (e: React.MouseEvent, id: string) => void;
  onUpdateBetStatus?: (match: SavedAnalysis, status: 'won' | 'lost') => void;
  isUpdatingBetStatus?: boolean;
}

const MatchCardList: React.FC<MatchCardListProps> = ({
  match,
  index,
  onMatchClick,
  onDeleteMatch,
  onUpdateBetStatus,
  isUpdatingBetStatus = false
}) => {
  const getStatusConfig = () => {
    if (match.betInfo && match.betInfo.betAmount > 0) {
      if (match.betInfo.status === 'won') {
        return { 
          border: 'border-l-4 border-success', 
          bg: 'bg-success/5'
        };
      } else if (match.betInfo.status === 'lost') {
        return { 
          border: 'border-l-4 border-error', 
          bg: 'bg-error/5'
        };
      } else if (match.betInfo.status === 'pending') {
        return { 
          border: 'border-l-4 border-warning', 
          bg: 'bg-warning/5'
        };
      }
    }
    return { 
      border: 'border-l-4 border-primary', 
      bg: 'bg-base-200/30'
    };
  };

  const statusConfig = getStatusConfig();
  const probability = getPrimaryProbability(match.result);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Baixo':
        return 'text-success border-success/40 bg-success/10';
      case 'Moderado':
        return 'text-warning border-warning/40 bg-warning/10';
      case 'Alto':
      case 'Muito Alto':
        return 'text-error border-error/40 bg-error/10';
      default:
        return 'text-base-content/60 border-base-300/40 bg-base-300/10';
    }
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
      className={`group custom-card ${statusConfig.bg} ${statusConfig.border} p-4 hover:shadow-xl cursor-pointer transition-all duration-300 flex flex-col md:flex-row md:items-center gap-4 md:gap-6`}
    >
      {/* Times e Data - Lado Esquerdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-sm truncate">{match.data.homeTeam}</span>
          <span className="text-primary opacity-60 shrink-0">vs</span>
          <span className="font-semibold text-sm truncate">{match.data.awayTeam}</span>
        </div>
        <div className="flex items-center gap-3 text-xs opacity-70">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {match.data.matchDate ? (
              <>
                <span>
                  {new Date(match.data.matchDate).toLocaleDateString('pt-BR', { 
                    day: '2-digit', 
                    month: 'short'
                  })}
                </span>
                {match.data.matchTime && (
                  <>
                    <span>•</span>
                    <Clock className="w-3 h-3" />
                    <span>{match.data.matchTime}</span>
                  </>
                )}
              </>
            ) : (
              <span>
                {new Date(match.timestamp).toLocaleDateString('pt-BR', { 
                  day: '2-digit', 
                  month: 'short'
                })}
              </span>
            )}
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskColor(match.result.riskLevel)}`}>
            {match.result.riskLevel}
          </span>
        </div>
      </div>

      {/* Métricas Principais - Centro */}
      <div className="flex items-center gap-4 md:gap-6">
        {/* Probabilidade */}
        <div className="flex flex-col items-center min-w-[60px]">
          <div className="text-[10px] font-semibold opacity-70 uppercase mb-1">Prob.</div>
          <div className="text-lg font-black">{probability.toFixed(0)}%</div>
          <div className="w-16 h-1.5 bg-base-300/50 rounded-full overflow-hidden mt-1">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${probability}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full rounded-full ${
                probability >= 70 
                  ? 'bg-success' 
                  : probability >= 50
                  ? 'bg-warning'
                  : 'bg-error'
              }`}
            />
          </div>
        </div>

        {/* EV */}
        <div className="flex flex-col items-center min-w-[60px]">
          <div className="text-[10px] font-semibold opacity-70 uppercase mb-1">EV</div>
          <div className={`text-lg font-black flex items-center gap-1 ${
            match.result.ev > 0 ? 'text-success' :
            match.result.ev < 0 ? 'text-error' :
            'opacity-50'
          }`}>
            {match.result.ev > 0 && <TrendingUp className="w-4 h-4" />}
            {match.result.ev < 0 && <TrendingDown className="w-4 h-4" />}
            <span>{match.result.ev > 0 ? '+' : ''}{match.result.ev.toFixed(1)}%</span>
          </div>
        </div>

        {/* Odd */}
        <div className="flex flex-col items-center min-w-[50px]">
          <div className="text-[10px] font-semibold opacity-70 uppercase mb-1">Odd</div>
          <div className="text-lg font-black text-primary">{match.data.oddOver15?.toFixed(2) || '-'}</div>
        </div>

        {/* Stake */}
        {match.betInfo && match.betInfo.betAmount > 0 && (
          <div className="flex flex-col items-center min-w-[60px]">
            <div className="text-[10px] font-semibold opacity-70 uppercase mb-1">Stake</div>
            <div className="text-lg font-black">{match.betInfo.betAmount.toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Status e Ações - Lado Direito */}
      <div className="flex items-center gap-3">
        {match.betInfo && match.betInfo.betAmount > 0 && (
          <div className={`badge gap-1 px-3 py-1.5 text-xs font-bold flex-shrink-0 ${
            match.betInfo.status === 'won' 
              ? 'bg-success/20 text-success border-success/50' 
              : match.betInfo.status === 'lost'
              ? 'bg-error/20 text-error border-error/50'
              : match.betInfo.status === 'pending'
              ? 'bg-warning/20 text-warning border-warning/50 animate-pulse'
              : 'bg-base-300/20 text-base-content/60 border-base-300/30'
          }`}>
            {match.betInfo.status === 'won' && <CheckCircle className="w-3 h-3" />}
            {match.betInfo.status === 'lost' && <XCircle className="w-3 h-3" />}
            {match.betInfo.status === 'pending' && <Clock className="w-3 h-3" />}
            {match.betInfo.status === 'cancelled' && <Ban className="w-3 h-3" />}
            <span>
              {match.betInfo.status === 'won' ? 'Ganhou' :
               match.betInfo.status === 'lost' ? 'Perdeu' :
               match.betInfo.status === 'pending' ? 'Pendente' :
               'Cancelada'}
            </span>
          </div>
        )}

        {match.betInfo?.status === 'pending' && onUpdateBetStatus && (
          <div className="flex gap-1">
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onUpdateBetStatus(match, 'won');
              }}
              disabled={isUpdatingBetStatus}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn btn-xs btn-circle bg-success/20 text-success border-success/50 hover:bg-success/30 disabled:opacity-50"
              title="Marcar como ganha"
            >
              <CheckCircle className="w-3 h-3" />
            </motion.button>
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onUpdateBetStatus(match, 'lost');
              }}
              disabled={isUpdatingBetStatus}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn btn-xs btn-circle bg-error/20 text-error border-error/50 hover:bg-error/30 disabled:opacity-50"
              title="Marcar como perdida"
            >
              <XCircle className="w-3 h-3" />
            </motion.button>
          </div>
        )}

        <button
          onClick={(e) => onDeleteMatch(e, match.id)}
          className="opacity-0 group-hover:opacity-100 btn btn-xs btn-circle btn-ghost text-error hover:bg-error/20 transition-all flex-shrink-0 focus:opacity-100"
          aria-label={`Remover partida ${match.data.homeTeam} vs ${match.data.awayTeam}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

export default MatchCardList;

