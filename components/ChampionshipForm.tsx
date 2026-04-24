import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Championship, ChampionshipTable, TableRowGeral, TableFormat } from '../types';
import { Upload, X, Check, FileJson, Sparkles, Zap } from 'lucide-react';
import { animations } from '../utils/animations';
import ChampionshipTableView from './ChampionshipTableView';
import { detectTableFormatFromData } from '../utils/tableFormatDetector';
import { parseAndNormalizeLeagueStandingJson } from '../utils/leagueStandingJson';
import { isExcelFile, parseExcelToJson } from '../utils/excelParser';
import { cn } from '../utils/cn';

interface ChampionshipFormProps {
  championship?: Championship | null;
  onSave: (championship: Championship, tables: ChampionshipTable[]) => Promise<void>;
  onCancel: () => void;
}

const GERAL_TABLE_TYPE = 'geral' as const;

const ChampionshipForm: React.FC<ChampionshipFormProps> = ({
  championship,
  onSave,
  onCancel,
}) => {
  const [nome, setNome] = useState('');
  const [tableFormat, setTableFormat] = useState<TableFormat>('basica');
  const [geralTable, setGeralTable] = useState<ChampionshipTable | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (championship) {
      setNome(championship.nome);
      setTableFormat(championship.table_format || 'basica');
    } else {
      setNome('');
      setTableFormat('basica');
      setGeralTable(null);
    }
  }, [championship]);

  const applyNormalizedRows = (rows: TableRowGeral[]) => {
    const detected = detectTableFormatFromData(rows);
    setTableFormat(detected);

    const table: ChampionshipTable = {
      id: `${championship?.id || 'new'}_${GERAL_TABLE_TYPE}_${Date.now()}`,
      championship_id: championship?.id || '',
      table_type: GERAL_TABLE_TYPE,
      table_name: 'Classificação (JSON)',
      table_data: rows,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setGeralTable(table);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.geral;
      return next;
    });
  };

  const handleJsonContent = (raw: string, source: string) => {
    void source;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setErrors((prev) => ({ ...prev, geral: 'JSON inválido. Verifique vírgulas e aspas.' }));
      return;
    }
    const result = parseAndNormalizeLeagueStandingJson(parsed);
    if (!result.ok) {
      setErrors((prev) => ({ ...prev, geral: result.error }));
      return;
    }
    applyNormalizedRows(result.rows);
  };

  const handleFileUpload = async (file: File) => {
    const lower = file.name.toLowerCase();
    const isJson = lower.endsWith('.json') || file.type === 'application/json';

    if (isJson) {
      try {
        const content = await file.text();
        handleJsonContent(content, file.name);
      } catch (error) {
        setErrors((prev) => ({
          ...prev,
          geral: error instanceof Error ? error.message : 'Erro ao ler o arquivo.',
        }));
      }
      return;
    }

    if (isExcelFile(file)) {
      try {
        const rawRows = await parseExcelToJson(file);
        const result = parseAndNormalizeLeagueStandingJson(rawRows as unknown);
        if (!result.ok) {
          setErrors((prev) => ({ ...prev, geral: result.error }));
          return;
        }
        applyNormalizedRows(result.rows);
      } catch (error) {
        setErrors((prev) => ({
          ...prev,
          geral: error instanceof Error ? error.message : 'Erro ao ler a planilha.',
        }));
      }
      return;
    }

    setErrors((prev) => ({
      ...prev,
      geral: 'Use arquivo .json, .xlsx, .xls ou .csv com a classificação da liga.',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!nome.trim()) {
      newErrors.nome = 'O nome do campeonato é obrigatório.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.submit;
      return next;
    });
    try {
      const finalFormat =
        geralTable && Array.isArray(geralTable.table_data) && geralTable.table_data.length > 0
          ? detectTableFormatFromData(geralTable.table_data as TableRowGeral[])
          : tableFormat;

      const championshipToSave: Championship = {
        id: championship?.id || Math.random().toString(36).slice(2, 11),
        nome: nome.trim(),
        fbrefUrl: null,
        table_format: finalFormat,
        updated_at: new Date().toISOString(),
      };

      const tablesToSave: ChampionshipTable[] = [];
      if (geralTable) {
        tablesToSave.push({
          ...geralTable,
          championship_id: championshipToSave.id,
          id:
            geralTable.championship_id !== championshipToSave.id
              ? `${championshipToSave.id}_${GERAL_TABLE_TYPE}_${Date.now()}`
              : geralTable.id,
        });
      }

      await onSave(championshipToSave, tablesToSave);
    } catch (error) {
      console.error('Erro ao salvar campeonato:', error);
      const msg =
        error instanceof Error ? error.message : 'Erro ao salvar. Tente novamente.';
      setErrors((prev) => ({ ...prev, submit: msg }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="relative flex flex-col gap-6"
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
    >
      <AnimatePresence>
        {isSaving && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="overflow-hidden rounded-xl"
            aria-busy="true"
            aria-label="Sincronizando"
          >
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-base-300/50">
              <motion.div
                className="absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-primary via-secondary to-accent"
                initial={{ x: '-120%' }}
                animate={{ x: '320%' }}
                transition={{ duration: 1.15, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            <p className="mt-1 text-center text-[10px] font-bold uppercase tracking-widest text-base-content/50">
              Sincronizando…
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <h2 className="text-xl font-black tracking-tight sm:text-2xl">
        {championship ? 'Editar Campeonato' : 'Novo Campeonato'}
      </h2>

      <div className="form-control">
        <label className="label pb-1 pt-0" htmlFor="championship-nome">
          <span className="label-text font-bold text-base-content/90">Nome do Campeonato</span>
        </label>
        <input
          id="championship-nome"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="input input-bordered w-full rounded-2xl border-white/15 bg-base-200/50 backdrop-blur-sm transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Ex.: La Liga"
          required
        />
        {errors.nome && <span className="mt-1 text-sm text-error">{errors.nome}</span>}
      </div>

      <div className="rounded-2xl border border-info/20 bg-info/10 p-3 text-xs leading-relaxed text-base-content/80 backdrop-blur-sm sm:p-4 sm:text-sm">
        Importe <strong>uma única tabela</strong> em JSON ou Excel (primeira aba): <code className="rounded bg-base-200/60 px-1">Squad</code>{' '}
        obrigatório; totais <code className="rounded bg-base-200/60 px-1">MP</code> / <code className="rounded bg-base-200/60 px-1">GF</code> /{' '}
        <code className="rounded bg-base-200/60 px-1">GA</code> <em>ou</em> colunas <code className="rounded bg-base-200/60 px-1">Home …</code> e{' '}
        <code className="rounded bg-base-200/60 px-1">Away …</code>. Colunas <code className="rounded bg-base-200/60 px-1">Lookup_*</code> viram
        colunas normais. Prefixos &quot;Club Crest&quot; nos nomes são removidos.
      </div>

      <div
        className={cn(
          'rounded-3xl border border-white/10 p-4 shadow-inner shadow-primary/5 ring-1 ring-white/5',
          'bg-gradient-to-br from-primary/20 via-base-100/40 to-secondary/20 backdrop-blur-xl dark:via-base-200/30'
        )}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-base-100/50 text-primary shadow-md dark:bg-base-100/30">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <Zap className="h-4 w-4 text-secondary opacity-90" aria-hidden />
          <h3 className="text-base font-black tracking-tight text-base-content sm:text-lg">Extração automática</h3>
        </div>
        <p className="mb-4 text-xs text-base-content/65 sm:text-sm">
          Envie o arquivo da liga ou cole o JSON — a normalização roda localmente antes do envio ao servidor.
        </p>

        <div className="rounded-2xl border border-white/10 bg-base-100/35 p-3 backdrop-blur-md dark:bg-base-100/20 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black sm:text-base">Classificação (JSON ou Excel)</span>
              {geralTable && (
                <span className="badge badge-success gap-1 font-bold">
                  <Check className="h-3 w-3" />
                  Carregada
                </span>
              )}
            </div>
            {geralTable && (
              <button type="button" onClick={() => setGeralTable(null)} className="btn btn-sm btn-ghost btn-circle" aria-label="Remover tabela">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {!geralTable ? (
            <div className="space-y-4">
              <div className="form-control">
                <label className="label pb-1 pt-0">
                  <span className="label-text flex items-center gap-2 font-bold text-base-content/90">
                    Arquivo JSON ou Excel
                    <FileJson className="h-4 w-4 text-secondary" aria-hidden />
                  </span>
                </label>
                <input
                  type="file"
                  accept=".json,.xlsx,.xls,.xlsm,.csv,application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileUpload(file);
                  }}
                  className="file-input file-input-bordered file-input-primary w-full rounded-2xl border-white/15 bg-base-200/50 backdrop-blur-sm"
                />
              </div>

              <div className="divider my-1 text-xs font-bold opacity-50">OU</div>

              <div className="form-control">
                <label className="label pb-1 pt-0">
                  <span className="label-text font-bold text-base-content/90">Colar JSON</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-36 rounded-2xl border-white/15 bg-base-200/50 font-mono text-xs backdrop-blur-sm transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/50 sm:h-40 sm:text-sm"
                  placeholder='[{"Rk":"1","Squad":"Barcelona","Home MP":"15","Home GF":"47",...}]'
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v) handleJsonContent(v, 'paste');
                  }}
                />
              </div>

              {errors.geral && <span className="text-sm text-error">{errors.geral}</span>}
            </div>
          ) : (
            <ChampionshipTableView table={geralTable} />
          )}
        </div>
      </div>

      {errors.submit && (
        <div className="alert alert-error rounded-2xl text-sm whitespace-pre-wrap">{errors.submit}</div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <motion.button
          type="button"
          onClick={onCancel}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn btn-ghost rounded-xl"
          disabled={isSaving}
        >
          Cancelar
        </motion.button>
        <motion.button
          type="submit"
          whileHover={!isSaving ? { scale: 1.03 } : undefined}
          whileTap={!isSaving ? { scale: 0.98 } : undefined}
          className="btn btn-primary rounded-xl font-black shadow-lg shadow-primary/25 hover:shadow-xl"
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <span className="loading loading-spinner loading-sm" />
              Salvando…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Salvar
            </>
          )}
        </motion.button>
      </div>
    </motion.form>
  );
};

export default ChampionshipForm;
