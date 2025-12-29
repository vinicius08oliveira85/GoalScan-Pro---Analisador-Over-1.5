import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AnalysisResult, MatchData, BetInfo, BankSettings } from '../types';
import { TrendingUp, TrendingDown, AlertCircle, Calculator, CheckCircle, XCircle, Clock, Ban, Zap, Shield, Target, Sparkles } from 'lucide-react';
import BetManager from './BetManager';
import ProbabilityGauge from './ProbabilityGauge';
import MetricCard from './MetricCard';
import { getCurrencySymbol } from '../utils/currency';
import { animations } from '../utils/animations';
import { getPrimaryProbability } from '../utils/probability';
import { getEdgePp } from '../utils/betMetrics';

interface AnalysisDashboardProps {
  result: AnalysisResult;
  data: MatchData;
  onSave?: () => void;
  betInfo?: BetInfo;
  bankSettings?: BankSettings;
  onBetSave?: (betInfo: BetInfo) => void;
  onError?: (message: string) => void;
}

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ 
  result, 
  data, 
  onSave, 
  betInfo, 
  bankSettings,
  onBetSave,
  onError
}) => {
  const [showBetManager, setShowBetManager] = useState(false);
  const primaryProb = getPrimaryProbability(result);
  const edgePp = data.oddOver15 ? getEdgePp(primaryProb, data.oddOver15) : null;

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
            odd={data.oddOver15}
            ev={result.ev}
          />
        </motion.div>

        {/* Card de Informações da Partida */}
        <motion.div 
          className="lg:col-span-2 group relative overflow-hidden rounded-2xl md:rounded-3xl p-4 md:p-6 bg-gradient-to-br from-primary/10 via-base-200/50 to-base-200/50 backdrop-blur-xl border border-primary/20 hover:border-primary/40 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/20"
          variants={animations.slideInRight}
          initial="initial"
          animate="animate"
        >
          {/* Glassmorphism overlay */}
          <div className="absolute inset-0 bg-base-200/40 backdrop-blur-md" />
          
          {/* Animated gradient orb */}
          <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 opacity-0 group-hover:opacity-100 blur-3xl transition-opacity duration-700" />

          {/* Content */}
          <div className="relative z-10 flex flex-col gap-4 md:gap-6">
            {/* Header: Times + Badge de Risco + Botão Salvar */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight break-words">
                    <span className="break-words">{data.homeTeam}</span> <span className="text-primary opacity-70 mx-1">vs</span> <span className="break-words">{data.awayTeam}</span>
                  </h3>
                </div>
                <p className="text-xs sm:text-sm font-semibold opacity-60 uppercase tracking-wide">Análise de Probabilidade Over 1.5</p>
              </div>
              <div className="flex flex-row sm:flex-col items-start sm:items-end gap-3 w-full sm:w-auto">
                <div className={`badge badge-lg p-3 sm:p-4 font-black border-2 shadow-lg flex items-center gap-2 text-sm sm:text-base ${
                  result.riskLevel === 'Baixo' 
                    ? 'bg-success/20 text-success border-success/40' 
                    : result.riskLevel === 'Moderado' 
                    ? 'bg-warning/20 text-warning border-warning/40' 
                    : result.riskLevel === 'Alto' 
                    ? 'bg-error/20 text-error border-error/40' 
                    : 'bg-error/30 text-error border-error/50'
                }`}>
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">RISCO: </span><span className="uppercase">{result.riskLevel}</span>
                </div>
                {onSave && (
                  <button 
                    onClick={onSave} 
                    className="btn btn-primary btn-md sm:btn-lg uppercase font-bold tracking-tight hover:scale-105 transition-transform min-h-[44px] flex-1 sm:flex-none shadow-lg"
                  >
                    Salvar Partida
                  </button>
                )}
              </div>
            </div>

            {/* Probabilidades (Estatística, IA, Final) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="w-4 h-4 text-primary opacity-60" />
                <h4 className="text-sm font-bold uppercase tracking-wide opacity-70">Probabilidades</h4>
              </div>
              <motion.div
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4"
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
                    tooltip="Probabilidade calculada apenas com base em estatísticas históricas (médias de gols, frequências Over 1.5, etc.). Não considera análise da IA."
                  />
                </motion.div>
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title="Prob. IA"
                    value={result.aiProbability != null ? `${Number(result.aiProbability).toFixed(1)}%` : '—'}
                    icon={Sparkles}
                    color="accent"
                    tooltip="Probabilidade estimada pela Inteligência Artificial após análise cruzada de todas as estatísticas. Aparece apenas quando a análise da IA foi gerada."
                  />
                </motion.div>
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title="Prob. Final"
                    value={`${(result.combinedProbability ?? result.probabilityOver15).toFixed(1)}%`}
                    icon={Target}
                    color="success"
                    tooltip="Probabilidade final combinada: usa a Prob. Estatística quando não há IA, ou combina Estatística + IA (ponderada pela confiança da IA) quando disponível. Esta é a probabilidade usada para cálculos de EV e recomendações."
                  />
                </motion.div>
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title="Edge (pp)"
                    value={
                      edgePp == null
                        ? '—'
                        : `${edgePp >= 0 ? '+' : ''}${edgePp.toFixed(1)}pp`
                    }
                    icon={TrendingUp}
                    color={edgePp == null ? 'warning' : edgePp >= 0 ? 'success' : 'error'}
                    tooltip="Edge (vantagem em pontos percentuais) = Prob. Final - Prob. Implícita da Odd. Valores positivos indicam que sua análise vê mais chance do que a casa de apostas (aposta com valor). Valores negativos indicam que a odd está desfavorável."
                  />
                </motion.div>
              </motion.div>
            </div>

            {/* Grid de 4 Métricas Essenciais */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary opacity-60" />
                <h4 className="text-sm font-bold uppercase tracking-wide opacity-70">Métricas de Performance</h4>
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
                    tooltip="Volume ofensivo: mede a capacidade de geração de gols dos times (baseado em média total de gols marcados + sofridos). Valores altos indicam jogos mais abertos e ofensivos."
                  />
                </motion.div>
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title="Defesa"
                    value={result.advancedMetrics.defensiveLeaking}
                    icon={Shield}
                    color="secondary"
                    progress={result.advancedMetrics.defensiveLeaking}
                    tooltip="Vazamento defensivo: mede a média de gols sofridos pelos times. Valores altos indicam defesas mais vulneráveis, o que favorece Over 1.5."
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
                    tooltip="Tendência de forma: indica se a probabilidade está subindo ou caindo baseado em histórico recente. Valores positivos indicam tendência favorável ao Over 1.5."
                  />
                </motion.div>
                <motion.div variants={animations.fadeInUp}>
                  <MetricCard
                    title="Qualidade"
                    value={result.confidenceScore}
                    icon={Target}
                    color="accent"
                    progress={result.confidenceScore}
                    tooltip="Score de confiança: mede a qualidade e completude dos dados disponíveis para a análise. Valores altos indicam que há dados suficientes para uma análise mais confiável."
                  />
                </motion.div>
              </motion.div>
            </div>

            {/* Recomendação em Destaque */}
            <div className="mt-4 p-4 md:p-6 bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/10 border-2 border-primary/40 rounded-xl md:rounded-2xl backdrop-blur-sm relative overflow-hidden group/recommendation shadow-lg">
              <div className="absolute top-3 right-3 opacity-30 group-hover/recommendation:opacity-60 transition-opacity">
                <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-primary" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                  <span className="text-xs md:text-sm font-black uppercase text-primary tracking-wide">Recomendação</span>
                </div>
                <p className="text-sm md:text-base font-semibold leading-relaxed text-base-content/95 italic">
                  "{result.recommendation}"
                </p>
              </div>
            </div>
          </div>

          {/* Shine effect on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-all duration-1000" />
        </motion.div>
      </div>

      {/* Seção de Aposta - Design Moderno e Compacto */}
      {onBetSave && (
        <div>
          {!showBetManager ? (
            <div className="group relative overflow-hidden rounded-2xl md:rounded-3xl p-4 md:p-6 bg-gradient-to-br from-primary/10 via-base-200/50 to-base-200/50 backdrop-blur-xl border border-primary/20 hover:border-primary/40 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/20">
              {/* Glassmorphism overlay */}
              <div className="absolute inset-0 bg-base-200/40 backdrop-blur-md" />
              
              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-primary/10 border-2 border-primary/30">
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
                  <div className="bg-base-100/50 p-5 rounded-2xl border border-white/10 backdrop-blur-sm">
                    {/* Status Badge Destacado */}
                    <div className="mb-6 flex items-center justify-between p-4 bg-base-200/30 rounded-xl border border-white/10">
                      <span className="text-sm font-bold opacity-70 uppercase tracking-wide">Status da Aposta</span>
                      <div className={`badge gap-2 px-5 py-3 font-black text-sm uppercase tracking-wider border-2 shadow-lg ${
                        betInfo.status === 'won' 
                          ? 'bg-success/20 text-success border-success/40' 
                          : betInfo.status === 'lost'
                          ? 'bg-error/20 text-error border-error/40'
                          : betInfo.status === 'pending'
                          ? 'bg-warning/20 text-warning border-warning/40'
                          : 'bg-base-300/20 text-base-content/60 border-base-300/40'
                      }`}>
                        {betInfo.status === 'won' && <CheckCircle className="w-5 h-5" />}
                        {betInfo.status === 'lost' && <XCircle className="w-5 h-5" />}
                        {betInfo.status === 'pending' && <Clock className="w-5 h-5" />}
                        {betInfo.status === 'cancelled' && <Ban className="w-5 h-5" />}
                        <span>
                          {betInfo.status === 'won' ? 'Ganhou' :
                           betInfo.status === 'lost' ? 'Perdeu' :
                           betInfo.status === 'pending' ? 'Pendente' :
                           'Cancelada'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Botões Rápidos para Marcar Resultado (apenas se pendente) */}
                    {betInfo.status === 'pending' && onBetSave && (
                      <div className="mb-6 p-4 bg-warning/10 border-2 border-warning/30 rounded-xl">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <span className="text-sm font-bold opacity-80 uppercase tracking-wide">Marcar Resultado</span>
                          <div className="flex gap-3 w-full sm:w-auto">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const updatedBetInfo: BetInfo = {
                                  ...betInfo,
                                  status: 'won',
                                  resultAt: Date.now()
                                };
                                onBetSave(updatedBetInfo);
                              }}
                              className="btn btn-success btn-md gap-2 min-h-[44px] flex-1 sm:flex-none shadow-lg"
                            >
                              <CheckCircle className="w-5 h-5" />
                              Ganhou
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const updatedBetInfo: BetInfo = {
                                  ...betInfo,
                                  status: 'lost',
                                  resultAt: Date.now()
                                };
                                onBetSave(updatedBetInfo);
                              }}
                              className="btn btn-error btn-md gap-2 min-h-[44px] flex-1 sm:flex-none shadow-lg"
                            >
                              <XCircle className="w-5 h-5" />
                              Perdeu
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                      <div className="bg-base-200/40 p-4 rounded-xl border-2 border-white/10">
                        <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">Valor Apostado</span>
                        <p className="font-black text-xl font-mono">
                          {getCurrencySymbol(bankSettings?.currency || 'BRL')} {betInfo.betAmount.toFixed(2)}
                        </p>
                      </div>
                      {betInfo.status === 'pending' ? (
                        <div className="bg-base-200/40 p-4 rounded-xl border-2 border-primary/30">
                          <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">Retorno Potencial</span>
                          <p className="font-black text-xl text-primary font-mono">
                            {getCurrencySymbol(bankSettings?.currency || 'BRL')} {betInfo.potentialReturn.toFixed(2)}
                          </p>
                        </div>
                      ) : betInfo.status === 'won' ? (
                        <div className="bg-success/10 p-4 rounded-xl border-2 border-success/30">
                          <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">Ganho Realizado</span>
                          <p className="font-black text-xl text-success font-mono">
                            +{getCurrencySymbol(bankSettings?.currency || 'BRL')} {betInfo.potentialProfit.toFixed(2)}
                          </p>
                        </div>
                      ) : betInfo.status === 'lost' ? (
                        <div className="bg-error/10 p-4 rounded-xl border-2 border-error/30">
                          <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">Perda</span>
                          <p className="font-black text-xl text-error font-mono">
                            -{getCurrencySymbol(bankSettings?.currency || 'BRL')} {betInfo.betAmount.toFixed(2)}
                          </p>
                        </div>
                      ) : null}
                      {betInfo.status === 'pending' && (
                        <div className={`p-4 rounded-xl border-2 ${betInfo.potentialProfit >= 0 ? 'bg-success/10 border-success/30' : 'bg-error/10 border-error/30'}`}>
                          <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">Lucro Potencial</span>
                          <p className={`font-black text-xl font-mono ${betInfo.potentialProfit >= 0 ? 'text-success' : 'text-error'}`}>
                            {betInfo.potentialProfit >= 0 ? '+' : ''}{getCurrencySymbol(bankSettings?.currency || 'BRL')} {betInfo.potentialProfit.toFixed(2)}
                          </p>
                        </div>
                      )}
                      <div className="bg-base-200/40 p-4 rounded-xl border-2 border-white/10">
                        <span className="text-xs font-semibold opacity-70 block mb-2 uppercase tracking-wide">% da Banca</span>
                        <p className="font-black text-xl font-mono">
                          {betInfo.bankPercentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-base-100/30 p-5 rounded-2xl border border-white/10 backdrop-blur-sm text-center">
                    <p className="text-sm opacity-60">
                      Clique em "Registrar Aposta" para adicionar informações sobre sua aposta nesta partida.
                    </p>
                  </div>
                )}
              </div>

              {/* Shine effect on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-all duration-1000" />
            </div>
          ) : (
            <BetManager
              odd={data.oddOver15 || 0}
              probability={result.combinedProbability ?? result.probabilityOver15}
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
