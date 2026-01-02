import React, { useMemo, useState, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { MatchData } from '../types';
import {
  generateAiOver15Report,
  extractProbabilityFromMarkdown,
  extractConfidenceFromMarkdown,
} from '../services/aiOver15Service';

type Props = {
  data: MatchData;
  className?: string;
  onError?: (message: string) => void;
  onAiAnalysisGenerated?: (
    data: MatchData,
    markdown: string,
    aiProbability: number | null,
    aiConfidence: number | null
  ) => void;
  savedReportMarkdown?: string | null;
};

interface Section {
  title: string;
  content: string[];
  index: number;
}

function parseMarkdownIntoSections(md: string): Section[] {
  const lines = md.split('\n');
  const sections: Section[] = [];
  let currentSection: Section | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    // Detectar títulos de seção (## mas não ###)
    if (line.trim().startsWith('##') && !line.trim().startsWith('###')) {
      // Salvar seção anterior se existir
      if (currentSection) {
        sections.push({
          ...currentSection,
          content: currentContent,
        });
      }

      // Iniciar nova seção
      const title = line.replace(/^#+\s*/, '').trim();
      currentSection = {
        title,
        content: [],
        index: sections.length,
      };
      currentContent = [];
    } else {
      // Se não há seção atual, criar uma seção padrão para conteúdo inicial
      if (!currentSection) {
        currentSection = {
          title: 'Análise',
          content: [],
          index: 0,
        };
      }
      // Adicionar linha ao conteúdo da seção atual
      currentContent.push(line);
    }
  }

  // Adicionar última seção
  if (currentSection) {
    sections.push({
      ...currentSection,
      content: currentContent,
    });
  }

  // Se não encontrou nenhuma seção, criar uma única seção com todo o conteúdo
  if (sections.length === 0) {
    sections.push({
      title: 'Análise',
      content: lines,
      index: 0,
    });
  }

  return sections;
}

function renderMarkdownContent(lines: string[]): React.ReactNode[] {
  return lines.map((line, idx) => {
    // Detectar separadores (---) e renderizar como linha horizontal
    if (line.trim() === '---') {
      return <hr key={idx} className="my-4 border-t border-primary/20" />;
    }

    // Detectar títulos (### ou menores - não ## pois já foram processados)
    if (line.trim().startsWith('###')) {
      const level = line.match(/^#+/)?.[0].length || 3;
      const text = line.replace(/^#+\s*/, '');
      const HeadingTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
      return (
        <HeadingTag
          key={idx}
          className={`font-bold mt-4 mb-2 ${level === 3 ? 'text-base' : 'text-sm'}`}
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

interface CollapsibleSectionProps {
  section: Section;
  isExpanded: boolean;
  onToggle: () => void;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  section,
  isExpanded,
  onToggle,
}) => {
  return (
    <div className="border-b border-base-300/50 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-3 hover:bg-base-300/30 active:bg-base-300/40 transition-all duration-200 rounded-lg group"
        aria-expanded={isExpanded}
      >
        <h3 className="text-sm font-bold text-left flex-1 text-base-content group-hover:text-primary transition-colors">
          {section.title}
        </h3>
        <div className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-base-content/60" />
          ) : (
            <ChevronDown className="w-4 h-4 text-base-content/60" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div
          className="px-3 pb-4 pt-2 text-sm overflow-hidden"
          style={{
            animation: 'fadeIn 0.3s ease-out',
          }}
        >
          <div className="space-y-2 text-base-content/90">
            {renderMarkdownContent(section.content)}
          </div>
        </div>
      )}
    </div>
  );
};

const AiOver15Insights: React.FC<Props> = ({
  data,
  className,
  onError,
  onAiAnalysisGenerated,
  savedReportMarkdown,
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<'gemini' | 'local' | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    kind: 'info' | 'warning' | 'error';
    title: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

  const canRun = useMemo(() => {
    return Boolean(data.homeTeam?.trim()) && Boolean(data.awayTeam?.trim());
  }, [data.homeTeam, data.awayTeam]);

  const hasSavedReport = Boolean(savedReportMarkdown && savedReportMarkdown.trim().length > 0);

  // Parsear seções do markdown
  const sections = useMemo(() => {
    if (!report) return [];
    return parseMarkdownIntoSections(report);
  }, [report]);

  // Inicializar estado de seções expandidas quando o report muda
  React.useEffect(() => {
    if (sections.length > 0) {
      // Primeira seção expandida por padrão
      setExpandedSections(new Set([0]));
    }
  }, [sections.length]);

  const toggleSection = useCallback((index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const expandAllSections = useCallback(() => {
    setExpandedSections(new Set(sections.map((_, idx) => idx)));
  }, [sections]);

  const collapseAllSections = useCallback(() => {
    setExpandedSections(new Set([0])); // Manter apenas a primeira expandida
  }, []);

  const allExpanded = sections.length > 0 && expandedSections.size === sections.length;

  const openSavedReport = () => {
    if (!hasSavedReport) return;
    setOpen(true);
    setLoading(false);
    setError(null);
    setNotice(null);
    setProvider(null);
    setReport(savedReportMarkdown ?? null);
  };

  const handleGenerate = async () => {
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

      // Extrair probabilidade e confiança da análise
      const aiProbability = extractProbabilityFromMarkdown(res.reportMarkdown);
      const aiConfidence = extractConfidenceFromMarkdown(res.reportMarkdown);

      // Chamar callback para processar e salvar análise
      if (onAiAnalysisGenerated) {
        onAiAnalysisGenerated(data, res.reportMarkdown, aiProbability, aiConfidence);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao gerar análise com IA.';
      setError(message);
      if (onError) onError(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrimaryClick = () => {
    if (!canRun || loading) return;
    // Se já há report carregado na UI, só abrir o painel.
    if (report) {
      setOpen(true);
      return;
    }
    // Se existe relatório salvo na partida, abrir sem gerar novamente.
    if (hasSavedReport) {
      openSavedReport();
      return;
    }
    // Caso contrário, gerar.
    void handleGenerate();
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handlePrimaryClick}
        disabled={!canRun || loading}
        className="btn btn-xs md:btn-sm btn-primary gap-2 min-h-[36px] md:min-h-[44px]"
        aria-disabled={!canRun || loading}
        title={
          !canRun
            ? 'Preencha os nomes dos times para analisar.'
            : hasSavedReport
              ? 'Abrir análise salva de IA (sem gerar novamente)'
              : 'Gerar análise com IA para Over 1.5'
        }
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        IA Over 1.5
      </button>

      {open && (
        <div className="mt-4 surface surface-hover p-4">
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
                    : hasSavedReport && report
                      ? 'Fonte: salva'
                      : loading
                        ? 'Gerando...'
                        : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasSavedReport && (
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={!canRun || loading}
                  className="btn btn-outline btn-xs gap-1"
                  title="Gerar novamente e salvar por cima"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar IA
                </button>
              )}
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
          </div>

          {error && (
            <div className="mt-3 alert alert-error">
              <div className="min-w-0">
                <p className="text-sm font-black">Erro ao gerar análise</p>
                <p className="text-xs opacity-90 whitespace-pre-wrap mt-1">{error}</p>
              </div>
            </div>
          )}

          {notice && !error && (
            <div
              className={`mt-3 alert ${notice.kind === 'error' ? 'alert-error' : notice.kind === 'info' ? 'alert-info' : 'alert-warning'}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-black">{notice.title}</p>
                <p className="text-xs opacity-80 whitespace-pre-wrap mt-1">{notice.message}</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="mt-3 flex items-center gap-2 opacity-70">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Gerando análise...</span>
            </div>
          )}

          {report && !loading && sections.length > 0 && (
            <div className="mt-4">
              {/* Controles de expandir/recolher */}
              {sections.length > 1 && (
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-base-300/30">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50">
                    {expandedSections.size} de {sections.length} seções expandidas
                  </span>
                  <button
                    type="button"
                    onClick={allExpanded ? collapseAllSections : expandAllSections}
                    className="btn btn-ghost btn-xs gap-1.5 text-[10px] hover:bg-base-300/40"
                    title={allExpanded ? 'Recolher todas as seções' : 'Expandir todas as seções'}
                  >
                    {allExpanded ? (
                      <>
                        <Minimize2 className="w-3 h-3" />
                        <span className="hidden sm:inline">Recolher Todas</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3 h-3" />
                        <span className="hidden sm:inline">Expandir Todas</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Seções colapsáveis */}
              <div className="max-h-[600px] overflow-y-auto custom-scrollbar space-y-0 bg-base-300/10 rounded-lg p-2">
                {sections.map((section) => (
                  <CollapsibleSection
                    key={section.index}
                    section={section}
                    isExpanded={expandedSections.has(section.index)}
                    onToggle={() => toggleSection(section.index)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AiOver15Insights;
