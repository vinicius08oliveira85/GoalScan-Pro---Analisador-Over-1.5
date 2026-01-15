import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Loader2, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import ModalShell from './ui/ModalShell';
import { extractFbrefData, extractFbrefDataWithSelenium, saveExtractedTables, ExtractType, FbrefExtractionResult } from '../services/fbrefService';
import {
  mapToTableRowsGcaFor,
  mapToTableRowsGeral,
  mapToTableRowsPassingFor,
  mapToTableRowsStandardFor,
} from '../utils/fbrefMapper';
import { Championship, TableType } from '../types';
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
  const [url, setUrl] = useState(championship.fbrefUrl ?? '');
  const extractTypes: ExtractType[] = ['table'];
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FbrefExtractionResult | null>(null);
  const [previewTables, setPreviewTables] = useState<
    Record<'geral' | 'standard_for' | 'passing_for' | 'gca_for', unknown[]> | null
  >(null);
  const [activePreviewTable, setActivePreviewTable] = useState<TableType>('geral');
  const [saving, setSaving] = useState(false);
  const [useSelenium, setUseSelenium] = useState(false);

  const handleExtract = async () => {
    if (!url.trim()) {
      onError?.('Por favor, insira a URL do campeonato no fbref.com');
      return;
    }

    if (!url.includes('fbref.com')) {
      onError?.('URL inválida. Apenas URLs do fbref.com são permitidas.');
      return;
    }

    setLoading(true);
    setResult(null);
    setPreviewTables(null);

    try {
      // Usa Selenium se marcado, senão usa a API padrão
      const extractionResult = useSelenium
        ? await extractFbrefDataWithSelenium({
            championshipUrl: url.trim(),
            championshipId: championship.id,
            extractTypes,
          })
        : await extractFbrefData({
            championshipUrl: url.trim(),
            championshipId: championship.id,
            extractTypes,
          });

      setResult(extractionResult);

      if (extractionResult.success && extractionResult.data?.tables) {
        setPreviewTables(extractionResult.data.tables);

        // Selecionar a primeira tabela com dados para preview
        const order: Array<TableType> = ['geral', 'standard_for', 'passing_for', 'gca_for'];
        const firstWithData =
          order.find((t) => (extractionResult.data?.tables?.[t]?.length ?? 0) > 0) || 'geral';
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
    if (url.trim() && url.includes('fbref.com') && !loading && !result && !previewTables) {
      // Pequeno delay para garantir que o modal está renderizado
      const timer = setTimeout(() => {
        handleExtract();
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executa apenas uma vez ao montar

  const handleSave = async () => {
    if (!previewTables) {
      onError?.('Nenhum dado para salvar');
      return;
    }

    setSaving(true);

    try {
      const mapped = {
        geral: mapToTableRowsGeral(previewTables.geral || []),
        standard_for: mapToTableRowsStandardFor(previewTables.standard_for || []),
        passing_for: mapToTableRowsPassingFor(previewTables.passing_for || []),
        gca_for: mapToTableRowsGcaFor(previewTables.gca_for || []),
      };

      const totalRows =
        mapped.geral.length +
        mapped.standard_for.length +
        mapped.passing_for.length +
        mapped.gca_for.length;

      if (totalRows === 0) {
        throw new Error('Nenhum dado válido encontrado após mapeamento');
      }

      await saveExtractedTables(championship.id, mapped);

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
      <div className="surface surface-hover p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ExternalLink className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-black">Extrair Dados do FBref.com</h2>
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
          {/* URL Input */}
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
            Este modo extrai automaticamente as tabelas:{' '}
            <span className="font-semibold">geral</span>,{' '}
            <span className="font-semibold">standard_for</span>,{' '}
            <span className="font-semibold">passing_for</span> e{' '}
            <span className="font-semibold">gca_for</span>.
          </div>

          {/* Selenium Toggle */}
          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                checked={useSelenium}
                onChange={(e) => setUseSelenium(e.target.checked)}
                className="checkbox checkbox-primary"
                disabled={loading || saving}
              />
              <div className="label-text">
                <div className="font-bold">Usar Selenium</div>
                <div className="text-xs opacity-70">
                  Use quando a página tiver JavaScript dinâmico ou proteções anti-scraping. Pode ser mais lento.
                </div>
              </div>
            </label>
          </div>

          {/* Extract Button */}
          <button
            onClick={handleExtract}
            disabled={loading || saving || !url.trim()}
            className="btn btn-primary w-full gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {useSelenium ? 'Extraindo com Selenium...' : 'Extraindo dados...'}
              </>
            ) : (
              <>
                <ExternalLink className="w-5 h-5" />
                Extrair Dados {useSelenium && '(Selenium)'}
              </>
            )}
          </button>

          {/* Result */}
          {result && (
            <motion.div
              initial="initial"
              animate="animate"
              variants={animations.fadeInUp}
              className={`alert ${result.success ? 'alert-success' : 'alert-error'}`}
            >
              {result.success ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              <div className="min-w-0">
                <p className="font-bold">
                  {result.success ? 'Extração bem-sucedida!' : 'Erro na extração'}
                </p>
                {result.error && <p className="text-sm opacity-90">{result.error}</p>}
                {result.success && result.data?.missingTables && result.data.missingTables.length > 0 && (
                  <p className="text-sm opacity-90 mt-1">
                    Tabelas não encontradas: <span className="font-semibold">{result.data.missingTables.join(', ')}</span>
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Preview */}
          {previewTables && (
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
                  {(previewTables.geral?.length ?? 0)} times (geral)
                </span>
              </div>

              <div role="tablist" className="tabs tabs-boxed tabs-sm mb-3">
                {(['geral', 'standard_for', 'passing_for', 'gca_for'] as TableType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    className={`tab ${activePreviewTable === t ? 'tab-active' : ''}`}
                    onClick={() => setActivePreviewTable(t)}
                  >
                    {t} ({(previewTables as any)[t]?.length ?? 0})
                  </button>
                ))}
              </div>

              {(() => {
                const current = (previewTables as any)[activePreviewTable] as unknown[] | undefined;
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
          )}
        </div>
      </div>
    </ModalShell>
  );
}

