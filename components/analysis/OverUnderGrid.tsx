import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { AnalysisResult, SelectedBet } from '../../types';
import { animations } from '../../utils/animations';

interface OverUnderGridProps {
  result: AnalysisResult;
  overUnderTab: 'combined' | 'stats' | 'table';
  onTabChange: (tab: 'combined' | 'stats' | 'table') => void;
  selectedBets: SelectedBet[];
  onBetClick: (line: string, type: 'over' | 'under', probability: number) => void;
  isBetSelected: (line: string, type: 'over' | 'under') => boolean;
  hasCombinedOU: boolean;
  hasStatsOU: boolean;
  hasTableOU: boolean;
  onClearSelection: () => void;
  displayLabel: string;
  displayProbability: number;
}

const OverUnderGrid: React.FC<OverUnderGridProps> = ({
  result,
  overUnderTab,
  onTabChange,
  selectedBets,
  onBetClick,
  isBetSelected,
  hasCombinedOU,
  hasStatsOU,
  hasTableOU,
  onClearSelection,
  displayLabel,
  displayProbability,
}) => {
  return (
    <motion.div
      className="surface surface-hover p-4 md:p-6"
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-black uppercase tracking-tight">Probabilidades Over/Under</h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
          <div role="tablist" className="tabs tabs-boxed tabs-sm">
            {hasCombinedOU && (
              <button
                type="button"
                role="tab"
                className={`tab ${overUnderTab === 'combined' ? 'tab-active' : ''}`}
                onClick={() => onTabChange('combined')}
              >
                Combinada
              </button>
            )}
            {hasStatsOU && (
              <button
                type="button"
                role="tab"
                className={`tab ${overUnderTab === 'stats' ? 'tab-active' : ''}`}
                onClick={() => onTabChange('stats')}
              >
                Estatísticas
              </button>
            )}
            {hasTableOU && (
              <button
                type="button"
                role="tab"
                className={`tab ${overUnderTab === 'table' ? 'tab-active' : ''}`}
                onClick={() => onTabChange('table')}
              >
                Tabela
              </button>
            )}
          </div>

          {selectedBets.length > 0 && (
            <button
              type="button"
              onClick={onClearSelection}
              className="btn btn-ghost btn-xs text-error"
              title="Limpar seleção"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {overUnderTab !== 'combined' && (
        <div className="text-xs opacity-70 mb-3 leading-relaxed">
          Somente leitura. Use a aba <span className="font-bold">Combinada</span> para selecionar
          apostas.
        </div>
      )}

      {overUnderTab === 'combined' && selectedBets.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs font-semibold opacity-70">
            Seleção ativa:{' '}
            <span className="font-black text-primary">{displayLabel}</span>
          </div>
          <div className="text-xs font-semibold opacity-70">
            Prob.: <span className="font-black">{displayProbability.toFixed(1)}%</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3 lg:gap-4">
        {['0.5', '1.5', '2.5', '3.5', '4.5', '5.5'].map((line) => {
          const prob =
            overUnderTab === 'combined'
              ? result.overUnderProbabilities?.[line]
              : overUnderTab === 'stats'
                ? result.statsOverUnderProbabilities?.[line]
                : result.tableOverUnderProbabilities?.[line];

          if (!prob) return null;

          const interactive = overUnderTab === 'combined';
          const isOverSelected = interactive && isBetSelected(line, 'over');
          const isUnderSelected = interactive && isBetSelected(line, 'under');
          const rowBase = 'flex items-center justify-between p-2 rounded-lg border-2 transition-all';

          return (
            <div
              key={`${overUnderTab}-${line}`}
              className="surface-muted p-3 md:p-4 rounded-xl border border-base-300/60"
            >
              <div className="text-xs font-bold opacity-70 uppercase tracking-wide mb-2">
                Linha {line}
              </div>

              <div className="space-y-2">
                <div
                  onClick={interactive ? () => onBetClick(line, 'over', prob.over) : undefined}
                  className={`${rowBase} ${
                    interactive
                      ? isOverSelected
                        ? 'bg-success/20 border-success shadow-lg scale-[1.02] cursor-pointer'
                        : 'border-transparent hover:bg-base-300/50 cursor-pointer'
                      : 'bg-base-300/20 border-transparent cursor-default'
                  }`}
                  title={
                    interactive ? (isOverSelected ? 'Clique para desmarcar' : 'Clique para selecionar') : undefined
                  }
                >
                  <span className="text-xs font-semibold text-success">Over</span>
                  <span className="text-sm font-black">{prob.over.toFixed(1)}%</span>
                </div>

                <div
                  onClick={interactive ? () => onBetClick(line, 'under', prob.under) : undefined}
                  className={`${rowBase} ${
                    interactive
                      ? isUnderSelected
                        ? 'bg-error/20 border-error shadow-lg scale-[1.02] cursor-pointer'
                        : 'border-transparent hover:bg-base-300/50 cursor-pointer'
                      : 'bg-base-300/20 border-transparent cursor-default'
                  }`}
                  title={
                    interactive ? (isUnderSelected ? 'Clique para desmarcar' : 'Clique para selecionar') : undefined
                  }
                >
                  <span className="text-xs font-semibold text-error">Under</span>
                  <span className="text-sm font-black">{prob.under.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default OverUnderGrid;
