import React from 'react';
import { motion } from 'framer-motion';
import { SavedAnalysis, BetInfo, BankSettings as BankSettingsType } from '../types';
import { Plus, Trash2, Check, X, BarChart2, Loader } from 'lucide-react';
import StatusBadge from './StatusBadge';
import SkeletonLoader from './SkeletonLoader';
import { getCurrencySymbol } from '../utils/currency';

interface MatchesScreenProps {
  savedMatches: SavedAnalysis[];
  onMatchClick: (match: SavedAnalysis) => void;
  onNewMatch: () => void;
  onDeleteMatch: (e: React.MouseEvent, id: string) => void;
  onUpdateBetStatus: (match: SavedAnalysis, status: 'won' | 'lost') => void;
  onAnalyzeResult: (match: SavedAnalysis) => void;
  isLoading: boolean;
  isUpdatingBetStatus: boolean;
  bankSettings: BankSettingsType | null;
}

const MatchCard: React.FC<{
  match: SavedAnalysis;
  onMatchClick: (match: SavedAnalysis) => void;
  onDeleteMatch: (e: React.MouseEvent, id: string) => void;
  onUpdateBetStatus: (match: SavedAnalysis, status: 'won' | 'lost') => void;
  onAnalyzeResult: (match: SavedAnalysis) => void;
  isUpdatingBetStatus: boolean;
  currencySymbol: string;
}> = ({ match, onMatchClick, onDeleteMatch, onUpdateBetStatus, onAnalyzeResult, isUpdatingBetStatus, currencySymbol }) => {
  const { data, betInfo } = match;
  const hasBet = betInfo && betInfo.betAmount > 0;
  const isPending = hasBet && betInfo.status === 'pending';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onClick={() => onMatchClick(match)}
      className="custom-card p-4 flex flex-col gap-4 hover:bg-base-200/50 cursor-pointer transition-colors duration-200"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-base-content/60">{data.matchDate || 'Data não definida'}</p>
          <h3 className="font-bold text-lg truncate">{`${data.homeTeam} vs ${data.awayTeam}`}</h3>
          <p className="text-sm text-primary font-semibold">{data.competition || 'Competição não definida'}</p>
        </div>
        <div className="flex-shrink-0 ml-2">
          {hasBet ? (
            <StatusBadge status={betInfo.status} />
          ) : (
            <span className="badge badge-ghost badge-sm">Sem Aposta</span>
          )}
        </div>
      </div>

      {hasBet && (
        <div className="border-t border-base-300 pt-3 flex justify-between items-center">
          <div className="flex gap-4 items-center">
            <div className="text-center">
              <p className="text-xs text-base-content/60">Aposta</p>
              <p className="font-bold text-base-content">{`${currencySymbol} ${betInfo.betAmount.toFixed(2)}`}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-base-content/60">Odd</p>
              <p className="font-bold text-primary">{betInfo.odd.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isUpdatingBetStatus && (
              <Loader className="w-5 h-5 animate-spin text-primary" />
            )}
            {isPending && !isUpdatingBetStatus && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdateBetStatus(match, 'won'); }}
                  className="btn btn-sm btn-success btn-outline gap-1"
                  title="Marcar como Ganha"
                >
                  <Check className="w-4 h-4" /> Ganha
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdateBetStatus(match, 'lost'); }}
                  className="btn btn-sm btn-error btn-outline gap-1"
                  title="Marcar como Perdida"
                >
                  <X className="w-4 h-4" /> Perdida
                </button>
              </>
            )}
            {!isPending && (
              <button
                onClick={(e) => { e.stopPropagation(); onAnalyzeResult(match); }}
                className="btn btn-sm btn-ghost text-primary gap-1"
                title="Analisar Resultado"
              >
                <BarChart2 className="w-4 h-4" /> Analisar
              </button>
            )}
            <button
              onClick={(e) => onDeleteMatch(e, match.id)}
              className="btn btn-xs btn-circle btn-ghost text-error/70 hover:bg-error/20"
              title="Deletar Partida"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const MatchesScreen: React.FC<MatchesScreenProps> = ({
  savedMatches,
  onMatchClick,
  onNewMatch,
  onDeleteMatch,
  onUpdateBetStatus,
  onAnalyzeResult,
  isLoading,
  isUpdatingBetStatus,
  bankSettings,
}) => {
  const sortedMatches = [...savedMatches].sort((a, b) => b.timestamp - a.timestamp);
  const currencySymbol = getCurrencySymbol(bankSettings?.currency);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Partidas Salvas</h2>
        <button onClick={onNewMatch} className="btn btn-primary gap-2">
          <Plus className="w-5 h-5" />
          Nova Análise
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="custom-card p-4 flex flex-col gap-4">
              <SkeletonLoader variant="text" width="50%" />
              <SkeletonLoader variant="text" width="80%" height="1.75rem" />
              <SkeletonLoader variant="text" width="60%" />
              <div className="border-t border-base-300 pt-3 flex justify-between items-center">
                <SkeletonLoader variant="rectangular" width="120px" height="40px" />
                <SkeletonLoader variant="rectangular" width="80px" height="32px" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedMatches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onMatchClick={onMatchClick}
              onDeleteMatch={onDeleteMatch}
              onUpdateBetStatus={onUpdateBetStatus}
              onAnalyzeResult={onAnalyzeResult}
              isUpdatingBetStatus={isUpdatingBetStatus}
              currencySymbol={currencySymbol}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 custom-card border-dashed">
          <h3 className="text-xl font-bold">Nenhuma partida salva ainda</h3>
          <p className="text-base-content/70 mt-2 mb-6">
            Clique em "Nova Análise" para começar a avaliar suas partidas.
          </p>
          <button onClick={onNewMatch} className="btn btn-primary btn-lg">
            Criar Primeira Análise
          </button>
        </div>
      )}
    </div>
  );
};

export default MatchesScreen;