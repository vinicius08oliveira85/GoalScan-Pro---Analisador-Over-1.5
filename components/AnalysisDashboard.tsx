import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AnalysisResult, MatchData, BetInfo, BankSettings, SelectedBet } from '../types';
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
import { getCurrencySymbol } from '../utils/currency';
import { animations } from '../utils/animations';
import { getPrimaryProbability } from '../utils/probability';
import { getEdgePp } from '../utils/betMetrics';
import {
  getStatisticalProbabilityTooltip,
  getTableProbabilityTooltip,
  getFinalProbabilityTooltip,
  getEdgeTooltip,
  calculateDataQuality,
} from '../utils/probabilityTooltips';

interface AnalysisDashboardProps {
  result: AnalysisResult;
  data: MatchData;
  onSave?: (selectedBets?: SelectedBet[]) => void;
  betInfo?: BetInfo;
  bankSettings?: BankSettings;
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
  onBetSave,
  onError,
  isUpdatingBetStatus = false,
  onOddChange,
  initialSelectedBets,
}) => {
  const [showBetManager, setShowBetManager] = useState(false);
  const [selectedBets, setSelectedBets] = useState<SelectedBet[]>(initialSelectedBets || []);
  
  // Restaurar apostas selecionadas quando initialSelectedBets mudar
  useEffect(() => {
    if (initialSelectedBets) {
      setSelectedBets(initialSelectedBets);
    }
  }, [initialSelectedBets]);
  const primaryProb = getPrimaryProbability(result);

  // Função para calcular probabilidade combinada
  const calculateCombinedProbability = (bets: SelectedBet[]): number => {
    if (bets.length !== 2) return 0;
    // Multiplicar as probabilidades (apostas independentes)
    return (bets[0].probability / 100) * (bets[1].probability / 100) * 100;
  };

  // Calcular probabilidade combinada quando houver 2 apostas selecionadas
  const combinedProbability = useMemo(() => {
    if (selectedBets.length === 2) {
      return calculateCombinedProbability(selectedBets);
    }
    return null;
  }, [selectedBets]);

  // Calcular qual probabilidade deve ser exibida no gauge
  const displayProbability = useMemo(() => {
    if (selectedBets.length === 1) {
      // Se há 1 aposta selecionada, usar sua probabilidade
      return selectedBets[0].probability;
    } else if (selectedBets.length === 2 && combinedProbability !== null) {
      // Se há 2 apostas selecionadas, usar probabilidade combinada
      return combinedProbability;
    }
    // Caso contrário, usar probabilidade Over 1.5 padrão
    return primaryProb;
  }, [selectedBets, combinedProbability, primaryProb]);

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

  // Calcular Edge (pp) com a probabilidade que está sendo exibida
  // Usando margem padrão de 6% (típica de casas de apostas)
  const edgePp = useMemo(() => {
    if (data.oddOver15 && data.oddOver15 > 1) {
      return getEdgePp(displayProbability, data.oddOver15, 0.06);
    }
    return null;
  }, [displayProbability, data.oddOver15]);

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
                <p className="text-xs sm:text-sm font-semibold opacity-60 uppercase tracking-wide">
                  Análise de Probabilidade Over 1.5
                </p>
              </div>
              <div className="flex flex-row sm:flex-col items-start sm:items-end gap-3 w-full sm:w-auto">
                <div
                  className={`badge badge-lg p-3 sm:p-4 font-black border-2 shadow-lg flex items-center gap-2 text-sm sm:text-base ${
                    result.riskLevel === 'Baixo'
                      ? 'bg-success/20 text-success border-success/40'
                      : result.riskLevel === 'Moderado'
                        ? 'bg-warning/20 text-warning border-warning/40'
                        : result.riskLevel === 'Alto'
                          ? 'bg-error/20 text-error border-error/40'
                          : 'bg-error/30 text-error border-error/50'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">RISCO: </span>
                  <span className="uppercase">{result.riskLevel}</span>
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

            {/* Probabilidades (Estatística, IA, Final) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary opacity-60" />
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
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${qualityColor} tooltip tooltip-left`} data-tip={`Qualidade dos Dados: ${qualityLabel} (${dataQuality.toFixed(0)}%)\n\nIndica a completude e qualidade dos dados disponíveis para análise. Dados mais completos resultam em análises mais precisas.`}>
                      <div className={`w-2 h-2 rounded-full ${dataQuality >= 80 ? 'bg-success' : dataQuality >= 60 ? 'bg-warning' : 'bg-error'}`} />
                      <span className="hidden sm:inline">Qualidade: {qualityLabel}</span>
                    </div>
                  );
                })()}
              </div>
              <motion.div
                className={`grid gap-3 md:gap-4 ${
                  result.tableProbability != null
                    ? 'grid-cols-2 sm:grid-cols-5'
                    : 'grid-cols-2 sm:grid-cols-4'
                }`}
                variants={animations.staggerChildren}
                initial="initial"
                animate="animate"
              >
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title="Prob. Estatística"
                    value={`${result.probabilityOver15.toFixed(1)}%`}
                    icon={Calculator}
                    color="secondary"
                    tooltip={getStatisticalProbabilityTooltip(result, data)}
                  />
                </motion.div>
                {result.tableProbability != null && (
                  <motion.div variants={animations.fadeInUp}>
                    <MetricCard
                      title="Prob. Tabela"
                      value={`${Number(result.tableProbability).toFixed(1)}%`}
                      icon={Target}
                      color="warning"
                      tooltip={`Probabilidade baseada apenas em dados da tabela (GF/MP, GA/MP, xG, xGA).

📊 Calculada usando:
• Gols Marcados/Sofridos por jogo (GF/MP, GA/MP)
• Expected Goals (xG, xGA) quando disponível
• Distribuição Poisson

💡 Útil para comparar com Prob. Estatística (que usa Estatísticas Globais dos últimos 10 jogos). Se houver divergência significativa, pode indicar mudança recente de forma.`}
                    />
                  </motion.div>
                )}
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title="Prob. Tabela"
                    value={
                      result.tableProbability != null
                        ? `${Number(result.tableProbability).toFixed(1)}%`
                        : '—'
                    }
                    icon={Shield}
                    color="accent"
                    tooltip={getTableProbabilityTooltip(result, data)}
                  />
                </motion.div>
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title="Prob. Final"
                    value={`${displayProbability.toFixed(1)}%`}
                    icon={Target}
                    color="success"
                    tooltip={getFinalProbabilityTooltip(
                      result,
                      displayProbability,
                      selectedBets,
                      result.tableProbability != null
                    )}
                  />
                </motion.div>
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title="Edge (pp)"
                    value={edgePp == null ? '—' : `${edgePp >= 0 ? '+' : ''}${edgePp.toFixed(1)}pp`}
                    icon={TrendingUp}
                    color={edgePp == null ? 'warning' : edgePp >= 0 ? 'success' : 'error'}
                    tooltip={getEdgeTooltip(edgePp, displayProbability, data.oddOver15, result.confidenceScore)}
                  />
                </motion.div>
              </motion.div>
            </div>

            {/* Grid de 4 Métricas Essenciais */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary opacity-60" />
                <h4 className="text-sm font-bold uppercase tracking-wide opacity-70">
                  Métricas de Performance
                </h4>
              </div>
              <motion.div
                className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
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
                    value={result.advancedMetrics.formTrend >= 0 ? 'SUBINDO' : 'CAINDO'}
                    icon={result.advancedMetrics.formTrend >= 0 ? TrendingUp : TrendingDown}
                    color={result.advancedMetrics.formTrend >= 0 ? 'success' : 'error'}
                    trend={result.advancedMetrics.formTrend >= 0 ? 'up' : 'down'}
                    trendValue={`${result.advancedMetrics.formTrend >= 0 ? '+' : ''}${result.advancedMetrics.formTrend.toFixed(1)}`}
                    tooltip="Tendência de forma: indica se a probabilidade está subindo ou caindo. Valores positivos indicam tendência favorável ao Over 1.5."
                  />
                </motion.div>
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title="Qualidade"
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
      {result.overUnderProbabilities && Object.keys(result.overUnderProbabilities).length > 0 && (
        <motion.div
          className="surface surface-hover p-4 md:p-6"
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-black uppercase tracking-tight">Probabilidades Over/Under</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {['0.5', '1.5', '2.5', '3.5', '4.5', '5.5'].map((line) => {
              const prob = result.overUnderProbabilities?.[line];
              if (!prob) return null;
              const isOverSelected = isBetSelected(line, 'over');
              const isUnderSelected = isBetSelected(line, 'under');
              return (
                <div
                  key={line}
                  className="surface-muted p-4 rounded-xl border border-base-300/60"
                >
                  <div className="text-xs font-bold opacity-70 uppercase tracking-wide mb-2">
                    Linha {line}
                  </div>
                  <div className="space-y-2">
                    <div
                      onClick={() => handleBetClick(line, 'over', prob.over)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                        isOverSelected
                          ? 'bg-success/20 border-2 border-success shadow-lg scale-105'
                          : 'hover:bg-base-300/50 border-2 border-transparent'
                      }`}
                      title={isOverSelected ? 'Clique para desmarcar' : 'Clique para selecionar'}
                    >
                      <span className="text-xs font-semibold text-success">Over</span>
                      <span className="text-sm font-black">{prob.over.toFixed(1)}%</span>
                    </div>
                    <div
                      onClick={() => handleBetClick(line, 'under', prob.under)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                        isUnderSelected
                          ? 'bg-error/20 border-2 border-error shadow-lg scale-105'
                          : 'hover:bg-base-300/50 border-2 border-transparent'
                      }`}
                      title={isUnderSelected ? 'Clique para desmarcar' : 'Clique para selecionar'}
                    >
                      <span className="text-xs font-semibold text-error">Under</span>
                      <span className="text-sm font-black">{prob.under.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Seção de Aposta Combinada Selecionada */}
          {combinedProbability !== null && selectedBets.length === 2 && (
            <motion.div
              className="mt-6 p-4 rounded-xl border-2 border-primary bg-primary/10"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-black uppercase tracking-tight text-primary">
                  Aposta Combinada Selecionada
                </h4>
                <button
                  onClick={() => setSelectedBets([])}
                  className="btn btn-xs btn-ghost text-error"
                  title="Limpar seleção"
                >
                  Limpar
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">
                    {selectedBets[0].type === 'over' ? 'Over' : 'Under'} {selectedBets[0].line}
                  </span>
                  <span className="text-primary font-black">+</span>
                  <span className="font-semibold">
                    {selectedBets[1].type === 'over' ? 'Over' : 'Under'} {selectedBets[1].line}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs opacity-70">Probabilidade Combinada:</span>
                  <span className="text-lg font-black text-primary">
                    {combinedProbability.toFixed(2)}%
                  </span>
                </div>
                <div className="text-xs opacity-60 mt-2">
                  {selectedBets[0].probability.toFixed(1)}% × {selectedBets[1].probability.toFixed(1)}% = {combinedProbability.toFixed(2)}%
                </div>
              </div>
            </motion.div>
          )}
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
                  <p className="text-sm opacity-60">
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
