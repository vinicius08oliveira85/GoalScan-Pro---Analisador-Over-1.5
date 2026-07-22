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
import { getEdgePp } from '../utils/betMetrics';
import { calculateSelectedBetsProbability } from '../utils/betRange';
import { getRiskLevelFromProbability } from '../utils/risk';
import {
  getEdgeTooltip,
  calculateDataQuality,
  getMarketOverTooltip,
  getMarketUnderTooltip,
  getBothGoalsTooltip,
} from '../utils/probabilityTooltips';

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
  initialSelectedBets?: SelectedBet[]; // Apostas selecionadas salvas (para restaurar ao carregar partida)
}

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
  result,
  data,
  onSave,
  betInfo,
  bankSettings,
  savedMatches,
  onBetSave,
  onError,
  isUpdatingBetStatus = false,
  onOddChange,
  initialSelectedBets,
  onAnalyzeResult,
  savedMatch,
}) => {
  const [showBetManager, setShowBetManager] = useState(false);
  const [selectedBets, setSelectedBets] = useState<SelectedBet[]>(initialSelectedBets || []);
  const [overUnderTab, setOverUnderTab] = useState<'combined' | 'stats' | 'table'>('combined');
  
  // Restaurar apostas selecionadas quando initialSelectedBets mudar
  useEffect(() => {
    if (initialSelectedBets) {
      setSelectedBets(initialSelectedBets);
    }
  }, [initialSelectedBets]);
  const primaryProb = getPrimaryProbability(result);

  const hasCombinedOU =
    !!result.overUnderProbabilities && Object.keys(result.overUnderProbabilities).length > 0;
  const hasStatsOU =
    !!result.statsOverUnderProbabilities &&
    Object.keys(result.statsOverUnderProbabilities).length > 0;
  const hasTableOU =
    !!result.tableOverUnderProbabilities &&
    Object.keys(result.tableOverUnderProbabilities).length > 0;
  const hasAnyOU = hasCombinedOU || hasStatsOU || hasTableOU;

  // Garantir que a aba atual exista quando o resultado mudar
  useEffect(() => {
    if (!hasAnyOU) return;

    if (overUnderTab === 'combined' && !hasCombinedOU) {
      setOverUnderTab(hasStatsOU ? 'stats' : 'table');
      return;
    }
    if (overUnderTab === 'stats' && !hasStatsOU) {
      setOverUnderTab(hasCombinedOU ? 'combined' : 'table');
      return;
    }
    if (overUnderTab === 'table' && !hasTableOU) {
      setOverUnderTab(hasCombinedOU ? 'combined' : hasStatsOU ? 'stats' : 'combined');
    }
  }, [overUnderTab, hasAnyOU, hasCombinedOU, hasStatsOU, hasTableOU]);

  // Probabilidade exibida no gauge (seleção ou padrão)
  const displayProbability = useMemo(() => {
    const selected = calculateSelectedBetsProbability(selectedBets, result.overUnderProbabilities);
    return selected ?? primaryProb;
  }, [selectedBets, result.overUnderProbabilities, primaryProb]);

  // Calcular label descritivo para a probabilidade exibida
  const displayLabel = useMemo(() => {
    if (selectedBets.length === 1) {
      const bet = selectedBets[0];
      return `${bet.type === 'over' ? 'Over' : 'Under'} ${bet.line}`;
    } else if (selectedBets.length === 2) {
      const bet1 = selectedBets[0];
      const bet2 = selectedBets[1];
      return `${bet1.type === 'over' ? 'Over' : 'Under'} ${bet1.line} + ${bet2.type === 'over' ? 'Over' : 'Under'} ${bet2.line}`;
    }
    return 'Over 1.5';
  }, [selectedBets]);

  // Calcular EV com a probabilidade que está sendo exibida
  const displayEv = useMemo(() => {
    if (data.oddOver15 && data.oddOver15 > 1) {
      return ((displayProbability / 100) * data.oddOver15 - 1) * 100;
    }
    return result.ev; // Fallback para EV do resultado se não houver odd
  }, [displayProbability, data.oddOver15, result.ev]);

  // Quando houver seleção, Edge/Risco também devem seguir a probabilidade selecionada.
  // Usando margem padrão de 6% (típica de casas de apostas)
  const edgePp = useMemo(() => {
    if (data.oddOver15 && data.oddOver15 > 1) {
      return getEdgePp(displayProbability, data.oddOver15, 0.06);
    }
    return null;
  }, [displayProbability, data.oddOver15]);

  const displayRiskLevel = useMemo(
    () => getRiskLevelFromProbability(displayProbability),
    [displayProbability]
  );

  const selectedOverLine = useMemo(
    () => selectedBets.find((b) => b.type === 'over')?.line ?? '1.5',
    [selectedBets]
  );
  const selectedUnderLine = useMemo(
    () => selectedBets.find((b) => b.type === 'under')?.line ?? '1.5',
    [selectedBets]
  );
  const selectedRangeProbability = useMemo(() => {
    if (selectedBets.length !== 2) return null;
    return calculateSelectedBetsProbability(selectedBets, result.overUnderProbabilities);
  }, [selectedBets, result.overUnderProbabilities]);

  const formTrend = result.advancedMetrics.formTrend;
  const isTrendNeutral = Math.abs(formTrend) < 0.5;
  const trendLabel = isTrendNeutral ? 'NEUTRO' : formTrend > 0 ? 'SUBINDO' : 'CAINDO';
  const trendColor = isTrendNeutral ? 'warning' : formTrend > 0 ? 'success' : 'error';
  const trendDir = isTrendNeutral ? 'neutral' : formTrend > 0 ? 'up' : 'down';
  const trendValue = isTrendNeutral ? '≈0' : `${formTrend > 0 ? '+' : ''}${formTrend.toFixed(1)}`;
  const trendIcon = isTrendNeutral ? Target : formTrend > 0 ? TrendingUp : TrendingDown;

  // Função para lidar com clique em uma aposta
  const handleBetClick = (line: string, type: 'over' | 'under', probability: number) => {
    const newBet: SelectedBet = { line, type, probability };
    
    // Verificar se a aposta já está selecionada
    const isAlreadySelected = selectedBets.some(
      (bet) => bet.line === line && bet.type === type
    );

    if (isAlreadySelected) {
      // Se já está selecionada, desmarcar
      setSelectedBets(selectedBets.filter((bet) => !(bet.line === line && bet.type === type)));
      return;
    }

    // Verificar se já há 2 apostas selecionadas
    if (selectedBets.length >= 2) {
      // Se já há 2 apostas, verificar se podemos substituir
      const hasOver = selectedBets.some((bet) => bet.type === 'over');
      const hasUnder = selectedBets.some((bet) => bet.type === 'under');

      // Se estamos tentando adicionar um tipo que já existe, substituir
      if (type === 'over' && hasOver) {
        setSelectedBets([selectedBets.find((bet) => bet.type === 'under')!, newBet]);
        return;
      }
      if (type === 'under' && hasUnder) {
        setSelectedBets([selectedBets.find((bet) => bet.type === 'over')!, newBet]);
        return;
      }

      // Se já há 2 apostas e não podemos substituir, não fazer nada
      // (ou mostrar mensagem de erro)
      return;
    }

    // Verificar se já há uma aposta do mesmo tipo
    const hasSameType = selectedBets.some((bet) => bet.type === type);
    if (hasSameType) {
      // Substituir a aposta do mesmo tipo
      setSelectedBets(selectedBets.map((bet) => (bet.type === type ? newBet : bet)));
      return;
    }

    // Verificar se estamos tentando selecionar Over e Under da mesma linha
    const hasSameLine = selectedBets.some((bet) => bet.line === line);
    if (hasSameLine) {
      // Não permitir selecionar Over e Under da mesma linha
      return;
    }

    // Adicionar nova aposta
    setSelectedBets([...selectedBets, newBet]);
  };

  // Verificar se uma aposta está selecionada
  const isBetSelected = (line: string, type: 'over' | 'under'): boolean => {
    return selectedBets.some((bet) => bet.line === line && bet.type === type);
  };

  return (
    <motion.div
      className="flex flex-col gap-6 md:gap-8"
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
    >
      {/* Layout Principal: Gauge (1/3) + Info (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Card Principal de Probabilidade */}
        <motion.div
          className="lg:col-span-1"
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

        {/* Card de Informações da Partida */}
        <motion.div
          className="lg:col-span-2 surface surface-hover p-4 md:p-6"
          variants={animations.slideInRight}
          initial="initial"
          animate="animate"
        >
          <div className="flex flex-col gap-4 md:gap-6">
            {/* Header: Times + Badge de Risco + Botão Salvar */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight break-words">
                    <span className="break-words">{data.homeTeam}</span>{' '}
                    <span className="text-primary opacity-70 mx-1">vs</span>{' '}
                    <span className="break-words">{data.awayTeam}</span>
                  </h3>
                </div>
                <p className="text-xs sm:text-sm font-semibold opacity-70 uppercase tracking-wide leading-relaxed">
                  Análise de Probabilidade de Gols (Over/Under)
                </p>
              </div>
              <div className="flex flex-row sm:flex-col items-start sm:items-end gap-3 w-full sm:w-auto">
                <div
                  className={`badge badge-lg p-3 sm:p-4 font-black border-2 shadow-lg flex items-center gap-2 text-sm sm:text-base ${
                    displayRiskLevel === 'Baixo'
                      ? 'bg-success/20 text-success border-success/40'
                      : displayRiskLevel === 'Moderado'
                        ? 'bg-warning/20 text-warning border-warning/40'
                        : displayRiskLevel === 'Alto'
                          ? 'bg-error/20 text-error border-error/40'
                          : 'bg-error/30 text-error border-error/50'
                  }`}
                  title={`Risco baseado em ${displayLabel} (${displayProbability.toFixed(1)}%)`}
                >
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">RISCO: </span>
                  <span className="uppercase">{displayRiskLevel}</span>
                </div>
                {onSave && (
                  <button
                    onClick={() => onSave(selectedBets.length > 0 ? selectedBets : undefined)}
                    className="btn btn-primary btn-md sm:btn-lg uppercase font-bold tracking-tight hover:scale-105 transition-transform min-h-[44px] flex-1 sm:flex-none shadow-lg"
                  >
                    Salvar Partida
                  </button>
                )}
              </div>
            </div>

            {/* Probabilidades (Mercado) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary opacity-70" />
                  <h4 className="text-sm font-bold uppercase tracking-wide opacity-70">
                    Probabilidades
                  </h4>
                </div>
                {/* Indicador de Qualidade dos Dados */}
                {(() => {
                  const dataQuality = calculateDataQuality(data);
                  const qualityColor = dataQuality >= 80 ? 'success' : dataQuality >= 60 ? 'warning' : 'error';
                  const qualityLabel = dataQuality >= 80 ? 'Alta' : dataQuality >= 60 ? 'Média' : 'Baixa';
                  const ringBorder = dataQuality >= 80 ? 'border-success/30' : dataQuality >= 60 ? 'border-warning/30' : 'border-error/30';
                  const ringText = dataQuality >= 80 ? 'text-success' : dataQuality >= 60 ? 'text-warning' : 'text-error';
                  const badgeBorder = dataQuality >= 80 ? 'border-success/40' : dataQuality >= 60 ? 'border-warning/40' : 'border-error/40';
                  const badgeBg = dataQuality >= 80 ? 'bg-success/15' : dataQuality >= 60 ? 'bg-warning/15' : 'bg-error/15';
                  const dotColor = dataQuality >= 80 ? 'bg-success' : dataQuality >= 60 ? 'bg-warning' : 'bg-error';
                  return (
                    <div className="flex items-center gap-2">
                      <div className={`radial-progress ${ringText} ${ringBorder}`}
                           style={{ '--value': dataQuality.toFixed(0), '--size': '1.8rem', '--thickness': '3px' } as React.CSSProperties}
                           role="progressbar">
                        <span className="sr-only">{dataQuality.toFixed(0)}%</span>
                      </div>
                      <div className="tooltip tooltip-left before:!text-xs" data-tip={`${qualityLabel}: ${dataQuality.toFixed(0)}% completo`}>
                        <div className={`badge badge-sm gap-1 font-semibold border ${badgeBorder} ${badgeBg} ${ringText}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                          {qualityLabel}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {selectedBets.length > 0 && (
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="font-semibold opacity-70">
                    Baseado na seleção:{' '}
                    <span className="font-black text-primary">{displayLabel}</span>
                  </div>
                  <div className="font-semibold opacity-70">
                    Prob.: <span className="font-black">{displayProbability.toFixed(1)}%</span>
                  </div>
                </div>
              )}
              <motion.div
                className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 lg:gap-4"
                variants={animations.staggerChildren}
                initial="initial"
                animate="animate"
              >
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title={`Over ${selectedOverLine}`}
                    value={
                      result.overUnderProbabilities?.[selectedOverLine]?.over != null
                        ? `${Number(result.overUnderProbabilities[selectedOverLine].over).toFixed(1)}%`
                        : '—'
                    }
                    icon={TrendingUp}
                    color="success"
                    tooltip={getMarketOverTooltip(selectedOverLine)}
                  />
                </motion.div>
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    value={
                      result.overUnderProbabilities?.[selectedUnderLine]?.under != null
                        ? `${Number(result.overUnderProbabilities[selectedUnderLine].under).toFixed(1)}%`
                        : '—'
                    }
                    title={`Under ${selectedUnderLine}`}
                    icon={TrendingDown}
                    color="error"
                    tooltip={getMarketUnderTooltip(selectedUnderLine)}
                  />
                </motion.div>
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title="Ambas"
                    value={result.bttsProbability != null ? `${result.bttsProbability.toFixed(1)}%` : '—'}
                    icon={Sparkles}
                    color="accent"
                    trend="neutral"
                    trendValue={
                      selectedBets.length === 2
                        ? `Range: ${selectedRangeProbability != null ? `${selectedRangeProbability.toFixed(1)}%` : '—'}`
                        : 'Range: selecione Over + Under'
                    }
                    tooltip={getBothGoalsTooltip({
                      selectionLabel: selectedBets.length > 0 ? displayLabel : undefined,
                      hasRange: selectedBets.length === 2,
                    })}
                  />
                </motion.div>
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title="Edge (pp)"
                    value={edgePp == null ? '—' : `${edgePp >= 0 ? '+' : ''}${edgePp.toFixed(1)}pp`}
                    icon={TrendingUp}
                    color={edgePp == null ? 'warning' : edgePp >= 0 ? 'success' : 'error'}
                    tooltip={getEdgeTooltip(
                      edgePp,
                      displayProbability,
                      data.oddOver15,
                      result.confidenceScore,
                      displayLabel
                    )}
                  />
                </motion.div>
              </motion.div>
            </div>

            {/* Grid de 4 Métricas Essenciais */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary opacity-70" />
                <h4 className="text-sm font-bold uppercase tracking-wide opacity-70">
                  Métricas de Performance
                </h4>
              </div>
              <motion.div
                className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 lg:gap-4"
                variants={animations.staggerChildren}
                initial="initial"
                animate="animate"
              >
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title="Ataque"
                    value={result.advancedMetrics.offensiveVolume}
                    icon={Zap}
                    color="primary"
                    progress={result.advancedMetrics.offensiveVolume}
                    tooltip="Volume ofensivo: mede a capacidade de geração de gols (média de gols marcados + sofridos). Valores altos indicam jogos mais abertos e ofensivos."
                  />
                </motion.div>
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title="Defesa"
                    value={result.advancedMetrics.defensiveLeaking}
                    icon={Shield}
                    color="secondary"
                    progress={result.advancedMetrics.defensiveLeaking}
                    tooltip="Vazamento defensivo: mede a média de gols sofridos. Valores altos indicam defesas vulneráveis, favorecendo Over 1.5."
                  />
                </motion.div>
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title="Tendência"
                    value={trendLabel}
                    icon={trendIcon}
                    color={trendColor}
                    trend={trendDir}
                    trendValue={trendValue}
                    tooltip="Tendência de forma: indica se a probabilidade está subindo ou caindo. Valores positivos indicam tendência favorável ao Over 1.5."
                  />
                </motion.div>
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title="Confiança"
                    value={result.confidenceScore}
                    icon={Target}
                    color="accent"
                    progress={result.confidenceScore}
                    tooltip="Score de confiança: mede a qualidade e completude dos dados. Valores altos indicam dados suficientes para análise mais confiável."
                  />
                </motion.div>
              </motion.div>
            </div>

            {/* Recomendação em Destaque */}
            <div className="mt-4 surface surface-hover p-4 md:p-6 border-l-4 border-l-primary/60">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                <span className="text-xs md:text-sm font-black uppercase text-primary tracking-wide">
                  Recomendação
                </span>
              </div>
              <p className="text-sm md:text-base font-semibold leading-relaxed text-base-content/95 italic">
                "{result.recommendation}"
              </p>
            </div>
          </div>
        </motion.div>
      </div>

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

      {/* Combinações Recomendadas */}
      {result.recommendedCombinations && result.recommendedCombinations.length > 0 && (
        <motion.div
          className="surface surface-hover p-4 md:p-6 border-l-4 border-l-success/60"
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
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
      )}
    </motion.div>
  );
};

export default AnalysisDashboard;
