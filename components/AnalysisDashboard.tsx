import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AnalysisResult, MatchData, BetInfo, BankSettings, SelectedBet, SavedAnalysis } from '../types';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import BetManager from './BetManager';
import ProbabilityGauge from './ProbabilityGauge';
import MetricCard from './MetricCard';
import { getCurrencySymbol } from '../utils/currency';
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
  const showStatsPanel = !splitMode || analysisUiTab === 'stats';
  const showVerdictPanel = !splitMode || analysisUiTab === 'verdict';

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

  const statsSection = (
    <div
      className={cn('min-w-0', splitMode && !showStatsPanel && 'hidden')}
      aria-hidden={splitMode && !showStatsPanel}
    >
      <div className="mb-6 grid min-w-0 grid-cols-1 gap-3 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          title={
            <span className="inline-flex items-center gap-0.5 flex-wrap">
              Mais de {overLine} gols
              <TooltipHint tip="Chance estimada de sair mais gols que a linha (Over), com base no modelo." label="Ajuda Over" />
            </span>
          }
          value={`${result.overUnderProbabilities?.[overLine]?.over.toFixed(1) ?? '-'}%`}
          icon={TrendingUp}
          color="success"
        />
        <MetricCard
          title={
            <span className="inline-flex items-center gap-0.5 flex-wrap">
              Menos de {underLine} gols
              <TooltipHint tip="Chance estimada de sair menos gols que a linha (Under)." label="Ajuda Under" />
            </span>
          }
          value={`${result.overUnderProbabilities?.[underLine]?.under.toFixed(1) ?? '-'}%`}
          icon={TrendingDown}
          color="error"
        />
        <MetricCard
          title={
            <span className="inline-flex items-center gap-0.5 flex-wrap">
              Ambas marcam (BTTS)
              <TooltipHint tip={bttsTip} label="Ajuda BTTS" />
            </span>
          }
          value={result.bttsProbability != null ? `${result.bttsProbability.toFixed(1)}%` : '—'}
          icon={Sparkles}
          color="accent"
        />
        <MetricCard
          title={
            <span className="inline-flex items-center gap-0.5 flex-wrap">
              Edge (pontos %)
              <TooltipHint
                tip="Diferença entre a probabilidade do modelo e a implícita na odd da casa (após margem). Valores positivos sugerem possível valor."
                label="Ajuda Edge"
              />
            </span>
          }
          value={edgePp == null ? '—' : `${edgePp >= 0 ? '+' : ''}${edgePp.toFixed(1)}pp`}
          icon={TrendingUp}
          color={edgePp == null ? 'warning' : edgePp >= 0 ? 'success' : 'error'}
        />
        <MetricCard
          title={
            <span className="inline-flex items-center gap-0.5 flex-wrap">
              Índice de Confiança Baseado em Forma Recente
              <TooltipHint
                tip="Mede alinhamento entre os últimos jogos e as médias ponderadas, e estabilidade dos totais de gols. Mais alto = forma recente mais coerente com o histórico."
                label="Ajuda índice de forma"
              />
            </span>
          }
          value={
            result.recentFormConfidenceIndex != null
              ? `${result.recentFormConfidenceIndex}`
              : '—'
          }
          icon={Sparkles}
          color="accent"
        />
      </div>

      {(hasCombinedOU || hasStatsOU || hasTableOU) && (
        <motion.div
          className="card min-w-0 border border-base-300/50 bg-base-100 p-4 shadow-sm md:p-6"
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
        >
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
                <div key={line} className="card min-w-0 bg-base-200 p-3">
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
        </motion.div>
      )}
    </div>
  );

  const verdictSection = (
    <div
      className={cn('min-w-0', splitMode && !showVerdictPanel && 'hidden')}
      aria-hidden={splitMode && !showVerdictPanel}
    >
      <div className="flex min-w-0 flex-col gap-6 md:gap-8">
        <motion.div
          className={cn(
            'card min-w-0 border-4 bg-gradient-to-br from-primary/20 via-base-100 to-base-100 p-6 text-center transition-shadow duration-300 md:p-10',
            evSemaphoreFrame
          )}
          variants={animations.scaleIn}
          initial="initial"
          animate="animate"
        >
          <p className="text-sm font-bold text-base-content/80 uppercase tracking-wide mb-2 flex flex-wrap items-center justify-center gap-1">
            Resultado principal — {displayLabel}
            <TooltipHint
              tip="Probabilidade: chance estimada pelo modelo para este mercado (Over/Under), com base nos dados do jogo. Não é previsão certa de placar."
              label="Ajuda probabilidade"
            />
          </p>
          <p className="text-5xl md:text-6xl font-black text-primary tabular-nums leading-none">
            {displayProbability.toFixed(1)}
            <span className="text-3xl md:text-4xl align-top">%</span>
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className={`badge ${verdictUi.badgeClass} badge-lg font-bold border-2`}>{verdictUi.label}</span>
            <span
              className={`badge badge-lg font-bold border-2 ${displayRiskLevel === 'Baixo' ? 'badge-success badge-outline' : displayRiskLevel === 'Moderado' ? 'badge-warning badge-outline' : 'badge-error badge-outline'}`}
            >
              <AlertCircle className="w-4 h-4 mr-1 inline" aria-hidden />
              Risco {displayRiskLevel}
            </span>
          </div>
          <p className="text-xs text-base-content/70 mt-3 max-w-md mx-auto font-medium">
            Estimativa do modelo (Poisson + dados). Não é garantia de resultado.
          </p>
          <p
            className={cn(
              'mt-3 text-sm font-black tabular-nums',
              displayEv > 0 ? 'text-success' : displayEv < 0 ? 'text-error' : 'text-warning'
            )}
          >
            EV com esta odd: {displayEv > 0 ? '+' : ''}
            {displayEv.toFixed(1)}%
            <TooltipHint
              tip="EV verde = modelo vê valor na odd; vermelho = odd abaixo do que o modelo sugere; amarelo = neutro."
              label="Semáforo EV"
            />
          </p>
          {kellyBankPercent != null && (
            <p className="mt-2 text-xs text-base-content/80 max-w-md mx-auto flex flex-wrap items-center justify-center gap-2">
              <span>
                Sugestão Kelly (¼ + teto 10%, ajustada pela confiança):{' '}
                <span className="font-bold tabular-nums">
                  {kellyBankPercent > 0 ? `${kellyBankPercent.toFixed(2)}%` : '0%'}
                </span>{' '}
                da banca
              </span>
              {kellyDashboardLevel && (
                <span
                  className={`badge badge-sm font-bold ${
                    kellyDashboardLevel === 'Alto'
                      ? 'badge-success'
                      : kellyDashboardLevel === 'Médio'
                        ? 'badge-warning'
                        : 'badge-ghost border border-base-content/25'
                  }`}
                >
                  Confiança Kelly: {kellyDashboardLevel}
                </span>
              )}
              <TooltipHint
                tip="O Kelly integral costuma ser agressivo; aqui usamos Kelly fracionário (25%) e teto de 10% da banca, ponderado pelo score de confiança do modelo. O selo Baixo/Médio/Alto reflete a força do Kelly integral (edge). Valor orientativo."
                label="Ajuda Kelly"
              />
            </p>
          )}
        </motion.div>

        <div className="grid min-w-0 grid-cols-1 gap-6 md:gap-8 xl:grid-cols-3">
          <motion.div
            className="origin-top min-w-0 scale-[0.99] opacity-90 xl:col-span-1"
            variants={animations.scaleIn}
            initial="initial"
            animate="animate"
          >
            <ProbabilityGauge
              probability={primaryProb}
              selectedProbability={displayProbability}
              selectedLabel={displayLabel}
              odd={data.oddOver15}
              ev={displayEv}
              onOddChange={onOddChange}
            />
          </motion.div>
          <motion.div
            className="card min-w-0 border border-base-content/12 bg-base-100 p-4 shadow-sm md:p-6 xl:col-span-2"
            variants={animations.slideInRight}
            initial="initial"
            animate="animate"
          >
            <div className="flex flex-col gap-4 md:gap-6">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight text-base-content">
                    {data.homeTeam} <span className="text-primary/70 mx-1">vs</span> {data.awayTeam}
                  </h3>
                  <p className="text-xs sm:text-sm font-semibold text-base-content/70 uppercase tracking-wide">
                    Veredito e valor esperado (EV)
                    <TooltipHint
                      tip="EV (valor esperado): quanto o modelo sugere de retorno médio por unidade apostada nesta odd, usando a probabilidade exibida."
                      label="Ajuda EV"
                    />
                  </p>
                </div>
                <div className="flex flex-row sm:flex-col items-start sm:items-end gap-3 w-full sm:w-auto">
                  {onSave && (
                    <button
                      type="button"
                      onClick={() => onSave(selectedBets.length > 0 ? selectedBets : undefined)}
                      className="btn btn-primary btn-md shadow-lg w-full sm:w-auto"
                    >
                      Salvar análise
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 card bg-base-200 border-l-4 border-primary/60">
                <p className="text-xs font-bold text-base-content/60 uppercase mb-1">Recomendação</p>
                <p className="text-sm md:text-base text-base-content/95 leading-relaxed">&ldquo;{result.recommendation}&rdquo;</p>
              </div>
            </div>
          </motion.div>
        </div>

        {onBetSave && (
          <div className="card min-w-0 border border-base-content/12 bg-base-100 p-4 shadow-sm md:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-black text-base-content">Sua aposta</h3>
              {!showBetManager && (
                <button
                  type="button"
                  onClick={() => setShowBetManager(true)}
                  className="btn btn-primary btn-sm min-h-[2.75rem] w-full sm:w-auto"
                >
                  {betInfo?.betAmount > 0 ? 'Editar' : 'Registrar aposta'}
                </button>
              )}
            </div>
            {showBetManager ? (
              <BetManager
                odd={data.oddOver15 || 0}
                probability={displayProbability}
                betInfo={betInfo}
                bankSettings={bankSettings}
                onSave={(newBetInfo) => {
                  onBetSave(newBetInfo);
                  setShowBetManager(false);
                }}
                onError={onError}
                onCancel={() => setShowBetManager(false)}
              />
            ) : betInfo?.betAmount > 0 ? (
              <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 md:grid-cols-3 md:gap-4">
                <div>
                  <div className="text-xs font-bold text-base-content/70">Status</div>
                  <div
                    className={`badge ${betInfo.status === 'won' ? 'badge-success' : betInfo.status === 'lost' ? 'badge-error' : 'badge-warning'}`}
                  >
                    {betInfo.status}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-base-content/70">Apostado</div>
                  <div className="font-bold text-base-content">
                    {getCurrencySymbol(bankSettings?.currency)}
                    {betInfo.betAmount.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-base-content/70">Retorno</div>
                  <div
                    className={`font-bold ${betInfo.status === 'won' ? 'text-success' : betInfo.status === 'lost' ? 'text-error' : 'text-primary'}`}
                  >
                    {betInfo.status === 'won'
                      ? `+${betInfo.potentialProfit.toFixed(2)}`
                      : betInfo.status === 'lost'
                        ? `-${betInfo.betAmount.toFixed(2)}`
                        : betInfo.potentialReturn.toFixed(2)}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-base-content/70">Nenhuma aposta registrada para esta análise.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (!splitMode) {
    return (
      <motion.div
        className="flex min-w-0 flex-col gap-6 md:gap-8"
        variants={animations.fadeInUp}
        initial="initial"
        animate="animate"
      >
        {verdictSection}
        {statsSection}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex min-w-0 flex-col gap-6 md:gap-8"
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
    >
      {statsSection}
      {verdictSection}
    </motion.div>
  );
};

export default AnalysisDashboard;
