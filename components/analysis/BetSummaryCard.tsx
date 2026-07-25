import React from 'react';
import {
  Calculator,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  Search,
} from 'lucide-react';
import { BetInfo, BankSettings, SavedAnalysis } from '../../types';
import { getCurrencySymbol } from '../../utils/currency';

interface BetSummaryCardProps {
  betInfo: BetInfo;
  bankSettings?: BankSettings;
  odd: number;
  probability: number;
  onToggleEditor: () => void;
  onUpdateBetStatus?: (status: 'won' | 'lost') => void;
  isUpdatingBetStatus?: boolean;
  onAnalyzeResult?: () => void;
  savedMatch?: SavedAnalysis;
}

const BetSummaryCard: React.FC<BetSummaryCardProps> = ({
  betInfo,
  bankSettings,
  odd,
  probability,
  onToggleEditor,
  onUpdateBetStatus,
  isUpdatingBetStatus = false,
  onAnalyzeResult,
  savedMatch,
}) => {
  return (
    <div className="surface surface-hover p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <Calculator className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight">Gerenciar Aposta</h3>
        </div>
        <button
          onClick={onToggleEditor}
          className="btn btn-primary btn-md gap-2 hover:scale-105 transition-transform shadow-lg"
        >
          {betInfo && betInfo.betAmount > 0 ? 'Editar Aposta' : 'Registrar Aposta'}
        </button>
      </div>

      {betInfo && betInfo.betAmount > 0 ? (
        <div className="surface-muted p-5">
          {/* Status Badge Destacado */}
          <div className="mb-6 flex items-center justify-between p-4 rounded-xl border border-base-300/60 bg-base-300/20">
            <span className="text-sm font-bold opacity-70 uppercase tracking-wide">
              Status da Aposta
            </span>
            <div
              className={`badge gap-2 px-5 py-3 font-black text-sm uppercase tracking-wider border-2 shadow-lg ${
                betInfo.status === 'won'
                  ? 'bg-success/20 text-success border-success/40'
                  : betInfo.status === 'lost'
                    ? 'bg-error/20 text-error border-error/40'
                    : betInfo.status === 'pending'
                      ? 'bg-warning/20 text-warning border-warning/40'
                      : 'bg-base-300/20 text-base-content/60 border-base-300/40'
              }`}
            >
              {betInfo.status === 'won' && <CheckCircle className="w-5 h-5" />}
              {betInfo.status === 'lost' && <XCircle className="w-5 h-5" />}
              {betInfo.status === 'pending' && <Clock className="w-5 h-5" />}
              {betInfo.status === 'cancelled' && <Ban className="w-5 h-5" />}
              <span>
                {betInfo.status === 'won'
                  ? 'Ganhou'
                  : betInfo.status === 'lost'
                    ? 'Perdeu'
                    : betInfo.status === 'pending'
                      ? 'Pendente'
                      : 'Cancelada'}
              </span>
            </div>
          </div>

          {/* Botões Rápidos para Marcar Resultado (apenas se pendente) */}
          {betInfo.status === 'pending' && onUpdateBetStatus && (
            <div className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <span className="text-sm font-bold opacity-80 uppercase tracking-wide">
                  Marcar Resultado
                </span>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (betInfo.status === 'won') {
                        return;
                      }
                      onUpdateBetStatus('won');
                    }}
                    disabled={isUpdatingBetStatus || betInfo.status === 'won'}
                    className="btn btn-success btn-md gap-2 min-h-[44px] flex-1 sm:flex-none shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {isUpdatingBetStatus ? 'Processando...' : 'Ganhou'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (betInfo.status === 'lost') {
                        return;
                      }
                      onUpdateBetStatus('lost');
                    }}
                    disabled={isUpdatingBetStatus || betInfo.status === 'lost'}
                    className="btn btn-error btn-md gap-2 min-h-[44px] flex-1 sm:flex-none shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <XCircle className="w-5 h-5" />
                    {isUpdatingBetStatus ? 'Processando...' : 'Perdeu'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="surface-muted p-4 rounded-xl">
              <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">
                Valor Apostado
              </span>
              <p className="font-black text-xl font-mono">
                {getCurrencySymbol(bankSettings?.currency || 'BRL')}{' '}
                {betInfo.betAmount.toFixed(2)}
              </p>
            </div>
            {betInfo.status === 'pending' ? (
              <div className="surface-muted p-4 rounded-xl border border-primary/30">
                <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">
                  Retorno Potencial
                </span>
                <p className="font-black text-xl text-primary font-mono">
                  {getCurrencySymbol(bankSettings?.currency || 'BRL')}{' '}
                  {betInfo.potentialReturn.toFixed(2)}
                </p>
              </div>
            ) : betInfo.status === 'won' ? (
              <div className="bg-success/10 p-4 rounded-xl border-2 border-success/30">
                <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">
                  Ganho Realizado
                </span>
                <p className="font-black text-xl text-success font-mono">
                  +{getCurrencySymbol(bankSettings?.currency || 'BRL')}{' '}
                  {betInfo.potentialProfit.toFixed(2)}
                </p>
              </div>
            ) : betInfo.status === 'lost' ? (
              <div className="bg-error/10 p-4 rounded-xl border-2 border-error/30">
                <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">
                  Perda
                </span>
                <p className="font-black text-xl text-error font-mono">
                  -{getCurrencySymbol(bankSettings?.currency || 'BRL')}{' '}
                  {betInfo.betAmount.toFixed(2)}
                </p>
              </div>
            ) : null}
            {betInfo.status === 'pending' && (
              <div
                className={`p-4 rounded-xl border-2 ${betInfo.potentialProfit >= 0 ? 'bg-success/10 border-success/30' : 'bg-error/10 border-error/30'}`}
              >
                <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">
                  Lucro Potencial
                </span>
                <p
                  className={`font-black text-xl font-mono ${betInfo.potentialProfit >= 0 ? 'text-success' : 'text-error'}`}
                >
                  {betInfo.potentialProfit >= 0 ? '+' : ''}
                  {getCurrencySymbol(bankSettings?.currency || 'BRL')}{' '}
                  {betInfo.potentialProfit.toFixed(2)}
                </p>
              </div>
            )}
            <div className="surface-muted p-4 rounded-xl">
              <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">
                % da Banca
              </span>
              <p className="font-black text-xl font-mono">
                {betInfo.bankPercentage.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Botão Analisar Resultado para partidas finalizadas */}
          {(betInfo.status === 'won' || betInfo.status === 'lost') && onAnalyzeResult && savedMatch && (
            <div className="mt-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAnalyzeResult();
                }}
                className="btn btn-primary btn-md gap-2 w-full shadow-lg"
              >
                <Search className="w-5 h-5" />
                Analisar Resultado
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="surface-muted p-5 text-center">
          <p className="text-sm opacity-70 leading-relaxed">
            Clique em "Registrar Aposta" para adicionar informações sobre sua aposta nesta
            partida.
          </p>
        </div>
      )}
    </div>
  );
};

export default BetSummaryCard;
