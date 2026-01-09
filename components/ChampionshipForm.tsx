import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Championship, ChampionshipTable, TableType, TableRowGeral } from '../types';
import { Upload, X, Check, FileJson } from 'lucide-react';
import { animations } from '../utils/animations';
import ChampionshipTableView from './ChampionshipTableView';

interface ChampionshipFormProps {
  championship?: Championship | null;
  onSave: (championship: Championship, tables: ChampionshipTable[]) => Promise<void>;
  onCancel: () => void;
}

const TABLE_TYPES: Array<{ type: TableType; name: string; required: boolean }> = [
  { type: 'geral', name: 'Geral', required: true },
  { type: 'casa_fora', name: 'Casa/Fora', required: false },
  { type: 'estatisticas_elenco', name: 'Estatísticas padrão do elenco', required: false },
  { type: 'chutes_equipe', name: 'Chutes em equipe', required: false },
  { type: 'criacao_gols_chutes', name: 'Criação de gols e chutes em equipe', required: false },
];

const ChampionshipForm: React.FC<ChampionshipFormProps> = ({
  championship,
  onSave,
  onCancel,
}) => {
  const [nome, setNome] = useState('');
  const [tables, setTables] = useState<Map<TableType, ChampionshipTable>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (championship) {
      setNome(championship.nome);
    } else {
      setNome('');
      setTables(new Map());
    }
  }, [championship]);

  const handleFileUpload = (tableType: TableType, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const jsonData = JSON.parse(content);

        if (!Array.isArray(jsonData)) {
          setErrors((prev) => ({
            ...prev,
            [tableType]: 'O JSON deve ser um array de objetos.',
          }));
          return;
        }

        // Validar estrutura básica para tabela geral
        if (tableType === 'geral' && jsonData.length > 0) {
          const firstRow = jsonData[0] as Partial<TableRowGeral>;
          if (!firstRow.Squad) {
            setErrors((prev) => ({
              ...prev,
              [tableType]: 'O JSON deve conter objetos com o campo "Squad".',
            }));
            return;
          }
        }

        const table: ChampionshipTable = {
          id: `${championship?.id || 'new'}_${tableType}_${Date.now()}`,
          championship_id: championship?.id || '',
          table_type: tableType,
          table_name: TABLE_TYPES.find((t) => t.type === tableType)?.name || tableType,
          table_data: jsonData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setTables((prev) => {
          const newMap = new Map(prev);
          newMap.set(tableType, table);
          return newMap;
        });

        setErrors((prev => {
          const newErrors = { ...prev };
          delete newErrors[tableType];
          return newErrors;
        }));
      } catch (error) {
        setErrors((prev) => ({
          ...prev,
          [tableType]: 'Erro ao processar JSON. Verifique se o arquivo é válido.',
        }));
      }
    };
    reader.readAsText(file);
  };

  const handleJsonPaste = (tableType: TableType, jsonText: string) => {
    try {
      const jsonData = JSON.parse(jsonText);

      if (!Array.isArray(jsonData)) {
        setErrors((prev) => ({
          ...prev,
          [tableType]: 'O JSON deve ser um array de objetos.',
        }));
        return;
      }

      // Validar estrutura básica para tabela geral
      if (tableType === 'geral' && jsonData.length > 0) {
        const firstRow = jsonData[0] as Partial<TableRowGeral>;
        if (!firstRow.Squad) {
          setErrors((prev) => ({
            ...prev,
            [tableType]: 'O JSON deve conter objetos com o campo "Squad".',
          }));
          return;
        }
      }

      const table: ChampionshipTable = {
        id: `${championship?.id || 'new'}_${tableType}_${Date.now()}`,
        championship_id: championship?.id || '',
        table_type: tableType,
        table_name: TABLE_TYPES.find((t) => t.type === tableType)?.name || tableType,
        table_data: jsonData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setTables((prev) => {
        const newMap = new Map(prev);
        newMap.set(tableType, table);
        return newMap;
      });

      setErrors((prev => {
        const newErrors = { ...prev };
        delete newErrors[tableType];
        return newErrors;
      }));
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        [tableType]: 'Erro ao processar JSON. Verifique se o texto é válido.',
      }));
    }
  };

  const removeTable = (tableType: TableType) => {
    setTables((prev) => {
      const newMap = new Map(prev);
      newMap.delete(tableType);
      return newMap;
    });
    setErrors((prev => {
      const newErrors = { ...prev };
      delete newErrors[tableType];
      return newErrors;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    const newErrors: Record<string, string> = {};
    if (!nome.trim()) {
      newErrors.nome = 'O nome do campeonato é obrigatório.';
    }

    // Verificar se tabela geral está presente
    if (!tables.has('geral')) {
      newErrors.geral = 'A tabela "Geral" é obrigatória.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      const championshipToSave: Championship = {
        id: championship?.id || Math.random().toString(36).slice(2, 11),
        nome: nome.trim(),
        updated_at: new Date().toISOString(),
      };

      const tablesToSave = Array.from(tables.values()).map((table) => ({
        ...table,
        championship_id: championshipToSave.id,
      }));

      await onSave(championshipToSave, tablesToSave);
    } catch (error) {
      console.error('Erro ao salvar campeonato:', error);
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

      {/* Nome do Campeonato */}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-bold">Nome do Campeonato</span>
        </label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="input input-bordered w-full"
          placeholder="Ex: Serie A Itália"
          required
        />
        {errors.nome && <span className="text-error text-sm mt-1">{errors.nome}</span>}
      </div>

      {/* Upload de Tabelas */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold">Tabelas</h3>

        {TABLE_TYPES.map(({ type, name, required }) => {
          const table = tables.get(type);
          const hasError = errors[type];

          return (
            <div key={type} className="border border-base-300 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{name}</span>
                  {required && <span className="text-error">*</span>}
                  {table && (
                    <span className="badge badge-success gap-1">
                      <Check className="w-3 h-3" />
                      Carregada
                    </span>
                  )}
                </div>
                {table && (
                  <button
                    type="button"
                    onClick={() => removeTable(type)}
                    className="btn btn-sm btn-ghost"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {!table ? (
                <div className="space-y-3">
                  <div className="form-control">
                    <label className="label cursor-pointer">
                      <span className="label-text">Upload de arquivo JSON</span>
                    </label>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(type, file);
                        }
                      }}
                      className="file-input file-input-bordered w-full"
                    />
                  </div>

                  <div className="divider">OU</div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Colar JSON diretamente</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered h-32 font-mono text-sm"
                      placeholder='[{"Squad": "Inter", "MP": "18", ...}]'
                      onBlur={(e) => {
                        if (e.target.value.trim()) {
                          handleJsonPaste(type, e.target.value);
                        }
                      }}
                    />
                  </div>

                  {hasError && <span className="text-error text-sm">{hasError}</span>}
                </div>
              ) : (
                <div className="mt-3">
                  <ChampionshipTableView table={table} />
                </div>
              )}
            </div>
          );
        })}

        {errors.geral && (
          <span className="text-error text-sm block mt-2">{errors.geral}</span>
        )}
      </div>

      {/* Botões */}
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

