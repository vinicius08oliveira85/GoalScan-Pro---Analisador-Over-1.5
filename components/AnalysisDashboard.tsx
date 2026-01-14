import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AnalysisResult, MatchData, BetInfo, BankSettings, SelectedBet, SavedAnalysis } from '../types';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Calculator,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  Zap,
  Shield,
  Target,
  Sparkles,
} from 'lucide-react';
import BetManager from './BetManager';
import ProbabilityGauge from './ProbabilityGauge';
import MetricCard from './MetricCard';
import AiOver15Insights from './AiOver15Insights';
import { getCurrencySymbol } from '../utils/currency';
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
  savedAiReportMarkdown?: string | null; // Relatório de IA salvo (para restaurar)
  onAiAnalysisGenerated?: (
    data: MatchData,
    markdown: string,
    aiProbability: number | null,
    aiConfidence: number | null
  ) => void; // Callback quando análise de IA for gerada
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
  savedAiReportMarkdown,
  onAiAnalysisGenerated,
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
                  const qualityColor = dataQuality >= 80 ? 'text-success' : dataQuality >= 60 ? 'text-warning' : 'text-error';
                  const qualityLabel = dataQuality >= 80 ? 'Alta' : dataQuality >= 60 ? 'Média' : 'Baixa';
                  return (
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${qualityColor} tooltip tooltip-left`} data-tip={`Dados: ${qualityLabel} (${dataQuality.toFixed(0)}%)\n\nIndica a completude dos dados disponíveis para análise. Dados mais completos resultam em análises mais precisas.`}>
                      <div className={`w-2 h-2 rounded-full ${dataQuality >= 80 ? 'bg-success' : dataQuality >= 60 ? 'bg-warning' : 'bg-error'}`} />
                      <span className="hidden sm:inline">Dados: {qualityLabel}</span>
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

      {/* Análise de IA com Sinais Externos */}
      <motion.div
        className="surface surface-hover p-4 md:p-6"
        variants={animations.fadeInUp}
        initial="initial"
        animate="animate"
      >
        <AiOver15Insights
          data={data}
          onError={onError}
          onAiAnalysisGenerated={onAiAnalysisGenerated}
          savedReportMarkdown={savedAiReportMarkdown}
        />
      </motion.div>

      {/* Probabilidades Over/Under por Linha */}
      {(result.overUnderProbabilities || result.tableOverUnderProbabilities || result.statsOverUnderProbabilities) && (
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
                    onClick={() => setOverUnderTab('combined')}
                  >
                    Combinada
                  </button>
                )}
                {hasStatsOU && (
                  <button
                    type="button"
                    role="tab"
                    className={`tab ${overUnderTab === 'stats' ? 'tab-active' : ''}`}
                    onClick={() => setOverUnderTab('stats')}
                  >
                    Estatísticas
                  </button>
                )}
                {hasTableOU && (
                  <button
                    type="button"
                    role="tab"
                    className={`tab ${overUnderTab === 'table' ? 'tab-active' : ''}`}
                    onClick={() => setOverUnderTab('table')}
                  >
                    Tabela
                  </button>
                )}
              </div>

              {selectedBets.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedBets([])}
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
                      onClick={interactive ? () => handleBetClick(line, 'over', prob.over) : undefined}
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
                      onClick={interactive ? () => handleBetClick(line, 'under', prob.under) : undefined}
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
            <div className="surface surface-hover p-4 md:p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                    <Calculator className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Gerenciar Aposta</h3>
                </div>
                <button
                  onClick={() => setShowBetManager(true)}
                  className="btn btn-primary btn-md gap-2 hover:scale-105 transition-transform shadow-lg"
                >
                  {betInfo && betInfo.betAmount > 0 ? 'Editar Aposta' : 'Registrar Aposta'}
                </button>
              </div>

              {betInfo && betInfo.betAmount > 0 ? (
                <div className="surface-muted p-5">
                  {/* Status Badge Destacado */}
                  <div className="mb-6 flex items-center justify-between p-4 rounded-xl border border-base-300/60 bg-base-300/20">
                    <span className="text-sm font-bold opacity-70 uppercase tracking-wide">
                      Status da Aposta
                    </span>
                    <div
                      className={`badge gap-2 px-5 py-3 font-black text-sm uppercase tracking-wider border-2 shadow-lg ${
                        betInfo.status === 'won'
                          ? 'bg-success/20 text-success border-success/40'
                          : betInfo.status === 'lost'
                            ? 'bg-error/20 text-error border-error/40'
                            : betInfo.status === 'pending'
                              ? 'bg-warning/20 text-warning border-warning/40'
                              : 'bg-base-300/20 text-base-content/60 border-base-300/40'
                      }`}
                    >
                      {betInfo.status === 'won' && <CheckCircle className="w-5 h-5" />}
                      {betInfo.status === 'lost' && <XCircle className="w-5 h-5" />}
                      {betInfo.status === 'pending' && <Clock className="w-5 h-5" />}
                      {betInfo.status === 'cancelled' && <Ban className="w-5 h-5" />}
                      <span>
                        {betInfo.status === 'won'
                          ? 'Ganhou'
                          : betInfo.status === 'lost'
                            ? 'Perdeu'
                            : betInfo.status === 'pending'
                              ? 'Pendente'
                              : 'Cancelada'}
                      </span>
                    </div>
                  </div>

                  {/* Botões Rápidos para Marcar Resultado (apenas se pendente) */}
                  {betInfo.status === 'pending' && onBetSave && (
                    <div className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-xl">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <span className="text-sm font-bold opacity-80 uppercase tracking-wide">
                          Marcar Resultado
                        </span>
                        <div className="flex gap-3 w-full sm:w-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Verificar se o status já é o mesmo - evitar processamento desnecessário
                              if (betInfo.status === 'won') {
                                return; // Status já é won, não precisa processar
                              }
                              const updatedBetInfo: BetInfo = {
                                ...betInfo,
                                status: 'won',
                                resultAt: Date.now(),
                              };
                              onBetSave(updatedBetInfo);
                            }}
                            disabled={isUpdatingBetStatus || betInfo.status === 'won'}
                            className="btn btn-success btn-md gap-2 min-h-[44px] flex-1 sm:flex-none shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <CheckCircle className="w-5 h-5" />
                            {isUpdatingBetStatus ? 'Processando...' : 'Ganhou'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Verificar se o status já é o mesmo - evitar processamento desnecessário
                              if (betInfo.status === 'lost') {
                                return; // Status já é lost, não precisa processar
                              }
                              const updatedBetInfo: BetInfo = {
                                ...betInfo,
                                status: 'lost',
                                resultAt: Date.now(),
                              };
                              onBetSave(updatedBetInfo);
                            }}
                            disabled={isUpdatingBetStatus || betInfo.status === 'lost'}
                            className="btn btn-error btn-md gap-2 min-h-[44px] flex-1 sm:flex-none shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <XCircle className="w-5 h-5" />
                            {isUpdatingBetStatus ? 'Processando...' : 'Perdeu'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <div className="surface-muted p-4 rounded-xl">
                      <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">
                        Valor Apostado
                      </span>
                      <p className="font-black text-xl font-mono">
                        {getCurrencySymbol(bankSettings?.currency || 'BRL')}{' '}
                        {betInfo.betAmount.toFixed(2)}
                      </p>
                    </div>
                    {betInfo.status === 'pending' ? (
                      <div className="surface-muted p-4 rounded-xl border border-primary/30">
                        <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">
                          Retorno Potencial
                        </span>
                        <p className="font-black text-xl text-primary font-mono">
                          {getCurrencySymbol(bankSettings?.currency || 'BRL')}{' '}
                          {betInfo.potentialReturn.toFixed(2)}
                        </p>
                      </div>
                    ) : betInfo.status === 'won' ? (
                      <div className="bg-success/10 p-4 rounded-xl border-2 border-success/30">
                        <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">
                          Ganho Realizado
                        </span>
                        <p className="font-black text-xl text-success font-mono">
                          +{getCurrencySymbol(bankSettings?.currency || 'BRL')}{' '}
                          {betInfo.potentialProfit.toFixed(2)}
                        </p>
                      </div>
                    ) : betInfo.status === 'lost' ? (
                      <div className="bg-error/10 p-4 rounded-xl border-2 border-error/30">
                        <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">
                          Perda
                        </span>
                        <p className="font-black text-xl text-error font-mono">
                          -{getCurrencySymbol(bankSettings?.currency || 'BRL')}{' '}
                          {betInfo.betAmount.toFixed(2)}
                        </p>
                      </div>
                    ) : null}
                    {betInfo.status === 'pending' && (
                      <div
                        className={`p-4 rounded-xl border-2 ${betInfo.potentialProfit >= 0 ? 'bg-success/10 border-success/30' : 'bg-error/10 border-error/30'}`}
                      >
                        <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">
                          Lucro Potencial
                        </span>
                        <p
                          className={`font-black text-xl font-mono ${betInfo.potentialProfit >= 0 ? 'text-success' : 'text-error'}`}
                        >
                          {betInfo.potentialProfit >= 0 ? '+' : ''}
                          {getCurrencySymbol(bankSettings?.currency || 'BRL')}{' '}
                          {betInfo.potentialProfit.toFixed(2)}
                        </p>
                      </div>
                    )}
                    <div className="surface-muted p-4 rounded-xl">
                      <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">
                        % da Banca
                      </span>
                      <p className="font-black text-xl font-mono">
                        {betInfo.bankPercentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="surface-muted p-5 text-center">
                  <p className="text-sm opacity-70 leading-relaxed">
                    Clique em "Registrar Aposta" para adicionar informações sobre sua aposta nesta
                    partida.
                  </p>
                </div>
              )}
            </div>
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
