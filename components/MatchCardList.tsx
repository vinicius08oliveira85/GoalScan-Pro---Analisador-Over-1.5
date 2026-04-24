import React from 'react';
import { motion } from 'framer-motion';
import { SavedAnalysis } from '../types';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  Trophy,
  Trash2,
} from 'lucide-react';
import { cardHover } from '../utils/animations';
import { cn } from '../utils/cn';
import { getDisplayProbability, getSelectedProbabilityLabel } from '../utils/probability';
import { getRiskLevelFromProbability } from '../utils/risk';
import {
  formatMatchDate,
  formatMatchTime,
  formatTimestampInBrasilia,
} from '../utils/dateFormatter';
import { useChampionshipName } from '../hooks/useChampionshipName';
import { calculateEVPercent } from '../utils/evDecimal';
import { getBetDisplayFinancials } from '../utils/betFinancials';
import { getCurrencySymbol } from '../utils/currency';

interface MatchCardListProps {
  match: SavedAnalysis;
  index: number;
  onMatchClick: (match: SavedAnalysis) => void;
  onDeleteMatch: (e: React.MouseEvent, id: string) => void;
  onUpdateBetStatus?: (match: SavedAnalysis, status: 'won' | 'lost') => void;
  onAnalyzeResult?: (match: SavedAnalysis) => void;
  isUpdatingBetStatus?: boolean;
  bankCurrency?: string;
}

