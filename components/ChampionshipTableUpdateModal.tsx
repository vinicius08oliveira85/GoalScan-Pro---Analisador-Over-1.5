import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileJson, X, Sparkles, Zap } from 'lucide-react';
import type { Championship, ChampionshipTable } from '../types';
import { modalVariants } from '../utils/animations';
import { detectTableFormatFromData } from '../utils/tableFormatDetector';
import { updateChampionshipTableFormat } from '../services/championshipService';
import { parseAndNormalizeLeagueStandingJson } from '../utils/leagueStandingJson';
import { isExcelFile, parseExcelToJson } from '../utils/excelParser';
import TableStatus, { getChampionshipDataFreshnessMs } from './ui/TableStatus';

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
      className="fixed inset-0 z-[500] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 12 }}
        transition={modalVariants.transition}
        className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden overflow-y-auto rounded-3xl border border-base-300/50 bg-base-100/50 shadow-2xl shadow-primary/10 ring-1 ring-base-300/30 backdrop-blur-xl dark:bg-base-100/40"
        onClick={(e) => e.stopPropagation()}
      >
        {isSaving && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1 overflow-hidden bg-base-200/60"
            role="status"
            aria-live="polite"
          >
            <motion.div
              className="h-full w-1/3 bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%]"
              animate={{ x: ['-100%', '400%'] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}

        <div className="sticky top-0 z-10 border-b border-base-300/50 bg-base-100/60 px-4 py-3 backdrop-blur-md sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-secondary/20 ring-1 ring-base-300/40">
                <FileJson className="h-5 w-5 text-secondary" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-black tracking-tight sm:text-lg">
                  Atualizar classificação
                </h2>
                <p className="truncate text-xs opacity-60">{championship.nome}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-base-content/45">
                  Dados atuais no servidor
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <TableStatus updatedAt={currentDataFreshnessMs ?? undefined} className="shadow-inner" />
                  {!currentDataFreshnessMs && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-base-content/50">
                      Sem referência de data
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm btn-circle btn-ghost shrink-0 hover:bg-base-200/80"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="rounded-2xl border border-base-300/50 bg-gradient-to-br from-primary/20 via-base-100/40 to-secondary/20 p-4 ring-1 ring-base-300/30">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              <span className="text-sm font-black tracking-tight">Atualização de dados</span>
              <Zap className="h-4 w-4 text-secondary opacity-90" aria-hidden />
            </div>
            <p className="text-xs leading-relaxed opacity-75">
              Substitui a tabela geral. Envie JSON ou Excel (1ª aba): <code className="rounded bg-base-200/60 px-1">Squad</code>{' '}
              obrigatório; <code className="rounded bg-base-200/60 px-1">MP</code> / <code className="rounded bg-base-200/60 px-1">GF</code> /{' '}
              <code className="rounded bg-base-200/60 px-1">GA</code> agregados ou colunas <code className="rounded bg-base-200/60 px-1">Home …</code> /{' '}
              <code className="rounded bg-base-200/60 px-1">Away …</code>. Colunas <code className="rounded bg-base-200/60 px-1">Lookup_*</code> são
              normalizadas.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-base-300/50 bg-base-100/40 p-4 backdrop-blur-md">
              <div className="text-sm font-black">Arquivo JSON ou Excel</div>
              <input
                type="file"
                accept=".json,.xlsx,.xls,.xlsm,.csv,application/json"
                className="file-input file-input-bordered file-input-primary w-full rounded-2xl border-base-300/50 bg-base-200/50 backdrop-blur-sm file:rounded-xl"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
              />
            </div>

            <div className="space-y-3 rounded-2xl border border-base-300/50 bg-base-100/40 p-4 backdrop-blur-md">
              <div className="text-sm font-black">Ou cole o JSON</div>
              <textarea
                className="textarea textarea-bordered min-h-[140px] w-full rounded-2xl border-base-300/50 bg-base-200/50 font-mono text-xs backdrop-blur-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
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

          {error && (
            <div className="rounded-2xl border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{error}</div>
          )}

          {isSaving && (
            <div className="flex items-center gap-2 rounded-2xl border border-base-300/50 bg-base-200/40 px-3 py-2 text-xs text-base-content/70">
              <span
                className="loading loading-spinner loading-sm text-primary"
                aria-hidden
              />
              <span>Sincronizando com o servidor…</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-base-300/50 pt-4">
            <motion.button
              type="button"
              className="btn btn-ghost rounded-xl"
              onClick={onClose}
              disabled={isSaving}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              Cancelar
            </motion.button>
            <motion.button
              type="button"
              className="btn btn-primary gap-2 rounded-xl shadow-lg shadow-primary/25"
              onClick={() => void handleUpdate()}
              disabled={isSaving}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSaving ? <span className="loading loading-spinner loading-sm" /> : <Upload className="h-4 w-4" />}
              Atualizar
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
