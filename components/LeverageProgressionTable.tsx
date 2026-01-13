import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Calculator, AlertCircle, Copy, Check, Edit } from 'lucide-react';
import {
  calculateLeverageProgression,
  calculateLeverageProgressionWithVariableOdds,
  formatCurrency,
  validateLeverageParams,
} from '../utils/leverageProgression';
import { LeverageProgressionRow } from '../types';
import { animations } from '../utils/animations';
import LeverageOddsEditor from './LeverageOddsEditor';

interface LeverageProgressionTableProps {
  defaultOdd?: number;
  defaultInitialInvestment?: number;
  defaultDays?: number;
}

const LeverageProgressionTable: React.FC<LeverageProgressionTableProps> = ({
  defaultOdd = 1.3,
  defaultInitialInvestment = 5,
  defaultDays = 15,
}) => {
  const [odd, setOdd] = useState<number>(defaultOdd);
  const [initialInvestment, setInitialInvestment] = useState<number>(defaultInitialInvestment);
  const [days, setDays] = useState<number>(defaultDays);
  const [copied, setCopied] = useState<boolean>(false);
  const [customOdds, setCustomOdds] = useState<number[] | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);

  // Resetar odds customizadas quando odd padrão, investimento ou dias mudarem
  useEffect(() => {
    setCustomOdds(null);
  }, [odd, initialInvestment, days]);

  const validation = useMemo(
    () => validateLeverageParams(initialInvestment, odd, days),
    [initialInvestment, odd, days]
  );

  const progression = useMemo(() => {
    if (!validation.valid) return [];
    
    // Se há odds customizadas, usar função com odds variáveis
    if (customOdds && customOdds.length === days) {
      return calculateLeverageProgressionWithVariableOdds(initialInvestment, customOdds, days);
    }
    
    // Caso contrário, usar função padrão com odd fixa
    return calculateLeverageProgression(initialInvestment, odd, days);
  }, [initialInvestment, odd, days, validation.valid, customOdds]);

  const hasCustomOdds = customOdds !== null && customOdds.length === days;

  const handleCopyTable = async () => {
    if (progression.length === 0) return;

    const oddInfo = hasCustomOdds ? 'Odds variáveis' : `Odd: ${odd.toFixed(2)}`;
    const tableText = [
      'Tabela de Alavancagem Progressiva',
      `${oddInfo} | Investimento Inicial: ${formatCurrency(initialInvestment)} | Dias: ${days}`,
      '',
      'DIA\tODD\tINVESTIMENTO\tRETORNO',
      ...progression.map(
        (row) =>
          `DIA ${row.day}\t${row.odd.toFixed(2)}\t${formatCurrency(row.investment)}\t${formatCurrency(row.return)}`
      ),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(tableText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar tabela:', error);
    }
  };

  const handleSaveOdds = (odds: number[]) => {
    setCustomOdds(odds);
    setIsEditorOpen(false);
  };

  const handleResetOdds = () => {
    setCustomOdds(null);
  };

  return (
    <motion.div
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
      className="custom-card p-4 md:p-6"
    >
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/20 border border-primary/30">
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-black">Tabela de Alavancagem Progressiva</h3>
              <p className="text-xs md:text-sm opacity-60">
                Projeção de reinvestimento dia a dia (retorno vira investimento)
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {progression.length > 0 && (
              <>
                <button
                  onClick={() => setIsEditorOpen(true)}
                  className="btn btn-sm btn-primary gap-2"
                  title="Editar odds por dia"
                >
                  <Edit className="w-4 h-4" />
                  Editar Odds
                </button>
                {hasCustomOdds && (
                  <button
                    onClick={handleResetOdds}
                    className="btn btn-sm btn-outline gap-2"
                    title="Resetar para odd padrão"
                  >
                    <Calculator className="w-4 h-4" />
                    Resetar Odds
                  </button>
                )}
                <button
                  onClick={handleCopyTable}
                  className="btn btn-sm btn-ghost gap-2"
                  title="Copiar tabela"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Configurações */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="form-control">
          <label className="label" htmlFor="leverage-odd-input">
            <span className="label-text font-bold flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              Odd da Aposta
            </span>
          </label>
          <input
            id="leverage-odd-input"
            type="number"
            step="0.01"
            min="1.01"
            max="50"
            value={odd}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (value >= 1.01 && value <= 50) {
                setOdd(value);
              }
            }}
            className="input input-bordered w-full"
            placeholder="1.30"
          />
          <label className="label">
            <span className="label-text-alt opacity-60 text-xs">Mínimo: 1.01, Máximo: 50</span>
          </label>
        </div>

        <div className="form-control">
          <label className="label" htmlFor="leverage-initial-input">
            <span className="label-text font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Investimento Inicial
            </span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60 pointer-events-none text-sm font-medium z-10">
              R$
            </div>
            <input
              id="leverage-initial-input"
              type="number"
              step="0.01"
              min="0.01"
              max="1000000"
              value={initialInvestment}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value >= 0.01 && value <= 1000000) {
                  setInitialInvestment(value);
                }
              }}
              className="input input-bordered w-full pl-10"
              placeholder="5.00"
            />
          </div>
          <label className="label">
            <span className="label-text-alt opacity-60 text-xs">Valor inicial para o dia 1</span>
          </label>
        </div>

        <div className="form-control">
          <label className="label" htmlFor="leverage-days-input">
            <span className="label-text font-bold">Número de Dias</span>
          </label>
          <input
            id="leverage-days-input"
            type="number"
            step="1"
            min="1"
            max="30"
            value={days}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (value >= 1 && value <= 30) {
                setDays(value);
              }
            }}
            className="input input-bordered w-full"
            placeholder="15"
          />
          <label className="label">
            <span className="label-text-alt opacity-60 text-xs">Mínimo: 1, Máximo: 30</span>
          </label>
        </div>
      </div>

      {/* Mensagem de erro de validação */}
      {!validation.valid && validation.error && (
        <div className="alert alert-warning mb-4">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{validation.error}</span>
        </div>
      )}

      {/* Tabela */}
      {progression.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr className="bg-base-200">
                <th className="text-center font-black">DIA</th>
                <th className="text-right font-black">ODD</th>
                <th className="text-right font-black">INVESTIMENTO</th>
                <th className="text-right font-black">RETORNO</th>
              </tr>
            </thead>
            <tbody>
              {progression.map((row) => {
                const isCustomOdd = hasCustomOdds && customOdds && row.odd !== odd;
                return (
                  <tr key={row.day} className="hover">
                    <td className="text-center font-bold tabular-nums">{row.day}</td>
                    <td
                      className={`text-right font-semibold tabular-nums ${
                        isCustomOdd ? 'text-primary' : ''
                      }`}
                    >
                      {row.odd.toFixed(2)}
                      {isCustomOdd && (
                        <span className="ml-1 text-xs opacity-60" title="Odd editada">
                          *
                        </span>
                      )}
                    </td>
                    <td className="text-right font-semibold tabular-nums">{formatCurrency(row.investment)}</td>
                    <td className="text-right font-bold text-primary tabular-nums">{formatCurrency(row.return)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Edição de Odds */}
      <LeverageOddsEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveOdds}
        defaultOdd={odd}
        days={days}
        currentOdds={customOdds || undefined}
      />

      {/* Resumo */}
      {progression.length > 0 && (
        <div className="mt-4 p-4 rounded-xl bg-primary/10 border border-primary/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs opacity-60 uppercase font-bold mb-1">Investimento Inicial</p>
              <p className="text-lg font-black">{formatCurrency(initialInvestment)}</p>
            </div>
            <div>
              <p className="text-xs opacity-60 uppercase font-bold mb-1">Retorno Final (Dia {days})</p>
              <p className="text-lg font-black text-primary">
                {formatCurrency(progression[progression.length - 1]?.return || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs opacity-60 uppercase font-bold mb-1">Lucro Total</p>
              <p className="text-lg font-black text-success">
                {formatCurrency((progression[progression.length - 1]?.return || 0) - initialInvestment)}
              </p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default LeverageProgressionTable;

