import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileJson, X } from 'lucide-react';
import type { Championship, ChampionshipTable } from '../types';
import { animations } from '../utils/animations';
import { detectTableFormatFromData } from '../utils/tableFormatDetector';
import { updateChampionshipTableFormat } from '../services/championshipService';
import { parseAndNormalizeLeagueStandingJson } from '../utils/leagueStandingJson';
import { isExcelFile, parseExcelToJson } from '../utils/excelParser';

interface Props {
  championship: Championship;
  existingTables: ChampionshipTable[];
  onClose: () => void;
  onSaveTable: (table: ChampionshipTable) => Promise<ChampionshipTable | null>;
  onReloadTables: () => Promise<void>;
}

export default function ChampionshipTableUpdateModal({
  championship,
  existingTables,
  onClose,
  onSaveTable,
  onReloadTables,
}: Props) {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const existingGeral = useMemo(
    () => existingTables.find((t) => t.table_type === 'geral') || null,
    [existingTables]
  );

  const handleFileUpload = async (file: File) => {
    const lower = file.name.toLowerCase();
    const isJson = lower.endsWith('.json') || file.type === 'application/json';

    if (isJson) {
      try {
        const content = await file.text();
        setJsonText(content);
        const parsed = JSON.parse(content);
        const result = parseAndNormalizeLeagueStandingJson(parsed);
        setError(result.ok ? null : result.error);
        if (result.ok) {
          void updateChampionshipTableFormat(championship.id, detectTableFormatFromData(result.rows));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao ler o arquivo.');
      }
      return;
    }

    if (isExcelFile(file)) {
      try {
        const rawRows = await parseExcelToJson(file);
        const result = parseAndNormalizeLeagueStandingJson(rawRows as unknown);
        setError(result.ok ? null : result.error);
        if (result.ok) {
          setJsonText(JSON.stringify(result.rows));
          void updateChampionshipTableFormat(championship.id, detectTableFormatFromData(result.rows));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao ler a planilha.');
      }
      return;
    }

    setError('Use arquivo .json, .xlsx, .xls ou .csv.');
  };

  const handleUpdate = async () => {
    const text = jsonText.trim();
    if (!text) {
      setError('Cole o JSON ou selecione um arquivo.');
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError('JSON inválido.');
      return;
    }

    const result = parseAndNormalizeLeagueStandingJson(parsed);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setIsSaving(true);
    setError(null);

    const detected = detectTableFormatFromData(result.rows);
    await updateChampionshipTableFormat(championship.id, detected);

    const now = new Date().toISOString();
    const id = existingGeral?.id || `${championship.id}_geral`;

    const tableToSave: ChampionshipTable = {
      id,
      championship_id: championship.id,
      table_type: 'geral',
      table_name: 'Classificação (JSON)',
      table_data: result.rows as unknown,
      created_at: existingGeral?.created_at || now,
      updated_at: now,
    };

    const saved = await onSaveTable(tableToSave);
    if (!saved) {
      setError('Não foi possível salvar a tabela. Tente novamente.');
      setIsSaving(false);
      return;
    }

    await onReloadTables();
    setIsSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-[500] flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
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
            <FileJson className="w-5 h-5 text-secondary" />
            <h2 className="text-xl font-bold">Atualizar classificação — {championship.nome}</h2>
          </div>
          <button type="button" onClick={onClose} className="btn btn-sm btn-ghost btn-circle">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-xs opacity-70">
            Substitui a tabela geral. Envie JSON ou Excel (1ª aba): <code>Squad</code> obrigatório;{' '}
            <code>MP</code>/<code>GF</code>/<code>GA</code> agregados ou colunas <code>Home …</code> /{' '}
            <code>Away …</code>. Colunas <code>Lookup_*</code> são normalizadas.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="custom-card p-4 space-y-3">
              <div className="font-bold">Arquivo JSON ou Excel</div>
              <input
                type="file"
                accept=".json,.xlsx,.xls,.xlsm,.csv,application/json"
                className="file-input file-input-bordered w-full file-input-primary"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
              />
            </div>

            <div className="custom-card p-4 space-y-3">
              <div className="font-bold">Ou cole o JSON</div>
              <textarea
                className="textarea textarea-bordered w-full min-h-[140px] font-mono text-xs"
                placeholder='[{"Rk":"1","Squad":"Barcelona","MP":"30",...}]'
                value={jsonText}
                onChange={(e) => {
                  const next = e.target.value;
                  setJsonText(next);
                  if (!next.trim()) {
                    setError(null);
                    return;
                  }
                  try {
                    const result = parseAndNormalizeLeagueStandingJson(JSON.parse(next));
                    setError(result.ok ? null : result.error);
                  } catch {
                    setError(null);
                  }
                }}
              />
            </div>
          </div>

          {error && <div className="text-error text-sm">{error}</div>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSaving}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary gap-2" onClick={() => void handleUpdate()} disabled={isSaving}>
              {isSaving ? <span className="loading loading-spinner loading-sm" /> : <Upload className="w-4 h-4" />}
              Atualizar
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
