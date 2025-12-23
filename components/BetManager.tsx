
import React, { useState, useEffect } from 'react';
import { BetInfo, BankSettings } from '../types';
import { Calculator, TrendingUp, DollarSign, Percent, X } from 'lucide-react';
import { validateBetInfo } from '../utils/validation';
import { errorService } from '../services/errorService';
import { getCurrencySymbol } from '../utils/currency';

interface BetManagerProps {
  odd: number;
  probability: number;
  betInfo?: BetInfo;
  bankSettings?: BankSettings;
  onSave: (betInfo: BetInfo) => void;
  onCancel?: () => void;
  onError?: (message: string) => void;
}


const BetManager: React.FC<BetManagerProps> = ({ 
  odd, 
  probability, 
  betInfo, 
  bankSettings,
  onSave, 
  onCancel,
  onError
}) => {
  const [betAmount, setBetAmount] = useState<number>(betInfo?.betAmount || 0);
  const [status, setStatus] = useState<BetInfo['status']>(betInfo?.status || 'pending');

  // Calcular valores automaticamente
  const potentialReturn = betAmount > 0 && odd > 0 ? betAmount * odd : 0;
  const potentialProfit = potentialReturn - betAmount;
  const bankPercentage = bankSettings && bankSettings.totalBank > 0 
    ? (betAmount / bankSettings.totalBank) * 100 
    : 0;
  const roi = betAmount > 0 ? (potentialProfit / betAmount) * 100 : 0;

  useEffect(() => {
    if (betInfo) {
      setBetAmount(betInfo.betAmount);
      setStatus(betInfo.status);
    }
  }, [betInfo]);

  const handleSave = () => {
    try {
      const newBetInfo: BetInfo = {
        betAmount,
        odd,
        potentialReturn,
        potentialProfit,
        bankPercentage,
        status,
        placedAt: betInfo?.placedAt || Date.now(),
        resultAt: betInfo?.resultAt
      };

      // Validar dados antes de salvar
      const validatedBetInfo = validateBetInfo(newBetInfo);
      onSave(validatedBetInfo);
    } catch (error) {
      // Mostrar erro de validação de forma amigável
      const errorMessage = error instanceof Error ? error.message : 'Erro de validação desconhecido';
      // Registrar erro no serviço centralizado
      errorService.logValidationError('BetManager', { betAmount, odd }, errorMessage);
      
      if (onError) {
        onError(`Erro ao validar aposta: ${errorMessage}`);
      } else {
        alert(`Erro ao validar aposta: ${errorMessage}`);
      }
    }
  };

  const handleRemove = () => {
    if (window.confirm('Deseja remover esta aposta?')) {
      onSave({
        betAmount: 0,
        odd,
        potentialReturn: 0,
        potentialProfit: 0,
        bankPercentage: 0,
        status: 'cancelled'
      });
    }
  };

  return (
    <div className="custom-card p-6 bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-black uppercase">Gerenciar Aposta</h3>
        </div>
        {onCancel && (
          <button 
            onClick={onCancel}
            className="btn btn-sm btn-circle btn-ghost"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Valor da Aposta */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-bold flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Valor da Aposta
            </span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={betAmount || ''}
            onChange={(e) => setBetAmount(Number(e.target.value))}
            className="input input-bordered w-full min-h-[44px] text-base"
            placeholder="Ex: 100.00"
          />
          {bankSettings && bankSettings.totalBank > 0 && (
            <label className="label">
              <span className="label-text-alt opacity-60">
                {bankPercentage.toFixed(2)}% da sua banca ({getCurrencySymbol(bankSettings.currency)} {bankSettings.totalBank.toFixed(2)})
              </span>
            </label>
          )}
        </div>

        {/* Status da Aposta */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-bold">Status da Aposta</span>
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BetInfo['status'])}
            className="select select-bordered w-full min-h-[44px] text-base"
          >
            <option value="pending">Pendente</option>
            <option value="won">Ganhou</option>
            <option value="lost">Perdeu</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>

        {/* Informações da Odd */}
        <div className="bg-base-100/50 p-4 rounded-xl border border-white/5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs opacity-60">Odd</span>
              <p className="font-bold text-lg">{odd.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-xs opacity-60">Probabilidade</span>
              <p className="font-bold text-lg">{probability.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* Cálculos Automáticos */}
        {betAmount > 0 && (
          <div className="bg-base-100/50 p-4 rounded-xl border border-white/5 space-y-3">
            <h4 className="font-bold text-sm uppercase opacity-60 mb-3">Cálculos Automáticos</h4>
            
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-80">Retorno Potencial:</span>
              <span className="font-bold text-lg text-primary">
                {getCurrencySymbol(bankSettings?.currency || 'BRL')} {potentialReturn.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm opacity-80 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Lucro Potencial:
              </span>
              <span className={`font-bold text-lg ${potentialProfit >= 0 ? 'text-success' : 'text-error'}`}>
                {potentialProfit >= 0 ? '+' : ''}{getCurrencySymbol(bankSettings?.currency || 'BRL')} {potentialProfit.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm opacity-80 flex items-center gap-1">
                <Percent className="w-4 h-4" />
                ROI Esperado:
              </span>
              <span className={`font-bold text-lg ${roi >= 0 ? 'text-success' : 'text-error'}`}>
                {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
              </span>
            </div>

            {bankSettings && bankSettings.totalBank > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-sm opacity-80">% da Banca:</span>
                <span className="font-bold text-lg">{bankPercentage.toFixed(2)}%</span>
              </div>
            )}
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={handleSave}
            className="btn btn-primary flex-1 min-h-[44px] text-base"
          >
            {betInfo ? 'Atualizar Aposta' : 'Salvar Aposta'}
          </button>
          {betInfo && betInfo.betAmount > 0 && (
            <button
              onClick={handleRemove}
              className="btn btn-error btn-outline min-h-[44px] text-base"
            >
              Remover
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BetManager;

