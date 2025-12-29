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
  return md.split('\n').map((line, idx) => {
    // Detectar separadores (---) e renderizar como linha horizontal
    if (line.trim() === '---') {
      return <hr key={idx} className="my-4 border-t border-primary/20" />;
    }
    
    // Detectar títulos (## ou ###)
    if (line.startsWith('##')) {
      const level = line.match(/^#+/)?.[0].length || 2;
      const text = line.replace(/^#+\s*/, '');
      const HeadingTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
      return (
        <HeadingTag
          key={idx}
          className={`font-bold mt-6 mb-3 ${
            level === 2 ? 'text-lg' : level === 3 ? 'text-base' : 'text-sm'
          }`}
        >
          {text}
        </HeadingTag>
      );
    }
    
    // Detectar listas (- ou *)
    if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
      const text = line.replace(/^[-*]\s+/, '');
      // Detectar negrito (**texto**)
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return (
        <li key={idx} className="ml-4 mb-1 list-disc">
          {parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
            }
            return <span key={partIdx}>{part}</span>;
          })}
        </li>
      );
    }
    
    // Linha vazia
    if (line.length === 0) {
      return <br key={idx} />;
    }
    
    // Texto normal
    return (
      <p key={idx} className="whitespace-pre-wrap leading-relaxed mb-2">
        {line}
      </p>
    );
  });
}

const AiOver15Insights: React.FC<Props> = ({ data, className, onError }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<'gemini' | 'local' | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'info' | 'warning' | 'error'; title: string; message: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const canRun = useMemo(() => {
    return Boolean(data.homeTeam?.trim()) && Boolean(data.awayTeam?.trim());
  }, [data.homeTeam, data.awayTeam]);

  const handleRun = async () => {
    if (!canRun) return;

    setOpen(true);
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await generateAiOver15Report(data);
      setProvider(res.provider);
      setReport(res.reportMarkdown);
      setNotice(res.notice ?? null);
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

          {notice && !error && (
            <div className={`mt-3 alert ${notice.kind === 'error' ? 'alert-error' : notice.kind === 'info' ? 'alert-info' : 'alert-warning'}`}>
              <div className="min-w-0">
                <p className="text-sm font-black">{notice.title}</p>
                <p className="text-xs opacity-80 whitespace-pre-wrap">{notice.message}</p>
              </div>
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

