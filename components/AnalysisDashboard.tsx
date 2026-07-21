import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AnalysisResult, MatchData, BetInfo, BankSettings, SelectedBet, SavedAnalysis } from '../types';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Calculator,
  Zap,
  Shield,
  Target,
  Sparkles,
} from 'lucide-react';
import BetManager from './BetManager';
import ProbabilityGauge from './ProbabilityGauge';
import MetricCard from './MetricCard';
import OverUnderGrid from './analysis/OverUnderGrid';
import BetSummaryCard from './analysis/BetSummaryCard';
import { animations } from '../utils/animations';
import { getPrimaryProbability } from '../utils/probability';
import { getEdgePp, calculateEVPercent } from '../utils/betMetrics';
import {
  fractionalKellyBankFraction,
  DEFAULT_FRACTIONAL_KELLY,
  kellyConfidenceLevelPt,
  type KellyConfidenceLevelPt,
} from '../utils/bankCalculations';
import { calculateSelectedBetsProbability } from '../utils/betRange';
import { getRiskLevelFromProbability } from '../utils/risk';
import { getBothGoalsTooltip } from '../utils/probabilityTooltips';
import { getOver15VerdictLabel } from './analysis/over15VerdictUi';
import { cn } from '../utils/cn';
import { getBetDisplayFinancials } from '../utils/betFinancials';

export type AnalysisUiTab = 'dados' | 'stats' | 'verdict';

interface AnalysisDashboardProps {
  result: AnalysisResult;
  data: MatchData;
  onSave?: (selectedBets?: SelectedBet[]) => void;
  betInfo?: BetInfo;
  bankSettings?: BankSettings;
  savedMatches?: SavedAnalysis[];
  onBetSave?: (betInfo: BetInfo) => void;
  onError?: (message: string) => void;
  isUpdatingBetStatus?: boolean;
  onOddChange?: (odd: number) => void;
  initialSelectedBets?: SelectedBet[];
  onAnalyzeResult: (match: SavedAnalysis) => void;
  savedMatch: SavedAnalysis | null;
  /** Quando definido pelo modal com abas: controla o que é exibido mantendo um único estado. */
  analysisUiTab?: AnalysisUiTab;
}

