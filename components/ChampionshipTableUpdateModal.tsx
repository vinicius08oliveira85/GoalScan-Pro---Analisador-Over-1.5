import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileJson, X, Save, ExternalLink, Download } from 'lucide-react';
import type { Championship, ChampionshipTable, TableType } from '../types';
import { animations } from '../utils/animations';
import { downloadChampionshipTables } from '../services/championshipService';
import FbrefExtractionModal from './FbrefExtractionModal';

type TableMeta = { type: TableType; name: string };

const TABLES: TableMeta[] = [
  { type: 'geral', name: 'Geral' },
  { type: 'home_away', name: 'Home/Away - Desempenho Casa vs Fora' },
  { type: 'standard_for', name: 'Standard (For) - Complemento' },
];

interface Props {
  championship: Championship;
  existingTables: ChampionshipTable[];
  onClose: () => void;
  onSaveTable: (table: ChampionshipTable) => Promise<ChampionshipTable | null>;
  onReloadTables: () => Promise<void>;
}

function safeJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function validateTableJson(json: unknown): string | null {
  if (!Array.isArray(json)) return 'O JSON deve ser um array de objetos.';
  if (json.length === 0) return 'O JSON está vazio.';
  const first = json[0] as Record<string, unknown>;
  if (!first || typeof first !== 'object') return 'O JSON deve conter objetos.';
  if (!('Squad' in first)) return 'O JSON deve conter o campo "Squad".';
  return null;
}

