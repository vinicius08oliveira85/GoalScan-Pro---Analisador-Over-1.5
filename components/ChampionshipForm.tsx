import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Championship, ChampionshipTable, TableRowGeral, TableFormat } from '../types';
import { Upload, X, Check, FileJson } from 'lucide-react';
import { animations } from '../utils/animations';
import ChampionshipTableView from './ChampionshipTableView';
import { detectTableFormatFromData } from '../utils/tableFormatDetector';
import { parseAndNormalizeLeagueStandingJson } from '../utils/leagueStandingJson';

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
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setErrors((prev) => ({ ...prev, geral: 'Use apenas arquivo .json com a classificação da liga.' }));
      return;
    }
    try {
      const content = await file.text();
      handleJsonContent(content, file.name);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        geral: error instanceof Error ? error.message : 'Erro ao ler o arquivo.',
      }));
    }
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
      className="custom-card p-4 md:p-6 lg:p-8 flex flex-col gap-6"
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
    >
      <h2 className="text-2xl font-bold">
        {championship ? 'Editar Campeonato' : 'Novo Campeonato'}
      </h2>

      <div className="form-control">
        <label className="label">
          <span className="label-text font-bold">Nome do Campeonato</span>
        </label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="input input-bordered w-full"
          placeholder="Ex.: La Liga"
          required
        />
        {errors.nome && <span className="text-error text-sm mt-1">{errors.nome}</span>}
      </div>

      <div className="alert alert-info text-sm">
        <div>
          Importe a <strong>classificação agregada</strong> da temporada em JSON (array de objetos com{' '}
          <code className="text-xs">Squad</code>, <code className="text-xs">MP</code>,{' '}
          <code className="text-xs">GF</code>, <code className="text-xs">GA</code>, etc.). Prefixos como
          &quot;Club Crest&quot; nos nomes são removidos automaticamente.
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold">Classificação (JSON)</h3>
        <div className="border border-base-300 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-bold">Tabela da liga</span>
              {geralTable && (
                <span className="badge badge-success gap-1">
                  <Check className="w-3 h-3" />
                  Carregada
                </span>
              )}
            </div>
            {geralTable && (
              <button
                type="button"
                onClick={() => setGeralTable(null)}
                className="btn btn-sm btn-ghost"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {!geralTable ? (
            <div className="space-y-3">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold flex items-center gap-2">
                    Arquivo JSON
                    <FileJson className="w-4 h-4 text-secondary" />
                  </span>
                </label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="file-input file-input-bordered w-full file-input-primary"
                />
              </div>

              <div className="divider">OU</div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold">Colar JSON</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-40 font-mono text-sm"
                  placeholder='[{"Rk":"1","Squad":"Barcelona","MP":"30","GF":"80","GA":"29",...}]'
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v) handleJsonContent(v, 'paste');
                  }}
                />
              </div>

              {errors.geral && <span className="text-error text-sm">{errors.geral}</span>}
            </div>
          ) : (
            <ChampionshipTableView table={geralTable} />
          )}
        </div>
      </div>

      {errors.submit && (
        <div className="alert alert-error text-sm whitespace-pre-wrap">{errors.submit}</div>
      )}

      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </motion.form>
  );
};

export default ChampionshipForm;
