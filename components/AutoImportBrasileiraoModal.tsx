import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Loader2, CheckCircle, XCircle, AlertCircle, Table2, Swords, TrendingUp } from 'lucide-react';
import ModalShell from './ui/ModalShell';
import { importBrasileirao2026, ImportProgress } from '../services/brasileirao2026Service';
import { Championship, ChampionshipTable } from '../types';
import { animations } from '../utils/animations';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (championship: Championship, tables: ChampionshipTable[]) => void;
  onError?: (message: string) => void;
}

type PreviewTab = 'geral' | 'jogos' | 'forma';

const TAB_CONFIG: { key: PreviewTab; label: string; icon: React.ReactNode }[] = [
  { key: 'geral', label: 'Classificação', icon: <Table2 className="w-4 h-4" /> },
  { key: 'jogos', label: 'Jogos', icon: <Swords className="w-4 h-4" /> },
  { key: 'forma', label: 'Forma', icon: <TrendingUp className="w-4 h-4" /> },
];

function PreviewTable({ rows, maxRows = 10 }: { rows: Record<string, unknown>[]; maxRows?: number }) {
  if (!rows.length) return <p className="text-sm opacity-60 text-center py-4">Nenhum dado disponível</p>;
  const cols = Object.keys(rows[0]).filter(k => k !== 'importExtras');
  const display = rows.slice(0, maxRows);
  return (
    <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-lg border border-base-300">
      <table className="table table-sm table-zebra w-full">
        <thead>
          <tr>
            {cols.map(col => (
              <th key={col} className="text-xs uppercase font-bold opacity-70 whitespace-nowrap">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {display.map((row, i) => (
            <tr key={i}>
              {cols.map(col => (
                <td key={col} className="text-xs whitespace-nowrap">{String(row[col] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <p className="text-xs text-center opacity-50 py-1">+{rows.length - maxRows} linhas</p>
      )}
    </div>
  );
}

export default function AutoImportBrasileiraoModal({ isOpen, onClose, onSuccess, onError }: Props) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<{ championship: Championship; tables: ChampionshipTable[] } | null>(null);
  const [activeTab, setActiveTab] = useState<PreviewTab>('geral');

  const handleImport = async () => {
    setImporting(true);
    setProgress({ step: 'criando', message: 'Iniciando importação...', progress: 5 });
    setResult(null);

    const res = await importBrasileirao2026((p) => {
      setProgress(p);
    });

    setImporting(false);

    if (res.championship && res.tables.length > 0) {
      setResult({ championship: res.championship, tables: res.tables });
    } else if (progress?.step === 'erro') {
      onError?.(progress.message);
    }
  };

  const handleViewTables = () => {
    if (result) {
      onSuccess?.(result.championship, result.tables);
    }
    onClose();
  };

  const isError = progress?.step === 'erro';
  const isConcluded = progress?.step === 'concluido';

  const previewData = (tab: PreviewTab): Record<string, unknown>[] => {
    if (!result) return [];
    const t = result.tables.find(t => t.table_type === tab);
    if (!t?.table_data) return [];
    const data = t.table_data;
    if (tab === 'forma' && typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const d = data as { last5?: unknown[]; last10?: unknown[] };
      if (activeTab === 'forma') {
        return (d.last5 || d.last10 || []) as Record<string, unknown>[];
      }
    }
    if (Array.isArray(data)) return data as Record<string, unknown>[];
    return [];
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick={!importing}
      closeOnEscape={!importing}
      showCloseButton={!importing}
      title="Importar Brasileirão Série A 2026"
      panelClassName="max-w-2xl"
    >
      <div className="p-6 space-y-5">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div className="text-sm">
            <p className="font-bold">Campeonato Brasileiro Série A 2026</p>
            <p className="opacity-70 mt-1">
              Dados extraídos do FootyStats.org:
              <span className="block mt-1 space-x-2">
                <span className="badge badge-sm badge-ghost">Classificação</span>
                <span className="badge badge-sm badge-ghost">Jogos</span>
                <span className="badge badge-sm badge-ghost">Forma</span>
              </span>
            </p>
          </div>
        </div>

        {progress && (
          <motion.div
            initial="initial"
            animate="animate"
            variants={animations.fadeInUp}
            className={`rounded-xl border p-4 ${
              isError
                ? 'border-l-error/60 border-base-300/40 bg-error/8'
                : isConcluded
                ? 'border-l-success/60 border-base-300/40 bg-success/8'
                : 'border-l-info/60 border-base-300/40 bg-info/8'
            }`}
          >
            <div className="flex items-start gap-3">
              {importing ? (
                <Loader2 className="w-5 h-5 text-info animate-spin mt-0.5 shrink-0" />
              ) : isError ? (
                <XCircle className="w-5 h-5 text-error mt-0.5 shrink-0" />
              ) : isConcluded ? (
                <CheckCircle className="w-5 h-5 text-success mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-info mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm">{progress.message}</p>
                {importing && (
                  <div className="mt-3 w-full bg-base-300 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress.progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {isConcluded && result && (
          <div className="space-y-3">
            <div className="tabs tabs-boxed gap-1">
              {TAB_CONFIG.map(tab => {
                const count = result.tables.find(t => t.table_type === tab.key)?.table_data;
                const itemCount = Array.isArray(count) ? count.length
                  : typeof count === 'object' && count ? Object.values(count as object).reduce((a, b) => a + (Array.isArray(b) ? b.length : 0), 0)
                  : 0;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`tab gap-1.5 text-xs ${activeTab === tab.key ? 'tab-active' : ''}`}
                  >
                    {tab.icon}
                    {tab.label}
                    {itemCount > 0 && <span className="badge badge-xs">{itemCount}</span>}
                  </button>
                );
              })}
            </div>

            <PreviewTable rows={previewData(activeTab)} maxRows={8} />

            <div className="text-xs opacity-60 text-center">
              {result.tables.length} tabela(s) importadas &middot; Fonte: FootyStats
            </div>
          </div>
        )}

        {isError && !importing && (
          <p className="text-xs text-center opacity-70">
            FootyStats pode estar bloqueado ou temporariamente indisponível. Tente novamente mais tarde.
          </p>
        )}

        <div className="flex gap-3">
          {!importing && !isConcluded && (
            <button onClick={handleImport} className="btn btn-primary flex-1 gap-2">
              <Trophy className="w-4 h-4" />
              Importar Automaticamente
            </button>
          )}
          {isConcluded && (
            <button onClick={handleViewTables} className="btn btn-primary flex-1 gap-2">
              <CheckCircle className="w-4 h-4" />
              Visualizar Tabelas
            </button>
          )}
          {(isError || isConcluded) && (
            <button onClick={onClose} className="btn btn-ghost flex-1">
              Fechar
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