export default function ChampionshipTableUpdateModal({
  championship,
  existingTables,
  onClose,
  onSaveTable,
  onReloadTables,
}: Props) {
  const [activeType, setActiveType] = useState<TableType>('geral');
  const [jsonTextByType, setJsonTextByType] = useState<Record<TableType, string>>({
    geral: '',
    home_away: '',
    standard_for: '',
  });
  const [errorByType, setErrorByType] = useState<Record<TableType, string | null>>({
    geral: null,
    home_away: null,
    standard_for: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showFbrefModal, setShowFbrefModal] = useState(false);

  const existingByType = useMemo(() => {
    const map = new Map<TableType, ChampionshipTable>();
    for (const t of existingTables) {
      map.set(t.table_type, t);
    }
    return map;
  }, [existingTables]);

  const activeExisting = existingByType.get(activeType) || null;

  const handleFileUpload = (type: TableType, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';
      setJsonTextByType((prev) => ({ ...prev, [type]: content }));

      const parsed = safeJsonParse(content);
      const err = validateTableJson(parsed);
      setErrorByType((prev) => ({ ...prev, [type]: err }));
    };
    reader.readAsText(file);
  };

  const handleUpdate = async () => {
    const text = jsonTextByType[activeType].trim();
    if (!text) {
      setErrorByType((prev) => ({ ...prev, [activeType]: 'Cole o JSON ou selecione um arquivo.' }));
      return;
    }

    const parsed = safeJsonParse(text);
    const err = validateTableJson(parsed);
    if (err) {
      setErrorByType((prev) => ({ ...prev, [activeType]: err }));
      return;
    }

    setIsSaving(true);
    setErrorByType((prev) => ({ ...prev, [activeType]: null }));

    const now = new Date().toISOString();
    const meta = TABLES.find((t) => t.type === activeType);
    const id = activeExisting?.id || `${championship.id}_${activeType}`;

    const tableToSave: ChampionshipTable = {
      id,
      championship_id: championship.id,
      table_type: activeType,
      table_name: meta?.name || activeType,
      table_data: parsed as unknown,
      created_at: activeExisting?.created_at || now,
      updated_at: now,
    };

    const saved = await onSaveTable(tableToSave);
    if (!saved) {
      setErrorByType((prev) => ({
        ...prev,
        [activeType]: 'Não foi possível salvar a tabela. Tente novamente.',
      }));
      setIsSaving(false);
      return;
    }

    await onReloadTables();
    setIsSaving(false);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await downloadChampionshipTables(championship.id, championship.nome);
    } catch (error) {
      console.error('[ChampionshipTableUpdateModal] Erro ao exportar tabelas:', error);
      setErrorByType((prev) => ({ ...prev, [activeType]: 'Erro ao exportar tabelas. Tente novamente.' }));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        // Fechar apenas quando clicar no backdrop (evita fechar ao interagir com modais internos)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-base-100 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        variants={animations.fadeInUp}
      >
        <div className="sticky top-0 bg-base-100 border-b border-base-300 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Atualizar Tabelas — {championship.nome}</h2>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-ghost btn-circle">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Tabs */}
          <div role="tablist" className="tabs tabs-bordered">
            {TABLES.map((t) => (
              <button
                key={t.type}
                role="tab"
                className={`tab ${activeType === t.type ? 'tab-active' : ''}`}
                onClick={() => setActiveType(t.type)}
              >
                {t.name}
              </button>
            ))}
          </div>

          {/* Contexto */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="opacity-70">
              Modo: <span className="font-black">Overwrite</span> (substitui totalmente o conteúdo da tabela)
            </div>
            <div className="opacity-70">
              Status:{' '}
              <span className="font-black">
                {activeExisting ? 'Existe no campeonato' : 'Ainda não cadastrada'}
              </span>
            </div>
          </div>

          {/* Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="custom-card p-4 space-y-3">
              <div className="font-bold">Upload do arquivo JSON</div>
              <input
                type="file"
                accept="application/json,.json"
                className="file-input file-input-bordered w-full"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(activeType, file);
                }}
              />
              <div className="text-xs opacity-70">
                Requisito: JSON deve ser um array e conter o campo <code>Squad</code>.
              </div>
            </div>

            <div className="custom-card p-4 space-y-3">
              <div className="font-bold">Ou cole o JSON</div>
              <textarea
                className="textarea textarea-bordered w-full min-h-[140px] font-mono text-xs"
                placeholder='[{"Squad":"Bayern Munich", ...}]'
                value={jsonTextByType[activeType]}
                onChange={(e) => {
                  const next = e.target.value;
                  setJsonTextByType((prev) => ({ ...prev, [activeType]: next }));
                  const parsed = safeJsonParse(next);
                  const err = validateTableJson(parsed);
                  // só mostra erro se houver conteúdo suficiente
                  setErrorByType((prev) => ({ ...prev, [activeType]: next.trim() ? err : null }));
                }}
              />
              {errorByType[activeType] && (
                <div className="text-error text-sm">{errorByType[activeType]}</div>
              )}
            </div>
          </div>

          {/* Extração automática do FBref */}
          <div className="surface surface-hover p-5 space-y-4 border-2 border-primary/40 rounded-2xl bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="font-bold flex items-center gap-2 text-primary">
                <ExternalLink className="w-6 h-6" />
                <span className="text-lg">Extração Automática do FBref.com</span>
              </div>
            </div>
            <p className="text-sm opacity-80 leading-relaxed">
              Extraia automaticamente dados de tabelas do fbref.com sem precisar copiar/colar JSON manualmente.
            </p>
            <button
              onClick={() => setShowFbrefModal(true)}
              className="btn btn-primary btn-lg w-full gap-2 font-bold shadow-lg hover:shadow-xl transition-all"
            >
              <ExternalLink className="w-5 h-5" />
              Extrair do FBref.com
            </button>
          </div>

          {/* Exportação de tabelas */}
          <div className="surface surface-hover p-5 space-y-4 border-2 border-secondary/40 rounded-2xl bg-secondary/5">
            <div className="flex items-center justify-between">
              <div className="font-bold flex items-center gap-2 text-secondary">
                <Download className="w-6 h-6" />
                <span className="text-lg">Exportar Tabelas</span>
              </div>
            </div>
            <p className="text-sm opacity-80 leading-relaxed">
              Exporte apenas as 3 tabelas especificadas (Geral, Home/Away, Standard For) como arquivos JSON.
            </p>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="btn btn-secondary btn-lg w-full gap-2 font-bold shadow-lg hover:shadow-xl transition-all"
            >
              {isExporting ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              {isExporting ? 'Exportando...' : 'Exportar Tabelas'}
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button className="btn btn-ghost" onClick={onClose} disabled={isSaving}>
              Cancelar
            </button>
            <button className="btn btn-primary gap-2" onClick={handleUpdate} disabled={isSaving}>
              {isSaving ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Atualizar
            </button>
          </div>

          <div className="text-xs opacity-60">
            Dica: após atualizar, volte na aba <span className="font-semibold">Partida</span> e clique em{' '}
            <span className="font-semibold">Sincronizar</span> para puxar os novos dados.
          </div>
        </div>
      </motion.div>

      {/* Modal de extração do FBref */}
      {showFbrefModal && (
        <FbrefExtractionModal
          championship={championship}
          onClose={() => {
            setShowFbrefModal(false);
            onReloadTables();
          }}
          onTableSaved={() => {
            setShowFbrefModal(false);
            onReloadTables();
          }}
          onError={(message) => {
            setErrorByType((prev) => ({ ...prev, [activeType]: message }));
          }}
        />
      )}
    </motion.div>
  );
}


