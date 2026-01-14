import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Loader2, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import ModalShell from './ui/ModalShell';
import { extractFbrefData, saveExtractedTable, ExtractType, FbrefExtractionResult } from '../services/fbrefService';
import { mapToTableRowsGeral, mapToTableRowsStandardFor } from '../utils/fbrefMapper';
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
  const [url, setUrl] = useState('');
  const [extractTypes, setExtractTypes] = useState<ExtractType[]>(['table']);
  const [tableType, setTableType] = useState<'geral' | 'standard_for'>('geral');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FbrefExtractionResult | null>(null);
  const [previewData, setPreviewData] = useState<unknown[] | null>(null);
  const [saving, setSaving] = useState(false);

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
    setPreviewData(null);

    try {
      const extractionResult = await extractFbrefData({
        championshipUrl: url.trim(),
        championshipId: championship.id,
        extractTypes,
        tableType,
      });

      setResult(extractionResult);

      if (extractionResult.success && extractionResult.data?.table) {
        setPreviewData(extractionResult.data.table as unknown[]);
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

  const handleSave = async () => {
    if (!previewData || previewData.length === 0) {
      onError?.('Nenhum dado para salvar');
      return;
    }

    setSaving(true);

    try {
      // Mapear dados para formato correto
      const mappedData =
        tableType === 'geral'
          ? mapToTableRowsGeral(previewData)
          : mapToTableRowsStandardFor(previewData);

      if (mappedData.length === 0) {
        throw new Error('Nenhum dado válido encontrado após mapeamento');
      }

      // Salvar tabela
      await saveExtractedTable(championship.id, tableType, mappedData);

      onTableSaved?.();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar tabela';
      onError?.(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleExtractType = (type: ExtractType) => {
    if (extractTypes.includes(type)) {
      setExtractTypes(extractTypes.filter((t) => t !== type));
    } else {
      setExtractTypes([...extractTypes, type]);
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

          {/* Table Type */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-bold">Tipo de Tabela</span>
            </label>
            <select
              value={tableType}
              onChange={(e) => setTableType(e.target.value as 'geral' | 'standard_for')}
              className="select select-bordered"
              disabled={loading || saving}
            >
              <option value="geral">Geral</option>
              <option value="standard_for">Standard (For) - Complemento</option>
            </select>
          </div>

          {/* Extract Types (desabilitado por enquanto, apenas tabela) */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-bold">Tipos de Dados</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <label className="label cursor-pointer gap-2">
                <input
                  type="checkbox"
                  checked={extractTypes.includes('table')}
                  onChange={() => toggleExtractType('table')}
                  className="checkbox checkbox-primary checkbox-sm"
                  disabled={loading || saving}
                />
                <span className="label-text">Tabela</span>
              </label>
              <label className="label cursor-pointer gap-2 opacity-50">
                <input
                  type="checkbox"
                  checked={extractTypes.includes('matches')}
                  onChange={() => toggleExtractType('matches')}
                  className="checkbox checkbox-primary checkbox-sm"
                  disabled={true}
                />
                <span className="label-text">Jogos (em breve)</span>
              </label>
              <label className="label cursor-pointer gap-2 opacity-50">
                <input
                  type="checkbox"
                  checked={extractTypes.includes('team-stats')}
                  onChange={() => toggleExtractType('team-stats')}
                  className="checkbox checkbox-primary checkbox-sm"
                  disabled={true}
                />
                <span className="label-text">Estatísticas (em breve)</span>
              </label>
            </div>
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
                Extraindo dados...
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
              </div>
            </motion.div>
          )}

          {/* Preview */}
          {previewData && previewData.length > 0 && (
            <motion.div
              initial="initial"
              animate="animate"
              variants={animations.fadeInUp}
              className="surface-muted p-4 rounded-xl"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-info" />
                  <span className="font-bold">Preview dos Dados</span>
                </div>
                <span className="badge badge-info">{previewData.length} times encontrados</span>
              </div>

              <div className="max-h-64 overflow-y-auto">
                <table className="table table-xs table-zebra">
                  <thead>
                    <tr>
                      {Object.keys(previewData[0] as Record<string, unknown>)
                        .slice(0, 5)
                        .map((key) => (
                          <th key={key} className="text-xs">
                            {key}
                          </th>
                        ))}
                      <th className="text-xs">...</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        {Object.values(row as Record<string, unknown>)
                          .slice(0, 5)
                          .map((value, valIdx) => (
                            <td key={valIdx} className="text-xs">
                              {String(value).substring(0, 20)}
                            </td>
                          ))}
                        <td className="text-xs opacity-50">...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
                    Salvar Tabela
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

