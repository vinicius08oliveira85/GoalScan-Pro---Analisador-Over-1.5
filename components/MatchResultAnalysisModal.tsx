import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { SavedAnalysis, MatchResultAnalysis } from '../types';
import { generateAnalysisText, parseWebSearchResults } from '../services/matchResultAnalysisService';
import ModalShell from './ui/ModalShell';

// Tipo para a função de busca web (será passada como prop)
type WebSearchFunction = (query: string) => Promise<{
  results?: Array<{ content?: string; snippet?: string; url?: string }>;
}>;

interface MatchResultAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: SavedAnalysis | null;
  onAnalyze?: (match: SavedAnalysis) => Promise<MatchResultAnalysis>;
  webSearch?: WebSearchFunction; // Função opcional para busca web
}

const MatchResultAnalysisModal: React.FC<MatchResultAnalysisModalProps> = ({
  isOpen,
  onClose,
  match,
  onAnalyze,
  webSearch,
}) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<MatchResultAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && match) {
      setLoading(true);
      setError(null);
      setAnalysis(null);

      const performAnalysis = async () => {
        try {
          const { homeTeam, awayTeam, matchDate } = match.data;
          const betStatus = match.betInfo?.status;

          if (!betStatus || (betStatus !== 'won' && betStatus !== 'lost')) {
            throw new Error('A partida deve ter uma aposta finalizada (ganha ou perdida) para análise');
          }

          // Se há função webSearch, fazer busca e análise localmente
          if (webSearch) {
            const searchQuery = `${homeTeam} vs ${awayTeam} ${matchDate || ''} resultado placar`.trim();
            const searchResults = await webSearch(searchQuery);
            
            // Se não houver resultados, mostrar mensagem
            if (!searchResults.results || searchResults.results.length === 0) {
              throw new Error('Nenhum resultado encontrado na busca web. Por favor, tente novamente ou verifique se a partida foi finalizada.');
            }
            
            const searchText = searchResults.results?.map((r: { content?: string; snippet?: string; url?: string }) => r.content || r.snippet || '').join('\n\n') || '';
            const parsed = parseWebSearchResults(searchText);
            const analysisText = generateAnalysisText(match, parsed, searchText);

            setAnalysis({
              matchResult: {
                homeScore: parsed.homeScore,
                awayScore: parsed.awayScore,
                totalGoals: parsed.totalGoals,
              },
              betOutcome: betStatus,
              analysis: analysisText,
              sources: searchResults.results?.map((r: { url?: string }) => r.url || '').filter(Boolean) || [],
              generatedAt: Date.now(),
            });
          } else if (onAnalyze) {
            // Se há função onAnalyze fornecida, usar ela
            const result = await onAnalyze(match);
            setAnalysis(result);
          } else {
            throw new Error('Nenhuma função de análise disponível');
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao analisar resultado');
        } finally {
          setLoading(false);
        }
      };

      performAnalysis();
    } else if (!isOpen) {
      // Limpar estado quando modal fecha
      setAnalysis(null);
      setError(null);
    }
  }, [isOpen, match, onAnalyze, webSearch]);

  if (!match) return null;

  const { homeTeam, awayTeam, matchDate } = match.data;
  const betStatus = match.betInfo?.status || 'pending';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick
      closeOnEscape
      showCloseButton={false}
      containerClassName="z-[200]"
      overlayClassName="bg-black/50 backdrop-blur-sm"
      panelClassName="max-w-3xl w-full bg-base-200 rounded-xl shadow-2xl overflow-hidden"
      bodyClassName="p-0"
    >
      {/* Header */}
      <div className="bg-base-200/80 backdrop-blur-md border-b border-base-300 p-4 md:p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            {betStatus === 'won' ? (
              <CheckCircle className="w-5 h-5 text-success" />
            ) : (
              <XCircle className="w-5 h-5 text-error" />
            )}
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black">
              Análise do Resultado
            </h2>
            <p className="text-sm opacity-70">
              {homeTeam} vs {awayTeam}
              {matchDate && ` • ${new Date(matchDate).toLocaleDateString('pt-BR')}`}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="btn btn-sm btn-circle btn-ghost"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 max-h-[70vh] overflow-y-auto">
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-sm opacity-70">Buscando informações sobre o resultado...</p>
            <p className="text-xs opacity-50 mt-2">Isso pode levar alguns segundos</p>
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            <div>
              <p className="font-bold">Erro ao analisar resultado</p>
              <p className="text-sm opacity-90 mt-1">{error}</p>
              <p className="text-xs opacity-70 mt-2">
                Se o erro persistir, verifique se a partida tem uma aposta finalizada (ganha ou perdida).
              </p>
            </div>
          </div>
        )}

        {analysis && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Placar Final */}
            <div className="surface surface-hover p-4 md:p-6 rounded-xl border-2 border-primary/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black uppercase tracking-tight">Placar Final</h3>
                <div
                  className={`badge badge-lg font-black ${
                    analysis.betOutcome === 'won' ? 'badge-success' : 'badge-error'
                  }`}
                >
                  {analysis.betOutcome === 'won' ? 'Ganhou' : 'Perdeu'}
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 text-3xl md:text-4xl font-black">
                <div className="text-center">
                  <div className="text-xs opacity-70 mb-1">{homeTeam}</div>
                  <div>{analysis.matchResult.homeScore}</div>
                </div>
                <div className="text-2xl opacity-50">x</div>
                <div className="text-center">
                  <div className="text-xs opacity-70 mb-1">{awayTeam}</div>
                  <div>{analysis.matchResult.awayScore}</div>
                </div>
              </div>
              <div className="mt-4 text-center">
                <span className="text-sm opacity-70">Total de Gols: </span>
                <span className="text-lg font-black">{analysis.matchResult.totalGoals}</span>
              </div>
            </div>

            {/* Análise */}
            <div className="surface surface-hover p-4 md:p-6 rounded-xl">
              <h3 className="text-lg font-black uppercase tracking-tight mb-4">Análise</h3>
              <div
                className="prose prose-sm max-w-none text-base-content/90"
                dangerouslySetInnerHTML={{
                  __html: analysis.analysis
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/\n/g, '<br/>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/✅/g, '<span class="text-success">✅</span>')
                    .replace(/⚠️/g, '<span class="text-warning">⚠️</span>')
                    .replace(/^(.+)$/gm, '<p>$1</p>'),
                }}
              />
            </div>

            {/* Fontes */}
            {analysis.sources.length > 0 && (
              <div className="surface surface-hover p-4 md:p-6 rounded-xl">
                <h3 className="text-lg font-black uppercase tracking-tight mb-4 flex items-center gap-2">
                  <ExternalLink className="w-5 h-5" />
                  Fontes Consultadas
                </h3>
                <ul className="space-y-2">
                  {analysis.sources.map((source, index) => (
                    <li key={index} className="text-sm opacity-70 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                      {source}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs opacity-50 text-center">
              Análise gerada em {new Date(analysis.generatedAt).toLocaleString('pt-BR')}
            </div>
          </motion.div>
        )}
      </div>
    </ModalShell>
  );
};

export default MatchResultAnalysisModal;