function TooltipHint({ tip, label }: { tip: string; label?: string }) {
  return (
    <span className="tooltip tooltip-top inline-flex items-center align-middle ml-0.5" data-tip={tip}>
      <HelpCircle className="w-3.5 h-3.5 text-base-content/40 cursor-help shrink-0" aria-label={label || 'Ajuda'} />
    </span>
  );
}

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
  result,
  data,
  onSave,
  betInfo,
  bankSettings,
  onBetSave,
  onError,
  isUpdatingBetStatus: _isUpdatingBetStatus = false,
  onOddChange,
  initialSelectedBets,
  savedMatch: _savedMatch,
  analysisUiTab,
  onAnalyzeResult,
}) => {
  void onAnalyzeResult;
  void _isUpdatingBetStatus;
  void _savedMatch;
  const [showBetManager, setShowBetManager] = useState(false);
  const [selectedBets, setSelectedBets] = useState<SelectedBet[]>(initialSelectedBets || []);
  const [overUnderTab, setOverUnderTab] = useState<'combined' | 'stats' | 'table'>('combined');

  const splitMode = analysisUiTab !== undefined;

  useEffect(() => {
    if (initialSelectedBets) {
      setSelectedBets(initialSelectedBets);
    }
  }, [initialSelectedBets]);

  const primaryProb = getPrimaryProbability(result);
  const hasCombinedOU = !!result.overUnderProbabilities && Object.keys(result.overUnderProbabilities).length > 0;
  const hasStatsOU = !!result.statsOverUnderProbabilities && Object.keys(result.statsOverUnderProbabilities).length > 0;
  const hasTableOU = !!result.tableOverUnderProbabilities && Object.keys(result.tableOverUnderProbabilities).length > 0;

  useEffect(() => {
    if (!hasCombinedOU && !hasStatsOU && !hasTableOU) return;
    if (overUnderTab === 'combined' && !hasCombinedOU) setOverUnderTab(hasStatsOU ? 'stats' : 'table');
    else if (overUnderTab === 'stats' && !hasStatsOU) setOverUnderTab(hasCombinedOU ? 'combined' : 'table');
    else if (overUnderTab === 'table' && !hasTableOU) setOverUnderTab(hasCombinedOU ? 'combined' : 'stats');
  }, [overUnderTab, hasCombinedOU, hasStatsOU, hasTableOU]);

  const displayProbability = useMemo(
    () => calculateSelectedBetsProbability(selectedBets, result.overUnderProbabilities) ?? primaryProb,
    [selectedBets, result.overUnderProbabilities, primaryProb]
  );
  const displayLabel = useMemo(() => {
    if (selectedBets.length === 1)
      return `${selectedBets[0].type === 'over' ? 'Over' : 'Under'} ${selectedBets[0].line}`;
    if (selectedBets.length === 2)
      return `${selectedBets[0].type === 'over' ? 'Over' : 'Under'} ${selectedBets[0].line} + ${selectedBets[1].type === 'over' ? 'Over' : 'Under'} ${selectedBets[1].line}`;
    return 'Over 1.5';
  }, [selectedBets]);

  const displayEv = useMemo(
    () =>
      data.oddOver15 && data.oddOver15 > 1
        ? calculateEVPercent(displayProbability, data.oddOver15)
        : result.ev,
    [displayProbability, data.oddOver15, result.ev]
  );

  const betSummaryMoney = useMemo(() => {
    if (!betInfo || betInfo.betAmount <= 0) return null;
    return getBetDisplayFinancials({ id: '_', timestamp: 0, data, result, betInfo });
  }, [betInfo, data.oddOver15, data, result]);
  const kellyBankPercent = useMemo(() => {
    if (!data.oddOver15 || data.oddOver15 <= 1) return null;
    const frac = fractionalKellyBankFraction(
      displayProbability,
      data.oddOver15,
      DEFAULT_FRACTIONAL_KELLY,
      result.confidenceScore / 100
    );
    return frac * 100;
  }, [displayProbability, data.oddOver15, result.confidenceScore]);
  const kellyDashboardLevel: KellyConfidenceLevelPt | null = useMemo(() => {
    if (!data.oddOver15 || data.oddOver15 <= 1) return null;
    return kellyConfidenceLevelPt(displayProbability, data.oddOver15);
  }, [displayProbability, data.oddOver15]);
  const edgePp = useMemo(
    () => (data.oddOver15 > 1 ? getEdgePp(displayProbability, data.oddOver15, 0.06) : null),
    [displayProbability, data.oddOver15]
  );
  const displayRiskLevel = useMemo(() => getRiskLevelFromProbability(displayProbability), [displayProbability]);
  const verdictUi = useMemo(() => getOver15VerdictLabel(displayProbability), [displayProbability]);

  const evSemaphoreFrame = useMemo(() => {
    if (displayEv > 0) return 'border-success/60 ring-2 ring-success/25 shadow-lg shadow-success/5';
    if (displayEv < 0) return 'border-error/60 ring-2 ring-error/25 shadow-lg shadow-error/5';
    return 'border-warning/50 ring-1 ring-warning/25 shadow-md';
  }, [displayEv]);


  const bttsTip = useMemo(() => {
    const full = getBothGoalsTooltip({ hasRange: selectedBets.length === 2 });
    return full.length > 180 ? `${full.slice(0, 177)}…` : full;
  }, [selectedBets.length]);

  const handleBetClick = (line: string, type: 'over' | 'under', probability: number) => {
    const newBet: SelectedBet = { line, type, probability };
    const isSelected = selectedBets.some((b) => b.line === line && b.type === type);
    if (isSelected) {
      setSelectedBets(selectedBets.filter((b) => !(b.line === line && b.type === type)));
    } else {
      if (selectedBets.length >= 2) return;
      if (selectedBets.some((b) => b.type === type)) {
        setSelectedBets(selectedBets.map((b) => (b.type === type ? newBet : b)));
      } else {
        setSelectedBets([...selectedBets, newBet]);
      }
    }
  };

  const isBetSelected = (line: string, type: 'over' | 'under') =>
    selectedBets.some((b) => b.line === line && b.type === type);

  const overLine = selectedBets.find((b) => b.type === 'over')?.line ?? '1.5';
  const underLine = selectedBets.find((b) => b.type === 'under')?.line ?? '1.5';

  if (analysisUiTab === 'dados') {
    return null;
  }

  const lineProbabilitiesCardShell =
    'card min-w-0 border border-base-300/50 bg-base-100 p-4 shadow-sm md:p-6';

  const lineProbabilitiesCardContent = (
    <>
      <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="min-w-0 text-lg font-black text-base-content">Probabilidades por linha</h3>
        <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]">
          <div className="tabs tabs-boxed tabs-sm inline-flex w-max shrink-0 flex-nowrap">
            {hasCombinedOU && (
              <button
                type="button"
                onClick={() => setOverUnderTab('combined')}
                className={`tab ${overUnderTab === 'combined' ? 'tab-active' : ''}`}
              >
                Combinada
              </button>
            )}
            {hasStatsOU && (
              <button
                type="button"
                onClick={() => setOverUnderTab('stats')}
                className={`tab ${overUnderTab === 'stats' ? 'tab-active' : ''}`}
              >
                Estatísticas
              </button>
            )}
            {hasTableOU && (
              <button
                type="button"
                onClick={() => setOverUnderTab('table')}
                className={`tab ${overUnderTab === 'table' ? 'tab-active' : ''}`}
              >
                Tabela
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-2 xs:grid-cols-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
        {['0.5', '1.5', '2.5', '3.5', '4.5', '5.5'].map((line) => {
          const prob =
            overUnderTab === 'combined'
              ? result.overUnderProbabilities?.[line]
              : overUnderTab === 'stats'
                ? result.statsOverUnderProbabilities?.[line]
                : result.tableOverUnderProbabilities?.[line];
          if (!prob) return null;
          const isInteractive = overUnderTab === 'combined';
          return (
            <div key={line} className="custom-card min-w-0 p-3 shadow-inner">
              <div className="text-xs font-bold text-base-content/70 mb-2">Linha {line} gols</div>
              <div
                role={isInteractive ? 'button' : undefined}
                tabIndex={isInteractive ? 0 : undefined}
                onClick={isInteractive ? () => handleBetClick(line, 'over', prob.over) : undefined}
                onKeyDown={
                  isInteractive
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleBetClick(line, 'over', prob.over);
                        }
                      }
                    : undefined
                }
                className={`flex justify-between p-2 rounded-lg ${isInteractive ? 'cursor-pointer' : ''} ${isBetSelected(line, 'over') ? 'bg-success/20' : 'hover:bg-base-300/50'}`}
              >
                <span className="text-xs font-semibold text-success">Mais (Over)</span>
                <span className="text-sm font-black text-base-content">{prob.over.toFixed(1)}%</span>
              </div>
              <div
                role={isInteractive ? 'button' : undefined}
                tabIndex={isInteractive ? 0 : undefined}
                onClick={isInteractive ? () => handleBetClick(line, 'under', prob.under) : undefined}
                onKeyDown={
                  isInteractive
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleBetClick(line, 'under', prob.under);
                        }
                      }
                    : undefined
                }
                className={`flex justify-between p-2 rounded-lg ${isInteractive ? 'cursor-pointer' : ''} ${isBetSelected(line, 'under') ? 'bg-error/20' : 'hover:bg-base-300/50'}`}
              >
                <span className="text-xs font-semibold text-error">Menos (Under)</span>
                <span className="text-sm font-black text-base-content">{prob.under.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

      {/* Probabilidades Over/Under por Linha */}
      {(result.overUnderProbabilities || result.tableOverUnderProbabilities || result.statsOverUnderProbabilities) && (
        <OverUnderGrid
          result={result}
          overUnderTab={overUnderTab}
          onTabChange={setOverUnderTab}
          selectedBets={selectedBets}
          onBetClick={handleBetClick}
          isBetSelected={isBetSelected}
          hasCombinedOU={hasCombinedOU}
          hasStatsOU={hasStatsOU}
          hasTableOU={hasTableOU}
          onClearSelection={() => setSelectedBets([])}
          displayLabel={displayLabel}
          displayProbability={displayProbability}
        />
      )}

        <div
          className={cn(
            'grid min-h-0 min-w-0 items-start gap-6 overflow-x-clip',
            splitMode
              ? 'grid-cols-1'
              : 'grid-cols-1 md:grid-cols-2 md:gap-8 lg:grid-cols-3'
          )}
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-success" />
            <h3 className="text-lg font-black uppercase tracking-tight">
              Combinações Recomendadas (Over E Under ≥ 75%)
            </h3>
          </div>
          <div className="space-y-3">
            {result.recommendedCombinations
              .sort((a, b) => b.combinedProb - a.combinedProb)
              .map((combo, index) => (
                <div
                  key={index}
                  className="surface-muted p-4 rounded-xl border border-success/30 bg-success/5"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="text-sm font-black mb-1">
                        Over {combo.overLine} ({combo.overProb.toFixed(1)}%) E Under{' '}
                        {combo.underLine} ({combo.underProb.toFixed(1)}%)
                      </div>
                      <div className="text-xs opacity-70">
                        Probabilidade Combinada: <span className="font-bold">{combo.combinedProb.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="badge badge-success badge-lg font-black">
                      {combo.combinedProb.toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </motion.div>
      )}

      {/* Seção de Aposta - Design Moderno e Compacto */}
      {onBetSave && (
        <div>
          {!showBetManager ? (
            <BetSummaryCard
              betInfo={betInfo!}
              bankSettings={bankSettings}
              odd={data.oddOver15 || 0}
              probability={displayProbability}
              onToggleEditor={() => setShowBetManager(true)}
              onUpdateBetStatus={
                onBetSave
                  ? (status) => {
                      const updatedBetInfo: BetInfo = {
                        ...betInfo!,
                        status,
                        resultAt: Date.now(),
                      };
                      onBetSave(updatedBetInfo);
                    }
                  : undefined
              }
              isUpdatingBetStatus={isUpdatingBetStatus}
              onAnalyzeResult={onAnalyzeResult && savedMatch ? () => onAnalyzeResult(savedMatch) : undefined}
              savedMatch={savedMatch}
            />
          ) : (
            <BetManager
              odd={data.oddOver15 || 0}
              probability={displayProbability}
              betInfo={betInfo}
              bankSettings={bankSettings}
              savedMatches={savedMatches}
              onSave={(newBetInfo) => {
                onBetSave(newBetInfo);
                setShowBetManager(false);
              }}
              onError={onError}
              onCancel={() => setShowBetManager(false)}
            />
          )}
        </div>
      </div>
    </div>
  );

  if (!splitMode) {
    return (
      <motion.div
        className="flex min-h-0 min-w-0 w-full flex-col gap-6 md:gap-8"
        variants={animations.fadeInUp}
        initial="initial"
        animate="animate"
      >
        {verdictSection}
        {statsSection}
      </motion.div>
    );
  }

  /* Sem motion no wrapper no modal: fadeInUp usa translateY e o layout não reserva altura → overlap com blocos abaixo */
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-col gap-6 md:gap-8">
      {analysisUiTab === 'stats' ? statsSection : verdictSection}
    </div>
  );
};

export default AnalysisDashboard;
