
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { BankSettings } from '../types';
import { Wallet, Save, DollarSign, TrendingUp, TrendingDown, Check, Loader2, Euro, PoundSterling, AlertCircle, Info, X, Sparkles } from 'lucide-react';
import { validateBankSettings } from '../utils/validation';
import { errorService } from '../services/errorService';
import { normalizeCurrency, getCurrencySymbol } from '../utils/currency';

type SaveStatus = 'idle' | 'loading' | 'success' | 'error';
type ValidationState = 'idle' | 'valid' | 'invalid';

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
  const [inputValue, setInputValue] = useState<string>('');
  // Normalizar currency para código ISO (compatibilidade com dados antigos)
  const [currency, setCurrency] = useState<string>(
    bankSettings?.currency ? normalizeCurrency(bankSettings.currency) : 'BRL'
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationMessage, setValidationMessage] = useState<string>('');
  const [previousBankValue, setPreviousBankValue] = useState<number | null>(bankSettings?.totalBank || null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [showTips, setShowTips] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Função para formatar número com separadores de milhares
  const formatNumber = useCallback((value: number | string): string => {
    if (!value && value !== 0) return '';
    const num = typeof value === 'string' ? parseFloat(value) || 0 : value;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, []);

  // Função para parsear valor formatado
  const parseFormattedValue = useCallback((value: string): number => {
    return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
  }, []);

  // Validação em tempo real
  useEffect(() => {
    if (totalBank === 0 && !inputValue) {
      setValidationState('idle');
      setValidationMessage('');
      return;
    }

    if (totalBank < 0) {
      setValidationState('invalid');
      setValidationMessage('O valor não pode ser negativo');
      return;
    }

    if (totalBank === 0) {
      setValidationState('invalid');
      setValidationMessage('O valor deve ser maior que zero');
      return;
    }

    if (totalBank > 100000000) {
      setValidationState('invalid');
      setValidationMessage('Valor muito alto (máximo: 100.000.000)');
      return;
    }

    try {
      const testSettings: BankSettings = {
        totalBank,
        currency: normalizeCurrency(currency),
        updatedAt: Date.now()
      };
      validateBankSettings(testSettings);
      setValidationState('valid');
      setValidationMessage('');
    } catch (error) {
      setValidationState('invalid');
      setValidationMessage(error instanceof Error ? error.message : 'Valor inválido');
    }
  }, [totalBank, currency, inputValue]);

  // Detectar mudanças não salvas
  useEffect(() => {
    const hasChanged = 
      totalBank !== (bankSettings?.totalBank || 0) ||
      normalizeCurrency(currency) !== normalizeCurrency(bankSettings?.currency || 'BRL');
    setHasUnsavedChanges(hasChanged);
  }, [totalBank, currency, bankSettings]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d,.-]/g, ''); // Remove caracteres inválidos
    setInputValue(value);
    const parsed = parseFormattedValue(value);
    setTotalBank(parsed);
  }, [parseFormattedValue]);

  const handleQuickValue = useCallback((value: number) => {
    setTotalBank(value);
    setInputValue(formatNumber(value));
    inputRef.current?.focus();
  }, [formatNumber]);

  const handleReset = useCallback(() => {
    if (bankSettings) {
      setTotalBank(bankSettings.totalBank);
      setInputValue(formatNumber(bankSettings.totalBank));
      setCurrency(normalizeCurrency(bankSettings.currency));
    } else {
      setTotalBank(0);
      setInputValue('');
      setCurrency('BRL');
    }
    setHasUnsavedChanges(false);
  }, [bankSettings, formatNumber]);

  const handleSave = useCallback(async () => {
    if (validationState !== 'valid' || totalBank <= 0) return;
    
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
      setPreviousBankValue(totalBank);
      setHasUnsavedChanges(false);
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
  }, [totalBank, currency, validationState, onSave, onError]);

  // Inicializar valores quando bankSettings mudar
  useEffect(() => {
    if (bankSettings) {
      setTotalBank(bankSettings.totalBank);
      setPreviousBankValue(bankSettings.totalBank);
      setInputValue(formatNumber(bankSettings.totalBank));
      // Normalizar currency para código ISO (compatibilidade com dados antigos)
      setCurrency(normalizeCurrency(bankSettings.currency));
      setHasUnsavedChanges(false);
    } else {
      setInputValue('');
    }
  }, [bankSettings, formatNumber]);

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter ou Cmd/Ctrl+Enter para salvar
      if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || (e.key === 'Enter' && e.target === inputRef.current)) {
        if (validationState === 'valid' && totalBank > 0 && saveStatus === 'idle') {
          e.preventDefault();
          handleSave();
        }
      }
      // Escape para resetar
      if (e.key === 'Escape' && e.target === inputRef.current) {
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [validationState, totalBank, saveStatus, handleSave, handleReset]);

  const currentCurrency = currencies.find(c => c.code === currency);
  const bankDifference = previousBankValue !== null ? totalBank - previousBankValue : 0;
  const bankPercentageChange = previousBankValue && previousBankValue > 0 
    ? ((totalBank - previousBankValue) / previousBankValue) * 100 
    : 0;

  const quickValues = [100, 500, 1000, 5000];

  const InfoTooltip = ({ text }: { text: string }) => (
    <div className="tooltip tooltip-top cursor-help" data-tip={text}>
      <Info className="w-4 h-4 opacity-50 hover:opacity-100 transition-opacity" />
    </div>
  );

  return (
    <div className="custom-card p-4 md:p-6 bg-gradient-to-br from-secondary/10 to-accent/10 border border-secondary/20">
      {/* Header Melhorado */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-secondary/20 text-secondary">
            <Wallet className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg md:text-xl font-black uppercase">Configurações de Banca</h3>
              {hasUnsavedChanges && (
                <span className="badge badge-warning badge-sm animate-pulse" title="Mudanças não salvas">
                  Não salvo
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm opacity-60">Gerencie o capital da sua banca de apostas</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowTips(!showTips)}
          className="btn btn-ghost btn-sm btn-circle"
          aria-label="Mostrar dicas"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-6">
        {/* Card de Visualização da Banca Atual */}
        {(bankSettings && bankSettings.totalBank > 0) || totalBank > 0 ? (
          <div className={`custom-card p-6 md:p-8 bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10 border border-primary/20 backdrop-blur-sm relative overflow-hidden ${hasUnsavedChanges ? 'animate-pulse' : ''}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-sm opacity-70">
                {bankDifference > 0 ? (
                  <TrendingUp className="w-4 h-4 text-success" />
                ) : bankDifference < 0 ? (
                  <TrendingDown className="w-4 h-4 text-error" />
                ) : (
                  <TrendingUp className="w-4 h-4" />
                )}
                <span>Banca Atual</span>
                {previousBankValue !== null && bankDifference !== 0 && (
                  <span className={`text-xs font-semibold ${bankDifference > 0 ? 'text-success' : 'text-error'}`}>
                    {bankDifference > 0 ? '+' : ''}{getCurrencySymbol(currency)} {Math.abs(bankDifference).toFixed(2)} 
                    ({bankPercentageChange > 0 ? '+' : ''}{bankPercentageChange.toFixed(1)}%)
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl md:text-5xl font-bold tracking-tight tabular-nums">
                  {getCurrencySymbol(currency)} {formatNumber(totalBank)}
                </span>
              </div>
              {bankSettings?.updatedAt && !hasUnsavedChanges && (
                <p className="text-xs opacity-50">
                  {currency} • Última atualização: {new Date(bankSettings.updatedAt).toLocaleString('pt-BR')}
                </p>
              )}
              {hasUnsavedChanges && (
                <p className="text-xs opacity-70 text-warning">
                  Alterações pendentes • Pressione Enter para salvar
                </p>
              )}
            </div>
          </div>
        ) : null}

        {/* Valor da Banca - Input Melhorado */}
        <div className="form-control">
          <label className="label" htmlFor="bank-amount-input">
            <span className="label-text font-bold flex items-center gap-2 text-sm md:text-base">
              <DollarSign className="w-4 h-4" />
              Valor Total da Banca
              <InfoTooltip text="Digite o valor total disponível na sua banca. Recomendado: mantenha entre 1-5% por aposta." />
            </span>
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/60 pointer-events-none text-lg font-medium z-10">
              {currentCurrency?.symbol || 'R$'}
            </div>
          <input
              ref={inputRef}
              id="bank-amount-input"
              type="text"
              inputMode="decimal"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={() => {
                if (totalBank > 0) {
                  setInputValue(formatNumber(totalBank));
                }
              }}
              className={`
                input input-bordered w-full min-h-[56px] text-xl md:text-2xl font-semibold tabular-nums pl-12 pr-12 transition-all focus:ring-2
                ${validationState === 'valid' ? 'border-success focus:ring-success' : ''}
                ${validationState === 'invalid' ? 'border-error focus:ring-error animate-shake' : ''}
                ${validationState === 'idle' ? 'focus:ring-primary' : ''}
              `}
              placeholder="0,00"
              aria-label="Valor total da banca"
              aria-invalid={validationState === 'invalid'}
              aria-describedby={validationMessage ? 'validation-message' : undefined}
            />
            {validationState === 'valid' && totalBank > 0 && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-success">
                <Check className="w-5 h-5" />
              </div>
            )}
            {validationState === 'invalid' && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-error">
                <AlertCircle className="w-5 h-5" />
              </div>
            )}
          </div>
          <label className="label">
            <span className="label-text-alt opacity-60 text-xs">
              {validationMessage || 'Digite o valor total disponível na sua banca'}
            </span>
            {validationMessage && (
              <span id="validation-message" className="label-text-alt text-error text-xs" role="alert">
                {validationMessage}
              </span>
            )}
          </label>
          
          {/* Sugestões de Valores Rápidos */}
          <div className="flex flex-wrap gap-2 mt-2">
            {quickValues.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => handleQuickValue(value)}
                className="btn btn-xs btn-outline"
                aria-label={`Definir valor ${getCurrencySymbol(currency)} ${value}`}
              >
                {getCurrencySymbol(currency)} {value}
              </button>
            ))}
            {previousBankValue && previousBankValue > 0 && (
              <button
                type="button"
                onClick={() => handleQuickValue(previousBankValue)}
                className="btn btn-xs btn-outline btn-primary"
                aria-label="Usar valor anterior"
              >
                Valor Anterior
              </button>
            )}
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleReset}
                className="btn btn-xs btn-ghost"
                aria-label="Desfazer alterações"
              >
                <X className="w-3 h-3 mr-1" />
                Desfazer
              </button>
            )}
          </div>
        </div>

        {/* Seletor Visual de Moedas */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-bold flex items-center gap-2 text-sm md:text-base">
              Moeda
              <InfoTooltip text="Selecione a moeda da sua banca. Isso afetará todos os cálculos e exibições." />
            </span>
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

        {/* Card de Dicas */}
        {showTips && (
          <div className="custom-card p-4 bg-info/10 border border-info/20 animate-in">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <h4 className="font-bold text-sm text-info">Dicas de Gerenciamento de Banca</h4>
                <ul className="text-xs space-y-1 opacity-80">
                  <li>• Mantenha entre 1-5% da banca por aposta</li>
                  <li>• Atualize regularmente para cálculos precisos</li>
                  <li>• Use o sistema de validação para evitar erros</li>
                  <li>• Pressione Enter para salvar rapidamente</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => setShowTips(false)}
                className="btn btn-xs btn-ghost btn-circle"
                aria-label="Fechar dicas"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Botão Salvar com Estados de Feedback */}
        <div className="pt-2">
        <button
          onClick={handleSave}
            disabled={saveStatus === 'loading' || totalBank <= 0 || validationState === 'invalid'}
            className={`
              btn w-full flex items-center justify-center gap-2 min-h-[56px] text-base md:text-lg font-semibold transition-all duration-200 relative overflow-hidden group
              ${hasUnsavedChanges ? 'btn-primary shadow-lg shadow-primary/20' : 'btn-secondary'}
              ${validationState === 'invalid' ? 'btn-disabled' : ''}
            `}
            aria-label="Salvar configurações"
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
                <span className="text-xs opacity-60 hidden md:inline">(Enter)</span>
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

