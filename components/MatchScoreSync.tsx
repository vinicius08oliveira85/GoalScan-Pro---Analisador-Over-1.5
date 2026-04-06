import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { SavedAnalysis } from '../types';
import { syncMatchScore, MatchScore } from '../services/googleMatchSync';

interface MatchScoreSyncProps {
  match: SavedAnalysis;
  onScoreUpdated?: (score: MatchScore) => void;
  autoSync?: boolean; // Sincronizar automaticamente
  syncInterval?: number; // Intervalo em segundos (padrão: 60)
  compact?: boolean; // Versão compacta para cards pequenos
}

const MatchScoreSync: React.FC<MatchScoreSyncProps> = ({
  match,
  onScoreUpdated,
  autoSync = false,
  syncInterval = 60,
  compact = false
}) => {
  const [score, setScore] = useState<MatchScore | null>(
    match.liveScore ? {
      homeScore: match.liveScore.homeScore,
      awayScore: match.liveScore.awayScore,
      minute: match.liveScore.minute,
      status: match.liveScore.status,
      lastUpdated: match.liveScore.lastSynced
    } : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSync = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await syncMatchScore(
        match.data.homeTeam,
        match.data.awayTeam,
        match.data.matchDate
      );

      if (result.success && result.score) {
        setScore(result.score);
        
        if (onScoreUpdated) {
          onScoreUpdated(result.score);
        }
      } else {
        setError(result.error || 'Não foi possível obter o placar');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao sincronizar placar');
    } finally {
      setIsLoading(false);
    }
  }, [match.data.homeTeam, match.data.awayTeam, match.data.matchDate, onScoreUpdated]);

  // Auto-sync se habilitado
  useEffect(() => {
    if (!autoSync) return;

    // Sincronizar imediatamente se não houver score ou se estiver desatualizado
    if (!score || (score.status === 'live' && Date.now() - score.lastUpdated > syncInterval * 1000)) {
      handleSync();
    }

    // Configurar intervalo para jogos ao vivo
    if (score?.status === 'live') {
      const interval = setInterval(() => {
        handleSync();
      }, syncInterval * 1000);

      return () => clearInterval(interval);
    }
  }, [autoSync, syncInterval, score, handleSync]);

  // Renderizar placar
  const renderScore = () => {
    if (!score) {
      if (isLoading) {
        return (
          <div
            className="flex items-center gap-2 rounded-lg border border-base-content/10 bg-base-200/40 px-2 py-2"
            aria-label="Buscando placar"
          >
            <span className="loading loading-spinner loading-xs text-primary shrink-0" />
            {compact ? (
              <div className="skeleton h-4 w-16 rounded" />
            ) : (
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <div className="skeleton h-5 w-28 rounded" />
                <div className="skeleton h-3 w-36 rounded opacity-70" />
              </div>
            )}
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2 text-sm opacity-60">
          <span>Placar não disponível</span>
        </div>
      );
    }

    const isLive = score.status === 'live';
    const isFinished = score.status === 'finished';
    const isNotStarted = score.status === 'not_started';

    if (compact) {
      // Versão compacta
      return (
        <div className="flex items-center gap-1.5 text-xs">
          {isLive && <span className="w-2 h-2 bg-error rounded-full animate-pulse" />}
          <span className="font-bold">
            {score.homeScore ?? '-'} - {score.awayScore ?? '-'}
          </span>
          {score.minute !== null && (
            <span className="opacity-70">({score.minute}')</span>
          )}
          {isLive && <span className="text-error font-semibold">AO VIVO</span>}
          {isFinished && <span className="opacity-60">Final</span>}
          {isNotStarted && <span className="opacity-60">Aguardando</span>}
        </div>
      );
    }

    // Versão completa
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black">
              {score.homeScore ?? '-'} - {score.awayScore ?? '-'}
            </span>
            {score.minute !== null && (
              <span className="text-sm opacity-70 font-semibold">
                ({score.minute}')
              </span>
            )}
          </div>
          {isLive && (
            <span className="px-2 py-1 bg-error/20 text-error border border-error/40 rounded text-xs font-bold flex items-center gap-1">
              <span className="w-2 h-2 bg-error rounded-full animate-pulse" />
              AO VIVO
            </span>
          )}
          {isFinished && (
            <span className="px-2 py-1 bg-base-300/20 text-base-content/60 border border-base-300/40 rounded text-xs font-semibold">
              Finalizado
            </span>
          )}
          {isNotStarted && (
            <span className="px-2 py-1 bg-warning/20 text-warning border border-warning/40 rounded text-xs font-semibold">
              Aguardando início
            </span>
          )}
        </div>
        {error && (
          <div className="flex items-center gap-2 text-xs text-error">
            <AlertCircle className="w-3 h-3" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2" aria-busy={isLoading}>
      {renderScore()}
      <button
        onClick={handleSync}
        disabled={isLoading}
        className={`btn btn-xs ${compact ? 'btn-ghost' : 'btn-outline'} gap-2 self-start`}
        title="Atualizar placar"
        type="button"
      >
        {isLoading ? (
          <>
            <span className="loading loading-spinner loading-xs text-primary" aria-hidden />
            <span className={compact ? 'hidden' : ''}>Atualizando...</span>
          </>
        ) : (
          <>
            <RefreshCw className="w-3 h-3" />
            <span className={compact ? 'hidden' : ''}>Atualizar Placar</span>
          </>
        )}
      </button>
    </div>
  );
};

export default MatchScoreSync;

