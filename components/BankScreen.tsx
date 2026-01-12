import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Target,
  CheckCircle,
  XCircle,
  Clock,
  Save,
  AlertCircle,
  Check,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { BankSettings, SavedAnalysis } from '../types';
import { calculateBankStats, prepareBankEvolutionData } from '../utils/dashboardStats';
import { computeNetCashDelta } from '../utils/bankLedger';
import { validateBankSettings } from '../utils/validation';
import { animations } from '../utils/animations';
import { useWindowSize } from '../hooks/useWindowSize';

interface BankScreenProps {
  bankSettings?: BankSettings;
  savedMatches: SavedAnalysis[];
  onSave: (settings: BankSettings) => Promise<void>;
  onError?: (message: string) => void;
}

type SaveStatus = 'idle' | 'loading' | 'success' | 'error';

const BankScreen: React.FC<BankScreenProps> = ({ bankSettings, savedMatches, onSave, onError }) => {
  const windowSize = useWindowSize();
  const [totalBank, setTotalBank] = useState<number>(bankSettings?.totalBank || 0);
  const [inputValue, setInputValue] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [reconcileStatus, setReconcileStatus] = useState<SaveStatus>('idle');
  const [baseStatus, setBaseStatus] = useState<SaveStatus>('idle');
  const [validationState, setValidationState] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [validationMessage, setValidationMessage] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Base de banca (para reconciliar do zero). Persistida localmente.
  const [bankBase, setBankBase] = useState<number | null>(null);
  const [bankBaseInput, setBankBaseInput] = useState<string>('');

  // Impacto líquido atual das apostas na banca (cash), baseado no estado atual
  const netCashDelta = useMemo(() => computeNetCashDelta(savedMatches), [savedMatches]);
  const suggestedBase = useMemo(() => {
    if (!bankSettings) return 0;
    return Math.max(0, Number((bankSettings.totalBank - netCashDelta).toFixed(2)));
  }, [bankSettings, netCashDelta]);

  const bankStats = useMemo(
    () => calculateBankStats(savedMatches, bankSettings),
    [savedMatches, bankSettings]
  );
  const bankEvolutionData = useMemo(
    () => prepareBankEvolutionData(savedMatches, bankSettings),
    [savedMatches, bankSettings]
  );

  // Formatar número com separadores
  const formatNumber = useCallback((value: number | string): string => {
    if (!value && value !== 0) return '';
    const num = typeof value === 'string' ? parseFloat(value) || 0 : value;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, []);

  // Parsear valor formatado
  const parseFormattedValue = useCallback((value: string): number => {
    return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
  }, []);

  // Validação
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
        currency: 'BRL', // Apenas REAL
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

  // Inicializar valores
  useEffect(() => {
    if (bankSettings) {
      setTotalBank(bankSettings.totalBank);
      setInputValue(formatNumber(bankSettings.totalBank));
    } else {
      setInputValue('');
    }
  }, [bankSettings, formatNumber]);

  // Inicializar base (localStorage) ou sugerir uma base inferida a partir da banca atual e do delta das apostas
  useEffect(() => {
    if (!bankSettings) return;
    if (bankBase !== null) return;

    const suggestedBase = Math.max(
      0,
      Number((bankSettings.totalBank - netCashDelta).toFixed(2))
    );

    let baseToUse = suggestedBase;
    try {
      const stored = localStorage.getItem('goalscan_bank_base');
      const parsed = stored ? Number(stored) : Number.NaN;
      if (Number.isFinite(parsed) && parsed >= 0) {
        baseToUse = parsed;
      }
    } catch {
      // ignorar
    }

    setBankBase(baseToUse);
    setBankBaseInput(formatNumber(baseToUse));
  }, [bankSettings, bankBase, netCashDelta, formatNumber]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^\d,.-]/g, '');
      setInputValue(value);
      const parsed = parseFormattedValue(value);
      setTotalBank(parsed);
    },
    [parseFormattedValue]
  );

  const handleBaseChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^\d,.-]/g, '');
      setBankBaseInput(value);
      const parsed = parseFormattedValue(value);
      setBankBase(parsed);
      setBaseStatus('idle');
    },
    [parseFormattedValue]
  );

  const handleSave = useCallback(async () => {
    if (validationState !== 'valid' || totalBank <= 0) return;

    setSaveStatus('loading');

    try {
      const newSettings: BankSettings = {
        totalBank,
        currency: 'BRL', // Apenas REAL
        updatedAt: Date.now(),
      };

      const validatedSettings = validateBankSettings(newSettings);
      await onSave(validatedSettings);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar';
      if (onError) {
        onError(`Erro ao salvar configurações: ${errorMessage}`);
      }
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [totalBank, validationState, onSave, onError]);

  const handleSaveBase = useCallback(() => {
    if (bankBase === null || !Number.isFinite(bankBase) || bankBase < 0) return;
    setBaseStatus('loading');
    try {
      localStorage.setItem('goalscan_bank_base', String(Number(bankBase.toFixed(2))));
      setBaseStatus('success');
      setTimeout(() => setBaseStatus('idle'), 2000);
    } catch {
      setBaseStatus('error');
      setTimeout(() => setBaseStatus('idle'), 2000);
    }
  }, [bankBase]);

  const handleUseSuggestedBase = useCallback(() => {
    setBankBase(suggestedBase);
    setBankBaseInput(formatNumber(suggestedBase));
    setBaseStatus('idle');
  }, [suggestedBase, formatNumber]);

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
        updatedAt: Date.now(),
      };

      const validatedSettings = validateBankSettings(newSettings);
      await onSave(validatedSettings);

      // Atualizar UI imediatamente
      setTotalBank(reconciledCash);
      setInputValue(formatNumber(reconciledCash));

      setReconcileStatus('success');
      setTimeout(() => setReconcileStatus('idle'), 2500);
    } catch (error) {
      setReconcileStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Erro ao reconciliar';
      onError?.(`Erro ao reconciliar banca: ${errorMessage}`);
      setTimeout(() => setReconcileStatus('idle'), 2500);
    }
  }, [bankSettings, bankBase, netCashDelta, onSave, onError, formatNumber]);

  const statCards = [
    {
      title: 'Lucro Total',
      value: `R$ ${bankStats.totalProfit.toFixed(2)}`,
      icon: DollarSign,
      color:
        bankStats.totalProfit > 0 ? 'success' : bankStats.totalProfit < 0 ? 'error' : 'primary',
      subtitle:
        bankStats.totalProfit > 0
          ? 'Ganhos acumulados'
          : bankStats.totalProfit < 0
            ? 'Prejuízo acumulado'
            : 'Sem movimentação',
    },
    {
      title: 'ROI',
      value: `${bankStats.roi > 0 ? '+' : ''}${bankStats.roi.toFixed(1)}%`,
      icon: Percent,
      color: bankStats.roi > 0 ? 'success' : 'error',
      subtitle: 'Return on Investment',
    },
    {
      title: 'Apostas Ganhas',
      value: bankStats.wonBets,
      icon: CheckCircle,
      color: 'success',
      subtitle: `${bankStats.totalBets > 0 ? ((bankStats.wonBets / bankStats.totalBets) * 100).toFixed(1) : 0}% de acerto`,
    },
    {
      title: 'Apostas Perdidas',
      value: bankStats.lostBets,
      icon: XCircle,
      color: 'error',
      subtitle: `${bankStats.totalBets > 0 ? ((bankStats.lostBets / bankStats.totalBets) * 100).toFixed(1) : 0}% de perda`,
    },
    {
      title: 'Pendentes',
      value: bankStats.pendingBets,
      icon: Clock,
      color: 'warning',
      subtitle: 'Aguardando resultado',
    },
    {
      title: 'Total de Apostas',
      value: bankStats.totalBets,
      icon: Target,
      color: 'primary',
      subtitle: 'Apostas registradas',
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8">
      {/* Card de Banca Atual */}
      <motion.div
        variants={animations.fadeInUp}
        initial="initial"
        animate="animate"
        className="custom-card p-6 md:p-8 bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10 border border-primary/20 backdrop-blur-sm relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50" />
        <div className="relative space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/20 border border-primary/30">
              <Wallet className="w-6 h-6 md:w-8 md:h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black">Banca Atual</h2>
              <p className="text-xs md:text-sm opacity-60">Capital disponível para apostas</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl md:text-5xl font-black tracking-tight tabular-nums">
              R$ {formatNumber(totalBank)}
            </span>
          </div>
          {(bankStats.pendingExposure > 0 || bankStats.totalBets > 0) && (
            <div className="text-xs md:text-sm opacity-70">
              <span className="font-semibold">Equity:</span>{' '}
              <span className="tabular-nums">
                R$ {formatNumber(totalBank + bankStats.pendingExposure)}
              </span>
              {bankStats.pendingExposure > 0 && (
                <>
                  <span className="opacity-50"> • </span>
                  <span className="opacity-70">Pendentes:</span>{' '}
                  <span className="tabular-nums">R$ {formatNumber(bankStats.pendingExposure)}</span>
                </>
              )}
            </div>
          )}
          {bankSettings?.updatedAt && (
            <p className="text-xs opacity-50">
              Última atualização: {new Date(bankSettings.updatedAt).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      </motion.div>

      {/* Formulário de Edição */}
      <motion.div
        variants={animations.fadeInUp}
        initial="initial"
        animate="animate"
        custom={1}
        className="custom-card p-4 md:p-6"
      >
        <div className="mb-4">
          <h3 className="text-lg md:text-xl font-black mb-1">Editar Banca</h3>
          <p className="text-xs md:text-sm opacity-60">
            Atualize o valor da sua banca (apenas REAL - R$)
          </p>
        </div>
        <div className="space-y-4">
          <div className="form-control">
            <label className="label" htmlFor="bank-amount-input">
              <span className="label-text font-bold flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Valor Total da Banca (R$)
              </span>
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/60 pointer-events-none text-lg font-medium z-10">
                R$
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
                  ${validationState === 'invalid' ? 'border-error focus:ring-error' : ''}
                  ${validationState === 'idle' ? 'focus:ring-primary' : ''}
                `}
                placeholder="0,00"
                aria-label="Valor total da banca"
                aria-invalid={validationState === 'invalid'}
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
            </label>
          </div>

          <button
            onClick={handleSave}
            disabled={saveStatus === 'loading' || totalBank <= 0 || validationState === 'invalid'}
            className={`
              btn w-full flex items-center justify-center gap-2 min-h-[56px] text-base md:text-lg font-semibold
              ${validationState === 'invalid' ? 'btn-disabled' : 'btn-primary'}
            `}
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
                Salvar Banca
              </>
            )}
          </button>

          {/* Reconciliação (calcular do zero a partir das apostas registradas) */}
          <div className="pt-5 mt-2 border-t border-base-300/40 space-y-4">
            <div>
              <h4 className="text-base md:text-lg font-black mb-1">Reconciliar com Apostas</h4>
              <p className="text-xs md:text-sm opacity-60">
                Recalcula ganho/perda e sincroniza a banca com as apostas registradas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-base-200/40 border border-base-300/40">
                <p className="text-[10px] font-bold opacity-60 uppercase">Impacto líquido (apostas)</p>
                <p
                  className={`text-lg font-black tabular-nums ${
                    netCashDelta > 0 ? 'text-success' : netCashDelta < 0 ? 'text-error' : ''
                  }`}
                >
                  {netCashDelta > 0 ? '+' : ''}
                  R$ {netCashDelta.toFixed(2)}
                </p>
                {bankStats.pendingExposure > 0 && (
                  <p className="text-xs opacity-60 mt-1">
                    Pendentes (travado): R$ {bankStats.pendingExposure.toFixed(2)}
                  </p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-base-200/40 border border-base-300/40">
                <p className="text-[10px] font-bold opacity-60 uppercase">Base sugerida</p>
                <p className="text-lg font-black tabular-nums">R$ {suggestedBase.toFixed(2)}</p>
                <p className="text-xs opacity-60 mt-1">Usada caso não exista uma base salva.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div className="form-control">
                <label className="label" htmlFor="bank-base-input">
                  <span className="label-text font-bold flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Banca Base (R$)
                  </span>
                </label>
                <input
                  id="bank-base-input"
                  type="text"
                  inputMode="decimal"
                  value={bankBaseInput}
                  onChange={handleBaseChange}
                  onBlur={() => {
                    if (bankBase !== null && Number.isFinite(bankBase)) {
                      setBankBaseInput(formatNumber(bankBase));
                    }
                  }}
                  className="input input-bordered w-full"
                  placeholder="0,00"
                  aria-label="Banca base para reconciliação"
                />
                <label className="label">
                  <span className="label-text-alt opacity-60 text-xs">
                    Salva localmente (neste dispositivo).
                  </span>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleUseSuggestedBase}
                  className="btn btn-outline btn-sm flex-1"
                  type="button"
                >
                  Usar sugerida
                </button>
                <button
                  onClick={handleSaveBase}
                  className="btn btn-outline btn-sm flex-1"
                  type="button"
                  disabled={baseStatus === 'loading' || bankBase === null}
                >
                  {baseStatus === 'loading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : baseStatus === 'success' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Salvo
                    </>
                  ) : baseStatus === 'error' ? (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      Erro
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar Base
                    </>
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={handleReconcile}
              disabled={reconcileStatus === 'loading' || !bankSettings || bankBase === null}
              className="btn btn-secondary w-full flex items-center justify-center gap-2 min-h-[52px] text-base font-semibold"
              type="button"
            >
              {reconcileStatus === 'loading' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Reconciliando...
                </>
              ) : reconcileStatus === 'success' ? (
                <>
                  <Check className="w-5 h-5" />
                  Banca reconciliada!
                </>
              ) : reconcileStatus === 'error' ? (
                <>
                  <AlertCircle className="w-5 h-5" />
                  Erro ao reconciliar
                </>
              ) : (
                <>
                  <RotateCcw className="w-5 h-5" />
                  Reconciliar com Apostas
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              variants={animations.fadeInUp}
              initial="initial"
              animate="animate"
              custom={index + 2}
              className="custom-card p-4 md:p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`p-2 md:p-3 rounded-xl bg-${card.color}/10 border border-${card.color}/20`}
                >
                  <Icon className={`w-5 h-5 md:w-6 md:h-6 text-${card.color}`} />
                </div>
              </div>
              <div>
                <p className="text-xs md:text-sm font-semibold opacity-60 uppercase tracking-wide mb-1">
                  {card.title}
                </p>
                <p
                  className={`text-2xl md:text-3xl font-black ${
                    card.color === 'success'
                      ? 'text-success'
                      : card.color === 'error'
                        ? 'text-error'
                        : card.color === 'warning'
                          ? 'text-warning'
                          : 'text-primary'
                  }`}
                >
                  {card.value}
                </p>
                <p className="text-xs opacity-50 mt-1">{card.subtitle}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Maior Ganho e Maior Perda */}
      {(bankStats.biggestWin > 0 || bankStats.biggestLoss > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {bankStats.biggestWin > 0 && (
            <motion.div
              variants={animations.fadeInUp}
              initial="initial"
              animate="animate"
              custom={8}
              className="custom-card p-4 md:p-6 bg-success/10 border border-success/20"
            >
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-success" />
                <h3 className="text-lg font-black text-success">Maior Ganho</h3>
              </div>
              <p className="text-3xl font-black text-success">
                R$ {bankStats.biggestWin.toFixed(2)}
              </p>
            </motion.div>
          )}
          {bankStats.biggestLoss > 0 && (
            <motion.div
              variants={animations.fadeInUp}
              initial="initial"
              animate="animate"
              custom={9}
              className="custom-card p-4 md:p-6 bg-error/10 border border-error/20"
            >
              <div className="flex items-center gap-3 mb-2">
                <TrendingDown className="w-5 h-5 text-error" />
                <h3 className="text-lg font-black text-error">Maior Perda</h3>
              </div>
              <p className="text-3xl font-black text-error">
                R$ {bankStats.biggestLoss.toFixed(2)}
              </p>
            </motion.div>
          )}
        </div>
      )}

      {/* Gráfico de Evolução da Banca */}
      {bankEvolutionData.length > 0 && (
        <motion.div
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
          custom={10}
          className="custom-card p-4 md:p-6"
        >
          <div className="mb-4">
            <h3 className="text-lg md:text-xl font-black mb-1">Evolução da Banca</h3>
            <p className="text-xs md:text-sm opacity-60">
              Cash (disponível) e Equity (cash + pendentes) ao longo do tempo
            </p>
          </div>
          <ResponsiveContainer width="100%" height={windowSize.isMobile ? 250 : 350}>
            <AreaChart data={bankEvolutionData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="bankEquityGradientBank" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
                <filter id="glowBank">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.2} />
              <XAxis
                dataKey="date"
                tick={{
                  fill: 'currentColor',
                  opacity: 0.7,
                  fontSize: windowSize.isMobile ? 10 : 12,
                }}
                tickLine={{ stroke: 'currentColor', opacity: 0.3 }}
              />
              <YAxis
                tick={{
                  fill: 'currentColor',
                  opacity: 0.7,
                  fontSize: windowSize.isMobile ? 10 : 12,
                }}
                tickLine={{ stroke: 'currentColor', opacity: 0.3 }}
                tickFormatter={(value) => `R$ ${value.toFixed(0)}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const p = payload[0].payload as {
                      date: string;
                      timestamp: number;
                      cash: number;
                      equity: number;
                    };
                    const currentIndex = bankEvolutionData.findIndex(
                      (d) => d.timestamp === p.timestamp
                    );
                    const previous =
                      currentIndex > 0 ? bankEvolutionData[currentIndex - 1] : null;

                    const cashChange = previous ? p.cash - previous.cash : null;
                    const cashChangePct =
                      previous && previous.cash > 0
                        ? Number(((cashChange! / previous.cash) * 100).toFixed(1))
                        : null;

                    const equityChange = previous ? p.equity - previous.equity : null;

                    return (
                      <div className="bg-base-200/95 backdrop-blur-md border border-base-300 rounded-lg p-4 shadow-xl">
                        <div className="mb-2">
                          <p className="text-xs opacity-70 mb-1">{p.date}</p>
                          <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-black text-primary">R$ {p.cash.toFixed(2)}</p>
                            {cashChange !== null && (
                              <span
                                className={`text-sm font-bold flex items-center gap-1 ${
                                  cashChange > 0
                                    ? 'text-success'
                                    : cashChange < 0
                                      ? 'text-error'
                                      : ''
                                }`}
                              >
                                {cashChange > 0 ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : cashChange < 0 ? (
                                  <TrendingDown className="w-3 h-3" />
                                ) : null}
                                {cashChange > 0 ? '+' : ''}
                                {cashChange.toFixed(2)}
                                {cashChangePct !== null &&
                                  ` (${cashChangePct > 0 ? '+' : ''}${cashChangePct}%)`}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-xs opacity-80">
                            <div className="flex items-center justify-between gap-3">
                              <span className="opacity-70">Equity</span>
                              <span className="font-bold">R$ {p.equity.toFixed(2)}</span>
                            </div>
                            {equityChange !== null && (
                              <div className="flex items-center justify-between gap-3 mt-1">
                                <span className="opacity-70">Δ</span>
                                <span
                                  className={`font-bold ${
                                    equityChange > 0
                                      ? 'text-success'
                                      : equityChange < 0
                                        ? 'text-error'
                                        : ''
                                  }`}
                                >
                                  {equityChange > 0 ? '+' : ''}
                                  {equityChange.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="#a855f7"
                strokeWidth={2}
                fill="url(#bankEquityGradientBank)"
                fillOpacity={1}
                animationBegin={0}
                animationDuration={1000}
                animationEasing="ease-in-out"
              />
              <Line
                type="monotone"
                dataKey="cash"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{
                  fill: '#3b82f6',
                  strokeWidth: 2,
                  stroke: '#ffffff',
                  r: windowSize.isMobile ? 4 : 5,
                  filter: 'url(#glowBank)',
                }}
                activeDot={{
                  r: windowSize.isMobile ? 7 : 8,
                  stroke: '#ffffff',
                  strokeWidth: 2,
                  filter: 'url(#glowBank)',
                }}
                animationBegin={0}
                animationDuration={1000}
                animationEasing="ease-in-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Empty State */}
      {!bankSettings && (
        <motion.div
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
          className="custom-card p-12 md:p-16 flex flex-col items-center justify-center text-center border-dashed border-2"
        >
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-6">
            <Wallet className="w-12 h-12 md:w-16 md:h-16 text-primary opacity-60" />
          </div>
          <h3 className="text-2xl md:text-3xl font-black mb-3">Configure sua Banca</h3>
          <p className="text-sm md:text-base opacity-70 max-w-md">
            Configure o valor inicial da sua banca para começar a acompanhar seus resultados.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default BankScreen;
