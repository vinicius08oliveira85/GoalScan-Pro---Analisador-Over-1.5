import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BankSettings, SavedAnalysis } from '../types';
import { calculateBankStats, prepareBankEvolutionData } from '../utils/dashboardStats';
import { computeNetCashDelta } from '../utils/bankLedger';
import { validateBankSettings } from '../utils/validation';
import {
  clampLeverage,
  formatLeveragePtBr,
  formatMoneyPtBr,
  normalizeLeverageForSettings,
  parseDecimalFlexible,
  parseMoneyPtBr,
} from '../utils/bankNumbers';
import type { SaveStatus, ValidationState } from '../components/bank/types';
import { useBankReconcileState } from './useBankReconcileState';

interface UseBankTabStateParams {
  bankSettings?: BankSettings;
  savedMatches: SavedAnalysis[];
  onSave: (settings: BankSettings) => Promise<void>;
  onError?: (message: string) => void;
}

export function useBankTabState({ bankSettings, savedMatches, onSave, onError }: UseBankTabStateParams) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [totalBank, setTotalBank] = useState<number>(bankSettings?.totalBank || 0);
  const [inputValue, setInputValue] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationMessage, setValidationMessage] = useState<string>('');

  // Multiplicador de retorno (leverage)
  const [leverage, setLeverage] = useState<number>(bankSettings?.leverage ?? 1.0);
  const [leverageInput, setLeverageInput] = useState<string>(formatLeveragePtBr(bankSettings?.leverage ?? 1.0));

  const netCashDelta = useMemo(() => computeNetCashDelta(savedMatches), [savedMatches]);

  const suggestedBase = useMemo(() => {
    if (!bankSettings) return 0;
    return Math.max(0, Number((bankSettings.totalBank - netCashDelta).toFixed(2)));
  }, [bankSettings, netCashDelta]);

  const bankStats = useMemo(() => calculateBankStats(savedMatches, bankSettings), [savedMatches, bankSettings]);
  const bankEvolutionData = useMemo(
    () => prepareBankEvolutionData(savedMatches, bankSettings),
    [savedMatches, bankSettings]
  );

  // Validação (somente do totalBank, como antes)
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
        currency: 'BRL',
        updatedAt: Date.now(),
      };
      validateBankSettings(testSettings);
      setValidationState('valid');
      setValidationMessage('');
    } catch (error) {
      setValidationState('invalid');
      setValidationMessage(error instanceof Error ? error.message : 'Valor inválido');
    }
  }, [totalBank, inputValue]);

  // Inicializar valores quando bankSettings mudar
  useEffect(() => {
    if (bankSettings) {
      setTotalBank(bankSettings.totalBank);
      setInputValue(formatMoneyPtBr(bankSettings.totalBank));
      const leverageValue = bankSettings.leverage ?? 1.0;
      setLeverage(leverageValue);
      setLeverageInput(formatLeveragePtBr(leverageValue));
    } else {
      setInputValue('');
      setLeverage(1.0);
      setLeverageInput(formatLeveragePtBr(1.0));
    }
  }, [bankSettings]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d,.-]/g, '');
    setInputValue(value);
    setTotalBank(parseMoneyPtBr(value));
  }, []);

  const handleInputBlur = useCallback(() => {
    if (totalBank > 0) setInputValue(formatMoneyPtBr(totalBank));
  }, [totalBank]);

  const handleLeverageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d,.-]/g, '');
    setLeverageInput(value);
    if (!value.trim()) {
      setLeverage(1.0);
      return;
    }
    setLeverage(parseDecimalFlexible(value));
  }, []);

  const handleLeverageBlur = useCallback(() => {
    const clamped = clampLeverage(leverage);
    setLeverage(clamped);
    setLeverageInput(formatLeveragePtBr(clamped));
  }, [leverage]);
  
  const reconcile = useBankReconcileState({
    bankSettings,
    netCashDelta,
    suggestedBase,
    leverage,
    onSave,
    onError,
    onAfterReconcile: (reconciledCash) => {
      setTotalBank(reconciledCash);
      setInputValue(formatMoneyPtBr(reconciledCash));
    },
  });

  const handleSave = useCallback(async () => {
    if (validationState !== 'valid' || totalBank <= 0) return;
    setSaveStatus('loading');

    try {
      const newSettings: BankSettings = {
        totalBank,
        currency: 'BRL',
        baseBank:
          typeof bankSettings?.baseBank === 'number'
            ? bankSettings.baseBank
            : reconcile.bankBase === null
              ? undefined
              : Number(reconcile.bankBase.toFixed(2)),
        leverage: normalizeLeverageForSettings(leverage),
        updatedAt: Date.now(),
      };

      const validatedSettings = validateBankSettings(newSettings);
      await onSave(validatedSettings);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar';
      onError?.(`Erro ao salvar configurações: ${errorMessage}`);
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [validationState, totalBank, bankSettings?.baseBank, reconcile.bankBase, leverage, onSave, onError]);

  return {
    inputRef,
    totalBank,
    inputValue,
    validationState,
    validationMessage,
    saveStatus,
    handleInputChange,
    handleInputBlur,
    leverage,
    leverageInput,
    handleLeverageChange,
    handleLeverageBlur,
    handleSave,

    bankBase: reconcile.bankBase,
    bankBaseInput: reconcile.bankBaseInput,
    baseStatus: reconcile.baseStatus,
    reconcileStatus: reconcile.reconcileStatus,
    handleBaseChange: reconcile.handleBaseChange,
    handleBaseBlur: reconcile.handleBaseBlur,
    handleUseSuggestedBase: reconcile.handleUseSuggestedBase,
    handleSaveBase: reconcile.handleSaveBase,
    handleReconcile: reconcile.handleReconcile,

    netCashDelta,
    suggestedBase,
    bankStats,
    bankEvolutionData,
  };
}


