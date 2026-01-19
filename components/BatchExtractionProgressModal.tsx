import React from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import ModalShell from './ui/ModalShell';
import { Championship } from '../types';
import { animations } from '../utils/animations';

export type ChampionshipStatus = 'pending' | 'processing' | 'success' | 'error';

export interface ChampionshipProgress {
  championship: Championship;
  status: ChampionshipStatus;
  error?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  championships: ChampionshipProgress[];
  currentIndex: number;
  total: number;
  onCancel?: () => void;
  isProcessing: boolean;
}

export default function BatchExtractionProgressModal({
  isOpen,
  onClose,
  championships,
  currentIndex,
  total,
  onCancel,
  isProcessing,
}: Props) {
  const successCount = championships.filter((c) => c.status === 'success').length;
  const errorCount = championships.filter((c) => c.status === 'error').length;
  const isComplete = !isProcessing && currentIndex >= total;

  const getStatusIcon = (status: ChampionshipStatus) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-error" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-base-content/30" />;
    }
  };

  const getStatusText = (status: ChampionshipStatus) => {
    switch (status) {
      case 'processing':
        return 'Processando...';
      case 'success':
        return 'Sucesso';
      case 'error':
        return 'Erro';
      default:
        return 'Pendente';
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={isProcessing ? undefined : onClose}
      closeOnOverlayClick={!isProcessing}
      closeOnEscape={!isProcessing}
      showCloseButton={!isProcessing}
      containerClassName="z-[300]"
      overlayClassName="bg-black/60 backdrop-blur-sm"
      panelClassName="max-w-2xl w-full"
    >
      <div className="surface surface-hover p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-black">Extrair Todas as Tabelas</h2>
          </div>
        </div>

        {/* Progress Summary */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">
              Processando {currentIndex} de {total} campeonatos...
            </span>
            {isComplete && (
              <span className="text-sm font-semibold text-success">
                {successCount} sucesso{successCount !== 1 ? 's' : ''}
                {errorCount > 0 && `, ${errorCount} erro${errorCount !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>
          <progress
            className="progress progress-primary w-full"
            value={currentIndex}
            max={total}
          />
        </div>

        {/* Championships List */}
        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar mb-6">
          {championships.map((item, index) => (
            <motion.div
              key={item.championship.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`p-4 rounded-lg border-2 ${
                item.status === 'processing'
                  ? 'border-primary bg-primary/10'
                  : item.status === 'success'
                    ? 'border-success bg-success/10'
                    : item.status === 'error'
                      ? 'border-error bg-error/10'
                      : 'border-base-300 bg-base-200/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getStatusIcon(item.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base">{item.championship.nome}</div>
                  <div className="text-xs opacity-70 mt-1 truncate" title={item.championship.fbrefUrl || ''}>
                    {item.championship.fbrefUrl}
                  </div>
                  <div className="text-xs font-semibold mt-1">
                    {getStatusText(item.status)}
                    {item.error && (
                      <span className="text-error ml-2 block mt-1">{item.error}</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          {isProcessing && onCancel && (
            <button onClick={onCancel} className="btn btn-ghost">
              Cancelar
            </button>
          )}
          {isComplete && (
            <button onClick={onClose} className="btn btn-primary">
              Fechar
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

