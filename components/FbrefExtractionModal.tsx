import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Loader2, CheckCircle, XCircle, AlertCircle, X, ClipboardPaste } from 'lucide-react';
import ModalShell from './ui/ModalShell';
import { extractFbrefData, extractFbrefDataClientSide, extractFbrefDataWithSelenium, saveExtractedTables, ExtractType, FbrefExtractionResult } from '../services/fbrefService';
import { parseFbrefHtml } from '../services/fbrefClientScraper';
import { Championship } from '../types';
import { animations } from '../utils/animations';

interface Props {
  championship: Championship;
  onClose: () => void;
  onTableSaved?: () => void;
  onError?: (message: string) => void;
}

export default function FbrefExtractionModal({
  championship,
  onClose,
  onTableSaved,
  onError,
}: Props) {
  const [url, setUrl] = useState((championship as any).fbrefUrl ?? '');
  const extractTypes: ExtractType[] = ['table'];
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FbrefExtractionResult | null>(null);
  const [previewTables, setPreviewTables] = useState<Record<string, unknown[]> | null>(null);
  const [activePreviewTable, setActivePreviewTable] = useState('geral');
  const [saving, setSaving] = useState(false);
  type ExtractionMode = 'client' | 'api' | 'selenium' | 'paste';
  const [mode, setMode] = useState<ExtractionMode>('paste');
  const [pasteHtml, setPasteHtml] = useState('');

  const handleExtract = async () => {
    if (mode === 'paste') {
      if (!pasteHtml.trim()) {
        onError?.('Cole o HTML da página do FBref');
        return;
      }
    } else {
      if (!url.trim()) {
        onError?.('Por favor, insira a URL do campeonato no fbref.com');
        return;
      }
      if (!url.includes('fbref.com')) {
        onError?.('URL inválida. Apenas URLs do fbref.com são permitidas.');
        return;
      }
    }

    setLoading(true);
    setResult(null);
    setPreviewTables(null);

    try {
      let extractionResult: FbrefExtractionResult;

      if (mode === 'paste') {
        extractionResult = parseFbrefHtml(pasteHtml);
      } else if (mode === 'client') {
        extractionResult = await extractFbrefDataClientSide({
          championshipUrl: url.trim(),
          championshipId: championship.id,
          extractTypes,
        });
      } else if (mode === 'selenium') {
        extractionResult = await extractFbrefDataWithSelenium({
          championshipUrl: url.trim(),
          championshipId: championship.id,
          extractTypes,
        });
      } else {
        extractionResult = await extractFbrefData({
          championshipUrl: url.trim(),
          championshipId: championship.id,
          extractTypes,
        });
      }

      setResult(extractionResult);

      if (extractionResult.success && extractionResult.data?.tables) {
        setPreviewTables(extractionResult.data.tables as Record<string, unknown[]>);

        const keys = Object.keys(extractionResult.data.tables);
        const firstWithData = keys.find((k) => {
          const arr = extractionResult.data?.tables?.[k];
          return Array.isArray(arr) && arr.length > 0;
        }) || keys[0] || 'geral';
        setActivePreviewTable(firstWithData);
      } else {
        onError?.(extractionResult.error || 'Erro ao extrair dados');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      onError?.(message);
      setResult({
        success: false,
        error: message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-extrair se a URL já estiver preenchida ao abrir o modal
  React.useEffect(() => {
    if (mode !== 'paste' && url.trim() && url.includes('fbref.com') && !loading && !result && !previewTables) {
      const timer = setTimeout(() => {
        handleExtract();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [mode, url, loading, result, previewTables, handleExtract]);

  const handleSave = async () => {
    if (!previewTables) {
      onError?.('Nenhum dado para salvar');
      return;
    }

    setSaving(true);

    try {
      const allRows = Object.values(previewTables).flat();
      if (allRows.length === 0) {
        throw new Error('Nenhum dado válido encontrado para salvar');
      }

      const mergeBySquad = (tableArrays: unknown[][]): Record<string, unknown>[] => {
        const merged = new Map<string, Record<string, unknown>>();
        for (const tableRows of tableArrays) {
          if (!Array.isArray(tableRows)) continue;
          for (const row of tableRows) {
            const r = row as Record<string, unknown>;
            const squad = r.Squad || r.squad;
            if (!squad) continue;
            const key = String(squad);
            const existing = merged.get(key);
            if (existing) {
              Object.assign(existing, r);
            } else {
              merged.set(key, { ...r });
            }
          }
        }
        return Array.from(merged.values());
      };

      const tablesToSave = {
        geral: previewTables.geral || [],
        complement: mergeBySquad([
          previewTables.standard || [],
          previewTables.goalkeeping || [],
          previewTables.shooting || [],
          previewTables.playing_time || [],
          previewTables.misc || [],
        ]),
      };

      await saveExtractedTables(championship.id, tablesToSave);

      onTableSaved?.();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar tabela';
      onError?.(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      isOpen={true}
      onClose={onClose}
      closeOnOverlayClick
      closeOnEscape
      showCloseButton={false}
      containerClassName="z-[300]"
      overlayClassName="bg-black/60 backdrop-blur-sm"
      panelClassName="max-w-2xl w-full"
    >
      <div className="relative overflow-hidden rounded-2xl border border-base-300/50 bg-base-200/80 p-6 border-l-4 border-l-primary/60">
        <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-secondary/5 blur-3xl pointer-events-none" />
        {/* Header */}
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
              <ExternalLink className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg md:text-xl font-black text-gradient">Extrair Dados do FBref.com</h2>
          </div>
          <button
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Extraction Mode Selector */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-bold">Modo de Extração</span>
            </label>
            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-base-300/50 cursor-pointer hover:bg-base-200/50 transition-colors">
                <input
                  type="radio"
                  name="extraction-mode"
                  className="radio radio-primary radio-sm mt-0.5"
                  checked={mode === 'paste'}
                  onChange={() => setMode('paste')}
                  disabled={loading || saving}
                />
                <div>
                  <div className="font-bold text-sm">Colar HTML (Recomendado)</div>
                  <div className="text-xs opacity-70">
                    Abra o FBref no browser, Ctrl+A, Ctrl+C, e cole aqui. 100% confiável, sem backend.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-xl border border-base-300/50 cursor-pointer hover:bg-base-200/50 transition-colors">
                <input
                  type="radio"
                  name="extraction-mode"
                  className="radio radio-primary radio-sm mt-0.5"
                  checked={mode === 'client'}
                  onChange={() => setMode('client')}
                  disabled={loading || saving}
                />
                <div>
                  <div className="font-bold text-sm">Automático via URL</div>
                  <div className="text-xs opacity-70">
                    Proxy serverless + parse no navegador. Pode falhar se o FBref bloquear.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-xl border border-base-300/50 cursor-pointer hover:bg-base-200/50 transition-colors">
                <input
                  type="radio"
                  name="extraction-mode"
                  className="radio radio-primary radio-sm mt-0.5"
                  checked={mode === 'api'}
                  onChange={() => setMode('api')}
                  disabled={loading || saving}
                />
                <div>
                  <div className="font-bold text-sm">Backend Python</div>
                  <div className="text-xs opacity-70">
                    API Python no Vercel com BeautifulSoup.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-xl border border-base-300/50 cursor-pointer hover:bg-base-200/50 transition-colors">
                <input
                  type="radio"
                  name="extraction-mode"
                  className="radio radio-primary radio-sm mt-0.5"
                  checked={mode === 'selenium'}
                  onChange={() => setMode('selenium')}
                  disabled={loading || saving}
                />
                <div>
                  <div className="font-bold text-sm">Selenium (Headless Chrome)</div>
                  <div className="text-xs opacity-70">
                    Para páginas com JavaScript dinâmico. Mais lento.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Paste HTML - shown only in paste mode */}
          {mode === 'paste' && (
            <div className="form-control">
              <label className="label">
                <span className="label-text font-bold">Cole o HTML da página do FBref</span>
              </label>
              <div className="text-xs opacity-70 mb-2">
                1. Abra a página do campeonato no{' '}
                <a href="https://fbref.com" target="_blank" rel="noopener" className="link link-primary">
                  fbref.com
                </a>
                <br />
                2. Na seção de classificação (Overall), pressione{' '}
                <kbd className="kbd kbd-xs">Ctrl</kbd>+<kbd className="kbd kbd-xs">A</kbd> para selecionar tudo
                <br />
                3. Pressione <kbd className="kbd kbd-xs">Ctrl</kbd>+<kbd className="kbd kbd-xs">C</kbd> para copiar
                <br />
                4. Cole aqui com <kbd className="kbd kbd-xs">Ctrl</kbd>+<kbd className="kbd kbd-xs">V</kbd>
              </div>
              <textarea
                value={pasteHtml}
                onChange={(e) => setPasteHtml(e.target.value)}
                placeholder="<table class=&quot;stats_table&quot; ...> ou toda a página HTML do FBref"
                className="textarea textarea-bordered h-40 font-mono text-xs resize-y"
                disabled={loading || saving}
              />
              {pasteHtml.length > 0 && (
                <label className="label">
                  <span className="label-text-alt opacity-50">
                    {pasteHtml.length.toLocaleString()} caracteres
                  </span>
                </label>
              )}
            </div>
          )}

          {/* URL Input - hidden in paste mode */}
          {mode !== 'paste' && (
            <>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold">URL do Campeonato no FBref.com</span>
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://fbref.com/en/comps/..."
                  className="input input-bordered"
                  disabled={loading || saving}
                />
                <label className="label">
                  <span className="label-text-alt opacity-70">
                    Cole a URL completa da página do campeonato no fbref.com
                  </span>
                </label>
              </div>

              <div className="text-sm opacity-70">
                Este modo extrai automaticamente a tabela:{' '}
                <span className="font-semibold">geral</span> (classificação).
              </div>
            </>
          )}

          {/* Extract Button */}
          <button
            onClick={handleExtract}
            disabled={loading || saving || (mode === 'paste' ? !pasteHtml.trim() : !url.trim())}
            className="btn btn-primary w-full gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {mode === 'paste' ? 'Analisando HTML...' : 'Extraindo...'}
              </>
            ) : mode === 'paste' ? (
              <>
                <ClipboardPaste className="w-5 h-5" />
                Analisar HTML Colado
              </>
            ) : (
              <>
                <ExternalLink className="w-5 h-5" />
                Extrair Dados
              </>
            )}
          </button>

          {/* Result */}
          {result && (
            <motion.div
              initial="initial"
              animate="animate"
              variants={animations.fadeInUp}
              className={`relative overflow-hidden rounded-xl border border-l-4 p-4 ${
                result.success
                  ? 'border-l-success/60 border-base-300/40 bg-success/8'
                  : 'border-l-error/60 border-base-300/40 bg-error/8'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-success mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-error mt-0.5 shrink-0" />
                )}
              <div className="min-w-0">
                <p className="font-bold">
                  {result.success ? 'Extração bem-sucedida!' : 'Erro na extração'}
                </p>
                {result.error && (
                  <div className="text-sm opacity-90 mt-1">
                    <p className="whitespace-pre-line">{result.error}</p>
                    {result.error_details && (
                      <details className="mt-2 text-xs opacity-75">
                        <summary className="cursor-pointer hover:opacity-100">
                          Detalhes técnicos (clique para expandir)
                        </summary>
                        <div className="mt-2 p-2 bg-black/20 rounded">
                          <p><strong>Tipo:</strong> {result.error_details.type || 'N/A'}</p>
                          {result.error_details.status_code && (
                            <p><strong>Status Code:</strong> {result.error_details.status_code}</p>
                          )}
                          {result.error_details.url && (
                            <p><strong>URL:</strong> {result.error_details.url}</p>
                          )}
                          {result.error_details.message && (
                            <p><strong>Mensagem:</strong> {result.error_details.message}</p>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                )}
                {result.success && result.data?.missingTables && result.data.missingTables.length > 0 && (
                  <p className="text-sm opacity-90 mt-1">
                    Tabelas não encontradas: <span className="font-semibold">{result.data.missingTables.join(', ')}</span>
                  </p>
                )}
              </div>
            </div>
            </motion.div>
          )}

          {/* Preview */}
          {previewTables && (() => {
            const tableKeys = Object.keys(previewTables);
            const totalRows = tableKeys.reduce((sum, k) => sum + (Array.isArray(previewTables[k]) ? previewTables[k].length : 0), 0);
            const LABELS: Record<string, string> = {
              geral: 'Classificação',
              standard: 'Stats Gerais',
              goalkeeping: 'Goleiros',
              shooting: 'Finalizações',
              playing_time: 'Tempo de Jogo',
              misc: 'Diversos',
            };

            return (
              <motion.div
                initial="initial"
                animate="animate"
                variants={animations.fadeInUp}
                className="surface-muted p-4 rounded-xl"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-info" />
                    <span className="font-bold">Preview das Tabelas</span>
                  </div>
                  <span className="badge badge-info">
                    {totalRows} linhas em {tableKeys.length} tabela(s)
                  </span>
                </div>

                <div role="tablist" className="tabs tabs-boxed tabs-sm mb-3 flex-wrap">
                  {tableKeys.map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="tab"
                      className={`tab ${activePreviewTable === t ? 'tab-active' : ''}`}
                      onClick={() => setActivePreviewTable(t)}
                    >
                      {LABELS[t] || t} ({Array.isArray(previewTables[t]) ? previewTables[t].length : 0})
                    </button>
                  ))}
                </div>

                {(() => {
                  const current = previewTables[activePreviewTable] as unknown[] | undefined;
                  const currentRows = Array.isArray(current) ? current : [];
                  if (currentRows.length === 0) {
                    return <div className="text-sm opacity-70">Sem dados para esta tabela.</div>;
                  }

                  const first = (currentRows[0] as Record<string, unknown>) || {};
                  const keys = Object.keys(first).slice(0, 6);

                  return (
                    <div className="max-h-64 overflow-y-auto">
                      <table className="table table-xs table-zebra">
                        <thead>
                          <tr>
                            {keys.map((key) => (
                              <th key={key} className="text-xs">
                                {key}
                              </th>
                            ))}
                            <th className="text-xs">...</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentRows.slice(0, 6).map((row, idx) => (
                            <tr key={idx}>
                              {keys.map((k) => (
                                <td key={k} className="text-xs">
                                  {String((row as Record<string, unknown>)[k] ?? '').substring(0, 24)}
                                </td>
                              ))}
                              <td className="text-xs opacity-50">...</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn btn-primary btn-sm w-full mt-4 gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Salvar Tabelas
                    </>
                  )}
                </button>
              </motion.div>
            );
          })()}
        </div>
      </div>
    </ModalShell>
  );
}

