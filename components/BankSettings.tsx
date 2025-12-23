
import React, { useState, useEffect } from 'react';
import type { BankSettings } from '../types';
import { Wallet, Save, DollarSign, TrendingUp, Check, Loader2, Euro, PoundSterling, AlertCircle } from 'lucide-react';
import { validateBankSettings } from '../utils/validation';
import { errorService } from '../services/errorService';
import { normalizeCurrency, getCurrencySymbol } from '../utils/currency';

type SaveStatus = 'idle' | 'loading' | 'success' | 'error';

interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
  icon: React.ReactNode;
}

const currencies: CurrencyOption[] = [
  { code: 'BRL', symbol: 'R$', label: 'Real Brasileiro', icon: <DollarSign className="w-5 h-5" /> },
  { code: 'USD', symbol: '$', label: 'Dólar Americano', icon: <DollarSign className="w-5 h-5" /> },
  { code: 'EUR', symbol: '€', label: 'Euro', icon: <Euro className="w-5 h-5" /> },
  { code: 'GBP', symbol: '£', label: 'Libra Esterlina', icon: <PoundSterling className="w-5 h-5" /> },
];

interface BankSettingsProps {
  bankSettings?: BankSettings;
  onSave: (settings: BankSettings) => void;
  onError?: (message: string) => void;
}

const BankSettings: React.FC<BankSettingsProps> = ({ bankSettings, onSave, onError }) => {
  const [totalBank, setTotalBank] = useState<number>(bankSettings?.totalBank || 0);
  // Normalizar currency para código ISO (compatibilidade com dados antigos)
  const [currency, setCurrency] = useState<string>(
    bankSettings?.currency ? normalizeCurrency(bankSettings.currency) : 'BRL'
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    if (bankSettings) {
      setTotalBank(bankSettings.totalBank);
      // Normalizar currency para código ISO (compatibilidade com dados antigos)
      setCurrency(normalizeCurrency(bankSettings.currency));
    }
  }, [bankSettings]);

  const handleSave = async () => {
    setSaveStatus('loading');
    
    try {
      // Garantir que currency seja um código ISO válido
      const normalizedCurrency = normalizeCurrency(currency);
      
      const newSettings: BankSettings = {
        totalBank,
        currency: normalizedCurrency,
        updatedAt: Date.now()
      };

      // Validar dados antes de salvar
      const validatedSettings = validateBankSettings(newSettings);
      
      // Simular pequeno delay para feedback visual
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onSave(validatedSettings);
      setSaveStatus('success');
      
      // Resetar status após 3 segundos
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      // Registrar erro no serviço centralizado
      const errorMessage = error instanceof Error ? error.message : 'Erro de validação desconhecido';
      errorService.logValidationError('BankSettings', { totalBank, currency }, errorMessage);
      
      setSaveStatus('error');
      
      // Mostrar erro de validação de forma amigável
      if (onError) {
        onError(`Erro ao validar configurações: ${errorMessage}`);
      } else {
        alert(`Erro ao validar configurações: ${errorMessage}`);
      }
      
      // Resetar status após 3 segundos
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const currentCurrency = currencies.find(c => c.code === currency);

  return (
    <div className="custom-card p-4 md:p-6 bg-gradient-to-br from-secondary/10 to-accent/10 border border-secondary/20">
      {/* Header Melhorado */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-secondary/20 text-secondary">
          <Wallet className="w-5 h-5 md:w-6 md:h-6" />
        </div>
        <div>
          <h3 className="text-lg md:text-xl font-black uppercase">Configurações de Banca</h3>
          <p className="text-xs md:text-sm opacity-60">Gerencie o capital da sua banca de apostas</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Card de Visualização da Banca Atual */}
        {(bankSettings && bankSettings.totalBank > 0) || totalBank > 0 ? (
          <div className="custom-card p-6 md:p-8 bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10 border border-primary/20 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-sm opacity-70">
                <TrendingUp className="w-4 h-4" />
                <span>Banca Atual</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl md:text-5xl font-bold tracking-tight tabular-nums">
                  {getCurrencySymbol(currency)} {totalBank.toFixed(2)}
                </span>
              </div>
              {bankSettings?.updatedAt && (
                <p className="text-xs opacity-50">
                  {currency} • Última atualização: {new Date(bankSettings.updatedAt).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>
        ) : null}

        {/* Valor da Banca - Input Melhorado */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-bold flex items-center gap-2 text-sm md:text-base">
              <DollarSign className="w-4 h-4" />
              Valor Total da Banca
            </span>
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/60 pointer-events-none text-lg font-medium">
              {currentCurrency?.symbol || 'R$'}
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={totalBank || ''}
              onChange={(e) => setTotalBank(Number(e.target.value))}
              className="input input-bordered w-full min-h-[56px] text-xl md:text-2xl font-semibold tabular-nums pl-12 transition-all focus:ring-2 focus:ring-primary"
              placeholder="0.00"
            />
          </div>
          <label className="label">
            <span className="label-text-alt opacity-60 text-xs">
              Digite o valor total disponível na sua banca
            </span>
          </label>
        </div>

        {/* Seletor Visual de Moedas */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-bold text-sm md:text-base">Moeda</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {currencies.map((curr) => (
              <button
                key={curr.code}
                type="button"
                onClick={() => setCurrency(curr.code)}
                className={`
                  relative group p-4 rounded-xl border-2 transition-all duration-200
                  ${
                    currency === curr.code
                      ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                      : 'border-base-300 hover:border-primary/50 hover:bg-base-200/50'
                  }
                `}
              >
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`
                      transition-colors duration-200
                      ${currency === curr.code ? 'text-primary' : 'text-base-content/60'}
                    `}
                  >
                    {curr.icon}
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-sm">{curr.code}</div>
                    <div className="text-xs opacity-60 truncate w-full">{curr.label}</div>
                  </div>
                </div>
                {currency === curr.code && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-content" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Botão Salvar com Estados de Feedback */}
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saveStatus === 'loading' || totalBank <= 0}
            className="btn btn-secondary w-full flex items-center justify-center gap-2 min-h-[56px] text-base md:text-lg font-semibold transition-all duration-200 relative overflow-hidden group"
          >
            {saveStatus === 'loading' && (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Salvando...
              </>
            )}
            {saveStatus === 'success' && (
              <>
                <Check className="w-5 h-5" />
                Salvo com sucesso!
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <AlertCircle className="w-5 h-5" />
                Erro ao salvar
              </>
            )}
            {saveStatus === 'idle' && (
              <>
                <Save className="w-5 h-5" />
                Salvar Configurações
                <div className="absolute inset-0 bg-base-content/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </>
            )}
          </button>

          {/* Mensagens de Feedback */}
          {saveStatus === 'success' && (
            <div className="mt-3 p-3 rounded-lg bg-success/10 border border-success/20 animate-in">
              <p className="text-sm text-success font-medium text-center">
                ✓ Suas configurações foram salvas com sucesso
              </p>
            </div>
          )}

          {saveStatus === 'error' && (
            <div className="mt-3 p-3 rounded-lg bg-error/10 border border-error/20 animate-in">
              <p className="text-sm text-error font-medium text-center">
                Erro ao salvar. Verifique os dados e tente novamente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BankSettings;

