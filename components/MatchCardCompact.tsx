import React from 'react';
import { motion } from 'framer-motion';
import { SavedAnalysis } from '../types';
import { TrendingUp, TrendingDown, Calendar, CheckCircle, XCircle, Clock, Trophy, Trash2 } from 'lucide-react';
import { cardHover } from '../utils/animations';
import { cn } from '../utils/cn';
import { getDisplayProbability, getSelectedProbabilityLabel } from '../utils/probability';
import { getRiskLevelFromProbability } from '../utils/risk';
import { formatMatchDate, formatMatchTime, formatTimestampInBrasilia } from '../utils/dateFormatter';
import { useChampionshipName } from '../hooks/useChampionshipName';
import { calculateEVPercent } from '../utils/evDecimal';
import { getBetDisplayFinancials } from '../utils/betFinancials';
import { getCurrencySymbol } from '../utils/currency';

interface MatchCardCompactProps {
  match: SavedAnalysis;
  index: number;
  onMatchClick: (match: SavedAnalysis) => void;
  onDeleteMatch: (e: React.MouseEvent, id: string) => void;
  bankCurrency?: string;
}

const MatchCardCompact: React.FC<MatchCardCompactProps> = React.memo(({
  match,
  index,
  onMatchClick,
  onDeleteMatch,
  bankCurrency,
}) => {
  const currencySymbol = getCurrencySymbol(bankCurrency ?? 'BRL');
  const statusStripClass = (() => {
    if (match.betInfo && match.betInfo.betAmount > 0) {
      if (match.betInfo.status === 'won') return 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]';
      if (match.betInfo.status === 'lost') return 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]';
      if (match.betInfo.status === 'pending') return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.35)]';
    }
    return 'bg-primary/50 shadow-[0_0_8px_rgba(99,102,241,0.2)]';
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

  const betMoney =
    match.betInfo && match.betInfo.betAmount > 0 ? getBetDisplayFinancials(match) : null;

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
        'group relative min-w-0 cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-base-100/40 p-2.5 pl-2 shadow-md shadow-black/5 ring-1 ring-white/5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/15 dark:border-white/10 dark:bg-base-100/25'
      )}
    >
      <span
        className={cn('absolute bottom-2 left-0 top-2 w-1 rounded-full', statusStripClass)}
        aria-hidden
      />
      <div className="flex min-w-0 items-center justify-between gap-2 pl-1.5">
        {/* Times - Compacto */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-black tracking-tight">
            <span className="truncate">{match.data.homeTeam}</span>
            <span className="shrink-0 text-primary/70">vs</span>
            <span className="truncate">{match.data.awayTeam}</span>
          </div>
          {championshipName && (
            <div className="flex items-center gap-1 mt-0.5 text-xs opacity-70">
              <Trophy className="w-3 h-3 text-warning" />
              <span className="truncate leading-relaxed">{championshipName}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1 text-xs opacity-70">
              <Calendar className="w-3 h-3" />
              {match.data.matchDate ? (
                <>
                  <span>
                    {formatMatchDate(match.data.matchDate, match.data.matchTime, {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </span>
                  {match.data.matchTime && (
                    <>
                      <span>•</span>
                      <Clock className="w-2.5 h-2.5" />
                      <span>{formatMatchTime(match.data.matchDate, match.data.matchTime)}</span>
                    </>
                  )}
                </>
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
              className={`px-2 py-1 rounded text-xs font-bold border ${getRiskBadge(riskLevel)}`}
            >
              {riskLevel}
            </span>
          </div>
        </div>

        {/* Métricas Compactas */}
        <div className="flex max-w-[min(100%,22rem)] shrink-0 items-center gap-2 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] sm:max-w-none sm:gap-3">
          {/* Probabilidade */}
          <div className="flex flex-col items-center min-w-[50px]">
            <div className="text-xs font-semibold opacity-70 uppercase leading-tight">Prob</div>
            <div className="font-mono text-sm font-black tabular-nums leading-none">{probability.toFixed(0)}%</div>
            {selectedLabel && (
              <div className="text-[10px] font-semibold opacity-70 mt-0.5 text-center leading-tight">
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
          <div className="flex flex-col items-center min-w-[45px]">
            <div className="text-xs font-semibold opacity-70 uppercase leading-tight">EV</div>
            <div
              className={cn(
                'flex items-center gap-0.5 font-mono text-sm font-black tabular-nums leading-none',
                displayEv > 0 ? 'text-success' : displayEv < 0 ? 'text-error' : 'opacity-50'
              )}
            >
              {displayEv > 0 && <TrendingUp className="h-3.5 w-3.5 shrink-0" />}
              {displayEv < 0 && <TrendingDown className="h-3.5 w-3.5 shrink-0" />}
              <span className="text-xs">
                {displayEv > 0 ? '+' : ''}
                {displayEv.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Odd */}
          <div className="flex flex-col items-center min-w-[40px]">
            <div className="text-xs font-semibold opacity-70 uppercase leading-tight">Odd</div>
            <div className="font-mono text-sm font-black tabular-nums leading-none text-primary">
              {match.data.oddOver15?.toFixed(2) || '-'}
            </div>
          </div>

          {match.betInfo && match.betInfo.betAmount > 0 && betMoney && (
            <div className="flex flex-col items-center min-w-[44px]">
              <div className="text-xs font-semibold opacity-70 uppercase leading-tight">Stake</div>
              <div className="font-mono text-sm font-black tabular-nums leading-none">{match.betInfo.betAmount.toFixed(0)}</div>
              {match.betInfo.status === 'pending' && (
                <div className="mt-0.5 font-mono text-[10px] font-bold tabular-nums leading-tight text-primary">
                  {currencySymbol} {betMoney.potentialReturn.toFixed(0)}
                </div>
              )}
              {match.betInfo.status === 'won' && (
                <div className="mt-0.5 font-mono text-[10px] font-bold tabular-nums leading-tight text-success">
                  +{currencySymbol} {betMoney.potentialProfit.toFixed(0)}
                </div>
              )}
            </div>
          )}

          {/* Status Badge */}
          {match.betInfo && match.betInfo.betAmount > 0 && (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                match.betInfo.status === 'won'
                  ? 'bg-success/20 text-success'
                  : match.betInfo.status === 'lost'
                    ? 'bg-error/20 text-error'
                    : match.betInfo.status === 'pending'
                      ? 'bg-warning/20 text-warning'
                      : 'bg-base-300/20 text-base-content/60'
              }`}
            >
              {match.betInfo.status === 'won' && <CheckCircle className="w-3 h-3" />}
              {match.betInfo.status === 'lost' && <XCircle className="w-3 h-3" />}
              {match.betInfo.status === 'pending' && <Clock className="w-3 h-3" />}
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
            type="button"
            onClick={(e) => onDeleteMatch(e, match.id)}
            className="btn btn-circle btn-ghost btn-xs shrink-0 text-base-content/35 opacity-0 transition-all hover:bg-error/10 hover:text-error group-hover:opacity-100 focus:opacity-100"
            aria-label={`Remover partida ${match.data.homeTeam} vs ${match.data.awayTeam}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
});

MatchCardCompact.displayName = 'MatchCardCompact';

export default MatchCardCompact;
