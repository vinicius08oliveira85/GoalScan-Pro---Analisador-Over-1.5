import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Loader2, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react';
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

export default function AutoImportBrasileiraoModal({ isOpen, onClose, onSuccess, onError }: Props) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<{ championship: Championship; tables: ChampionshipTable[] } | null>(null);

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
      onSuccess?.(res.championship, res.tables);
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

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick={!importing}
      closeOnEscape={!importing}
      showCloseButton={!importing}
      title="Importar Brasileirão Série A 2026"
      panelClassName="max-w-lg"
    >
      <div className="p-6 space-y-5">
        {/* Info */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div className="text-sm">
            <p className="font-bold">Campeonato Brasileiro Série A 2026</p>
            <p className="opacity-70 mt-1">
              Importe automaticamente a tabela completa do Brasileirão 2026 do{' '}
              <a
                href="https://fbref.com/en/comps/24/2026/2026-Campeonato-Brasileiro-Serie-A-Stats"
                target="_blank"
                rel="noopener"
                className="link link-primary"
              >
                FBref
              </a>
              .
            </p>
          </div>
        </div>

        {/* Progress / Result */}
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
              <div className="min-w-0">
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
                {isConcluded && result && (
                  <div className="mt-2 text-xs opacity-75 space-y-1">
                    <p>{result.tables.length} tabela(s) importada(s)</p>
                    {result.championship.fbrefUrl && (
                      <a
                        href={result.championship.fbrefUrl}
                        target="_blank"
                        rel="noopener"
                        className="link link-primary inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver no FBref
                      </a>
                    )}
                  </div>
                )}
                {isError && !importing && (
                  <p className="text-xs opacity-70 mt-2">
                    Tente usar o botão <strong>FBref</strong> no card do campeonato e cole o HTML manualmente.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Actions */}
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
