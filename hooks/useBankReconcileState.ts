import { useCallback, useEffect, useState } from 'react';
import type { BankSettings } from '../types';
import { validateBankSettings } from '../utils/validation';
import { formatMoneyPtBr, normalizeLeverageForSettings, parseMoneyPtBr } from '../utils/bankNumbers';
import type { SaveStatus } from '../components/bank/types';

interface UseBankReconcileStateParams {
  bankSettings?: BankSettings;
  netCashDelta: number;
  suggestedBase: number;
  leverage: number;
  onSave: (settings: BankSettings) => Promise<void>;
  onError?: (message: string) => void;
  onAfterReconcile: (reconciledCash: number) => void;
}

export function useBankReconcileState({
  bankSettings,
  netCashDelta,
  suggestedBase,
  leverage,
  onSave,
  onError,
  onAfterReconcile,
}: UseBankReconcileStateParams) {
  const [bankBase, setBankBase] = useState<number | null>(null);
  const [bankBaseInput, setBankBaseInput] = useState<string>('');
  const [baseStatus, setBaseStatus] = useState<SaveStatus>('idle');
  const [reconcileStatus, setReconcileStatus] = useState<SaveStatus>('idle');

  // Inicializar base (Supabase -> localStorage -> sugerida)
  useEffect(() => {
    if (!bankSettings) return;
    if (bankBase !== null) return;

    let baseToUse = suggestedBase;
    try {
      if (
        typeof bankSettings.baseBank === 'number' &&
        Number.isFinite(bankSettings.baseBank) &&
        bankSettings.baseBank >= 0
      ) {
        baseToUse = bankSettings.baseBank;
      } else {
        const stored = localStorage.getItem('goalscan_bank_base');
        const parsed = stored ? Number(stored) : Number.NaN;
        if (Number.isFinite(parsed) && parsed >= 0) {
          baseToUse = parsed;
        }
      }
    } catch {
      // ignorar
    }

    setBankBase(baseToUse);
    setBankBaseInput(formatMoneyPtBr(baseToUse));

    try {
      localStorage.setItem('goalscan_bank_base', String(Number(baseToUse.toFixed(2))));
    } catch {
      // ignorar
    }
  }, [bankSettings, bankBase, suggestedBase]);

  const handleBaseChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d,.-]/g, '');
    setBankBaseInput(value);
    setBankBase(parseMoneyPtBr(value));
    setBaseStatus('idle');
  }, []);

  const handleBaseBlur = useCallback(() => {
    if (bankBase !== null && Number.isFinite(bankBase)) {
      setBankBaseInput(formatMoneyPtBr(bankBase));
    }
  }, [bankBase]);

  const handleUseSuggestedBase = useCallback(() => {
    setBankBase(suggestedBase);
    setBankBaseInput(formatMoneyPtBr(suggestedBase));
    setBaseStatus('idle');
  }, [suggestedBase]);

  const handleSaveBase = useCallback(async () => {
    if (bankBase === null || !Number.isFinite(bankBase) || bankBase < 0) return;
    if (!bankSettings) {
      onError?.('Configure a banca primeiro para salvar a base.');
      return;
    }

    setBaseStatus('loading');
    try {
      try {
        localStorage.setItem('goalscan_bank_base', String(Number(bankBase.toFixed(2))));
      } catch {
        // ignorar
      }

      const newSettings: BankSettings = {
        totalBank: bankSettings.totalBank,
        currency: 'BRL',
        baseBank: Number(bankBase.toFixed(2)),
        leverage: normalizeLeverageForSettings(leverage),
        updatedAt: Date.now(),
      };

      const validatedSettings = validateBankSettings(newSettings);
      await onSave(validatedSettings);

      setBaseStatus('success');
      setTimeout(() => setBaseStatus('idle'), 2000);
    } catch (e) {
      setBaseStatus('error');
      const errorMessage = e instanceof Error ? e.message : 'Erro ao salvar base';
      onError?.(`Erro ao salvar base: ${errorMessage}`);
      setTimeout(() => setBaseStatus('idle'), 2000);
    }
  }, [bankBase, bankSettings, leverage, onSave, onError]);

  const handleReconcile = useCallback(async () => {
    if (!bankSettings) {
      onError?.('Configure a banca primeiro para reconciliar.');
      return;
    }
    if (bankBase === null || !Number.isFinite(bankBase) || bankBase < 0) {
      onError?.('Defina uma banca base válida para reconciliar.');
      return;
    }

    setReconcileStatus('loading');
    try {
      const reconciledCash = Math.max(0, Number((bankBase + netCashDelta).toFixed(2)));
      const newSettings: BankSettings = {
        totalBank: reconciledCash,
        currency: 'BRL',
        baseBank: Number(bankBase.toFixed(2)),
        leverage: normalizeLeverageForSettings(leverage),
        updatedAt: Date.now(),
      };

      const validatedSettings = validateBankSettings(newSettings);
      await onSave(validatedSettings);

      onAfterReconcile(reconciledCash);

      setReconcileStatus('success');
      setTimeout(() => setReconcileStatus('idle'), 2500);
    } catch (error) {
      setReconcileStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Erro ao reconciliar';
      onError?.(`Erro ao reconciliar banca: ${errorMessage}`);
      setTimeout(() => setReconcileStatus('idle'), 2500);
    }
  }, [bankSettings, bankBase, netCashDelta, leverage, onSave, onError, onAfterReconcile]);

  return {
    bankBase,
    bankBaseInput,
    baseStatus,
    reconcileStatus,
    handleBaseChange,
    handleBaseBlur,
    handleUseSuggestedBase,
    handleSaveBase,
    handleReconcile,
  };
}


