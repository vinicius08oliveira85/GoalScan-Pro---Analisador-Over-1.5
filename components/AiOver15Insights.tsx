import React, { useMemo, useState } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { MatchData } from '../types';
import { generateAiOver15Report } from '../services/aiOver15Service';

type Props = {
  data: MatchData;
  className?: string;
  onError?: (message: string) => void;
};

function renderMarkdownLight(md: string) {
  // Renderização leve (sem dependências): preserva quebras e bullets.
  // Se quiser markdown completo no futuro, trocar por um renderer dedicado.
  return md.split('\n').map((line, idx) => (
    <p key={idx} className="whitespace-pre-wrap leading-relaxed">
      {line.length === 0 ? '\u00A0' : line}
    </p>
  ));
}

const AiOver15Insights: React.FC<Props> = ({ data, className, onError }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<'gemini' | 'local' | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRun = useMemo(() => {
    return Boolean(data.homeTeam?.trim()) && Boolean(data.awayTeam?.trim());
  }, [data.homeTeam, data.awayTeam]);

  const handleRun = async () => {
    if (!canRun) return;

    setOpen(true);
    setLoading(true);
    setError(null);

    try {
      const res = await generateAiOver15Report(data);
      setProvider(res.provider);
      setReport(res.reportMarkdown);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao gerar análise com IA.';
      setError(message);
      if (onError) onError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleRun}
        disabled={!canRun || loading}
        className="btn btn-xs md:btn-sm btn-primary gap-2 min-h-[36px] md:min-h-[44px]"
        aria-disabled={!canRun || loading}
        title={!canRun ? 'Preencha os nomes dos times para analisar.' : 'Gerar análise com IA para Over 1.5'}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        IA Over 1.5
      </button>

      {open && (
        <div className="mt-4 rounded-2xl border border-primary/20 bg-base-100/40 backdrop-blur p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-widest opacity-60">
                Análise com IA (cruzamento de estatísticas)
              </p>
              <p className="text-[11px] opacity-60">
                {provider === 'gemini'
                  ? 'Fonte: Gemini'
                  : provider === 'local'
                    ? 'Fonte: fallback local (modelo atual)'
                    : loading
                      ? 'Gerando...'
                      : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn btn-ghost btn-xs"
              aria-label="Fechar análise"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="mt-3 alert alert-error">
              <span className="text-sm font-bold">{error}</span>
            </div>
          )}

          {loading && (
            <div className="mt-3 flex items-center gap-2 opacity-70">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Gerando análise...</span>
            </div>
          )}

          {report && !loading && (
            <div className="mt-3 text-sm">
              {renderMarkdownLight(report)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AiOver15Insights;

