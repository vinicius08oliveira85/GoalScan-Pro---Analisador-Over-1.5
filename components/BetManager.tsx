
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BetInfo, BankSettings } from '../types';
import { Calculator, TrendingUp, DollarSign, Percent, X, Lightbulb, Sparkles, AlertCircle } from 'lucide-react';
import { validateBetInfo } from '../utils/validation';
import { errorService } from '../services/errorService';
import { getCurrencySymbol } from '../utils/currency';
import { suggestBetAmount, calculateEV, MIN_BET_AMOUNT } from '../utils/betSuggestion';
import { animations } from '../utils/animations';

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
  const totalBank = bankSettings?.totalBank ?? 0;
  const hasBank = totalBank > 0;
  const isOverBank = hasBank && betAmount > totalBank + 1e-6;
  const rawBankPercentage = hasBank ? (betAmount / totalBank) * 100 : 0;
  // Normalizar para evitar erro por ponto flutuante (ex.: 100.0000000002)
  // e manter o contrato do schema (0–100) ao salvar.
  const bankPercentage = hasBank
    ? Math.max(0, Math.min(100, Number(rawBankPercentage.toFixed(6))))
    : 0;
  const roi = betAmount > 0 ? (potentialProfit / betAmount) * 100 : 0;
  
  // Calcular sugestões de valor de aposta
  const betSuggestion = bankSettings && bankSettings.totalBank > 0 && odd > 1 && probability > 0
    ? suggestBetAmount(probability, odd, bankSettings.totalBank)
    : null;
  const ev = calculateEV(probability, odd);

  useEffect(() => {
    if (betInfo) {
      setBetAmount(betInfo.betAmount);
      setStatus(betInfo.status);
    }
  }, [betInfo]);

  const handleSave = () => {
    try {
      if (isOverBank) {
        const currency = getCurrencySymbol(bankSettings?.currency || 'BRL');
        throw new Error(`Valor da aposta não pode ser maior que sua banca (${currency} ${totalBank.toFixed(2)})`);
      }

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
    <motion.div 
      className="custom-card p-6 bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20"
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
    >
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
        {/* Sugestão de Valor de Aposta */}
        {betSuggestion && betSuggestion.recommended > 0 && (
          <div className="custom-card p-4 bg-gradient-to-br from-accent/10 to-primary/10 border border-accent/20 animate-in">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-accent/20 text-accent">
                <Lightbulb className="w-4 h-4" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm">Sugestão de Valor</h4>
                  <span className="text-xs opacity-60">EV: {ev > 0 ? '+' : ''}{ev.toFixed(1)}%</span>
                </div>
                <p className="text-xs opacity-80">{betSuggestion.explanation}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setBetAmount(betSuggestion.recommended)}
                    className="btn btn-xs btn-primary"
                    title="Valor recomendado"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Recomendado: {getCurrencySymbol(bankSettings?.currency || 'BRL')} {betSuggestion.recommended.toFixed(2)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBetAmount(betSuggestion.conservative)}
                    className="btn btn-xs btn-outline"
                    title="1% da banca (conservador)"
                  >
                    Conservador: {getCurrencySymbol(bankSettings?.currency || 'BRL')} {betSuggestion.conservative.toFixed(2)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBetAmount(betSuggestion.moderate)}
                    className="btn btn-xs btn-outline"
                    title="2.5% da banca (moderado)"
                  >
                    Moderado: {getCurrencySymbol(bankSettings?.currency || 'BRL')} {betSuggestion.moderate.toFixed(2)}
                  </button>
                  {betSuggestion.kelly > 0 && betSuggestion.kelly !== betSuggestion.recommended && (
                    <button
                      type="button"
                      onClick={() => setBetAmount(betSuggestion.kelly)}
                      className="btn btn-xs btn-outline"
                      title="Kelly Criterion (otimizado)"
                    >
                      Kelly: {getCurrencySymbol(bankSettings?.currency || 'BRL')} {betSuggestion.kelly.toFixed(2)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Valor da Aposta */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-bold flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Valor da Aposta
            </span>
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min={MIN_BET_AMOUNT}
              max={hasBank ? totalBank : undefined}
              value={betAmount || ''}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              className={`input input-bordered w-full min-h-[44px] text-base ${
                isOverBank
                  ? 'border-error focus:ring-error'
                  : betSuggestion && betAmount > 0 && Math.abs(betAmount - betSuggestion.recommended) / betSuggestion.recommended < 0.1
                  ? 'border-success'
                  : ''
              }`}
              placeholder={`Ex: ${getCurrencySymbol(bankSettings?.currency || 'BRL')} 10.00`}
              aria-label="Valor da aposta"
              aria-invalid={isOverBank ? true : undefined}
            />
            {isOverBank && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-error">
                <AlertCircle className="w-5 h-5" />
              </div>
            )}
          </div>
          <label className="label">
            <span className="label-text-alt opacity-60">
              {isOverBank ? (
                <span className="text-error">
                  Valor acima da banca: {getCurrencySymbol(bankSettings?.currency || 'BRL')} {totalBank.toFixed(2)}
                </span>
              ) : bankSettings && bankSettings.totalBank > 0 ? (
                <>
                  {rawBankPercentage.toFixed(2)}% da sua banca ({getCurrencySymbol(bankSettings.currency)} {bankSettings.totalBank.toFixed(2)})
                  {betSuggestion && betSuggestion.recommended > 0 && (
                    <span className="ml-2">
                      • Sugestão: {getCurrencySymbol(bankSettings.currency)} {betSuggestion.recommended.toFixed(2)} ({(betSuggestion.recommended / bankSettings.totalBank * 100).toFixed(2)}%)
                    </span>
                  )}
                </>
              ) : (
                'Configure sua banca para receber sugestões automáticas.'
              )}
            </span>
          </label>
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
          {ev !== 0 && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-xs opacity-60">Expected Value (EV)</span>
                <span className={`font-bold text-sm ${ev > 0 ? 'text-success' : 'text-error'}`}>
                  {ev > 0 ? '+' : ''}{ev.toFixed(2)}%
                </span>
              </div>
              {ev <= 0 && (
                <p className="text-xs text-error mt-1">⚠️ EV negativo - aposta não recomendada</p>
              )}
            </div>
          )}
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
                <span className={`font-bold text-lg ${isOverBank ? 'text-error' : ''}`}>
                  {rawBankPercentage.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={betAmount < MIN_BET_AMOUNT || isOverBank}
            className="btn btn-primary flex-1 min-h-[44px] text-base disabled:btn-disabled"
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
    </motion.div>
  );
};

export default BetManager;