const MatchCardList: React.FC<MatchCardListProps> = ({
  match,
  index,
  onMatchClick,
  onDeleteMatch,
  onUpdateBetStatus,
  onAnalyzeResult,
  isUpdatingBetStatus = false,
  bankCurrency,
}) => {
  void onAnalyzeResult;
  const currencySymbol = getCurrencySymbol(bankCurrency ?? 'BRL');
  const betMoney =
    match.betInfo && match.betInfo.betAmount > 0 ? getBetDisplayFinancials(match) : null;
  const statusStripClass = (() => {
    if (match.betInfo && match.betInfo.betAmount > 0) {
      if (match.betInfo.status === 'won') {
        return 'bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.5)]';
      }
      if (match.betInfo.status === 'lost') {
        return 'bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.45)]';
      }
      if (match.betInfo.status === 'pending') {
        return 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]';
      }
    }
    return 'bg-primary/50 shadow-[0_0_10px_rgba(99,102,241,0.25)]';
  })();
  const probability = getDisplayProbability(match);
  const selectedLabel = getSelectedProbabilityLabel(match.selectedBets);
  const riskLevel = getRiskLevelFromProbability(probability);
  const championshipName = useChampionshipName(match.data.championshipId);
  
  // Calcular EV com a probabilidade correta (selecionada/combinada ou padrão)
  const displayEv =
    match.data.oddOver15 && match.data.oddOver15 > 1
      ? calculateEVPercent(probability, match.data.oddOver15)
      : match.result.ev;

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
      layout
      key={match.id}
      onClick={() => onMatchClick(match)}
      custom={index}
      initial="initial"
      animate="animate"
      whileHover="hover"
      whileTap="tap"
      variants={cardHover}
      className={cn(
        'group relative min-w-0 cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-base-100/40 shadow-lg shadow-black/5 ring-1 ring-white/5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/15 dark:border-white/10 dark:bg-base-100/25',
        'flex flex-col gap-4 p-4 pl-3.5 md:flex-row md:items-center md:gap-6 md:pl-4'
      )}
    >
      <span
        className={cn('absolute bottom-2 left-0 top-2 w-1 rounded-full', statusStripClass)}
        aria-hidden
      />
      {/* Times e Data - Lado Esquerdo */}
      <div className="min-w-0 flex-1 pl-2">
        <div className="mb-2 flex items-center gap-2">
          <span className="truncate text-sm font-black tracking-tight">{match.data.homeTeam}</span>
          <span className="shrink-0 font-black text-primary/70">vs</span>
          <span className="truncate text-sm font-black tracking-tight">{match.data.awayTeam}</span>
        </div>
        {championshipName && (
          <div className="flex items-center gap-1 mb-1 text-xs opacity-70">
            <Trophy className="w-3 h-3 text-warning" />
            <span className="truncate">{championshipName}</span>
          </div>
        )}
        <div className="flex items-center gap-3 text-xs opacity-70">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {match.data.matchDate ? (
              <>
                <span>{formatMatchDate(match.data.matchDate, match.data.matchTime)}</span>
                {match.data.matchTime && (
                  <>
                    <span>•</span>
                    <Clock className="w-3 h-3" />
                    <span>{formatMatchTime(match.data.matchDate, match.data.matchTime)}</span>
                  </>
                )}
              </>
            ) : (
              <span>
                {formatTimestampInBrasilia(match.timestamp, {
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
            )}
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskColor(riskLevel)}`}
          >
            {riskLevel}
          </span>
        </div>
      </div>

      {/* Métricas Principais - Centro */}
      <div className="flex max-w-full min-w-0 flex-wrap items-center justify-center gap-4 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] md:flex-nowrap md:justify-start md:gap-6">
        {/* Probabilidade */}
        <div className="flex flex-col items-center min-w-[60px]">
          <div className="text-[10px] font-semibold opacity-70 uppercase mb-1">Prob.</div>
          <div className="font-mono text-lg font-black tabular-nums">{probability.toFixed(0)}%</div>
          {selectedLabel && (
            <div className="text-[9px] font-semibold opacity-60 mt-0.5 text-center">
              {selectedLabel}
            </div>
          )}
          <div className="w-16 h-1.5 bg-base-300/50 rounded-full overflow-hidden mt-1">
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
        <div className="flex flex-col items-center min-w-[60px]">
          <div className="text-[10px] font-semibold opacity-70 uppercase mb-1">EV</div>
          <div
            className={cn(
              'flex items-center gap-1 font-mono text-lg font-black tabular-nums',
              displayEv > 0 ? 'text-success' : displayEv < 0 ? 'text-error' : 'opacity-50'
            )}
          >
            {displayEv > 0 && <TrendingUp className="h-4 w-4 shrink-0" />}
            {displayEv < 0 && <TrendingDown className="h-4 w-4 shrink-0" />}
            <span>
              {displayEv > 0 ? '+' : ''}
              {displayEv.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Odd */}
        <div className="flex flex-col items-center min-w-[50px]">
          <div className="text-[10px] font-semibold opacity-70 uppercase mb-1">Odd</div>
          <div className="font-mono text-lg font-black tabular-nums text-primary">
            {match.data.oddOver15?.toFixed(2) || '-'}
          </div>
        </div>

        {/* Stake */}
        {match.betInfo && match.betInfo.betAmount > 0 && (
          <div className="flex flex-col items-center min-w-[60px]">
            <div className="text-[10px] font-semibold opacity-70 uppercase mb-1">Stake</div>
            <div className="font-mono text-lg font-black tabular-nums">{match.betInfo.betAmount.toFixed(2)}</div>
          </div>
        )}

        {match.betInfo && match.betInfo.betAmount > 0 && betMoney && match.betInfo.status === 'pending' && (
          <div className="flex flex-col items-center min-w-[58px]">
            <div className="text-[10px] font-semibold opacity-70 uppercase mb-1">Retorno</div>
            <div className="font-mono text-lg font-black tabular-nums text-primary">
              {currencySymbol} {betMoney.potentialReturn.toFixed(2)}
            </div>
          </div>
        )}

        {match.betInfo && match.betInfo.betAmount > 0 && betMoney && match.betInfo.status === 'won' && (
          <div className="flex flex-col items-center min-w-[52px]">
            <div className="text-[10px] font-semibold opacity-70 uppercase mb-1">Lucro</div>
            <div className="font-mono text-lg font-black tabular-nums text-success">
              +{currencySymbol} {betMoney.potentialProfit.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Status e Ações - Lado Direito */}
      <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
        {match.betInfo && match.betInfo.betAmount > 0 && (
          <div
            className={`badge gap-1 px-3 py-1.5 text-xs font-bold flex-shrink-0 ${
              match.betInfo.status === 'won'
                ? 'bg-success/20 text-success border-success/50'
                : match.betInfo.status === 'lost'
                  ? 'bg-error/20 text-error border-error/50'
                  : match.betInfo.status === 'pending'
                    ? 'bg-warning/20 text-warning border-warning/50 animate-pulse'
                    : 'bg-base-300/20 text-base-content/60 border-base-300/30'
            }`}
          >
            {match.betInfo.status === 'won' && <CheckCircle className="w-3 h-3" />}
            {match.betInfo.status === 'lost' && <XCircle className="w-3 h-3" />}
            {match.betInfo.status === 'pending' && <Clock className="w-3 h-3" />}
            {match.betInfo.status === 'cancelled' && <Ban className="w-3 h-3" />}
            <span>
              {match.betInfo.status === 'won'
                ? 'Ganhou'
                : match.betInfo.status === 'lost'
                  ? 'Perdeu'
                  : match.betInfo.status === 'pending'
                    ? 'Pendente'
                    : 'Cancelada'}
            </span>
          </div>
        )}

        {match.betInfo?.status === 'pending' && onUpdateBetStatus && (
          <div className="flex items-center gap-1.5">
            {isUpdatingBetStatus && (
              <span
                className="loading loading-spinner loading-xs shrink-0 text-primary"
                aria-label="Atualizando aposta"
              />
            )}
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateBetStatus(match, 'won');
              }}
              disabled={isUpdatingBetStatus}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="btn btn-xs rounded-xl border-0 bg-emerald-600/90 px-3 font-semibold text-emerald-50 shadow-md shadow-emerald-600/25 hover:bg-emerald-600 disabled:opacity-50"
              title="Marcar como ganha"
            >
              <CheckCircle className="mr-1 h-3.5 w-3.5" />
              Ganhou
            </motion.button>
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateBetStatus(match, 'lost');
              }}
              disabled={isUpdatingBetStatus}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="btn btn-xs rounded-xl border-0 bg-rose-600/88 px-3 font-semibold text-rose-50 shadow-md shadow-rose-600/25 hover:bg-rose-600 disabled:opacity-50"
              title="Marcar como perdida"
            >
              <XCircle className="mr-1 h-3.5 w-3.5" />
              Perdeu
            </motion.button>
          </div>
        )}

        <button
          type="button"
          onClick={(e) => onDeleteMatch(e, match.id)}
          className="btn btn-circle btn-ghost btn-xs shrink-0 text-base-content/35 opacity-0 transition-all hover:bg-error/10 hover:text-error group-hover:opacity-100 focus:opacity-100"
          aria-label={`Remover partida ${match.data.homeTeam} vs ${match.data.awayTeam}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
};

export default MatchCardList;
