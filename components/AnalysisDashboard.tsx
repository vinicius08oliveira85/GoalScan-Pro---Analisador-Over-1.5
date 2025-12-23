import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AnalysisResult, MatchData, BetInfo, BankSettings } from '../types';
import { TrendingUp, TrendingDown, AlertCircle, Calculator, CheckCircle, XCircle, Clock, Ban, Zap, Shield, Target, Sparkles } from 'lucide-react';
import BetManager from './BetManager';
import ProbabilityGauge from './ProbabilityGauge';
import MetricCard from './MetricCard';
import { getCurrencySymbol } from '../utils/currency';
import { animations } from '../utils/animations';

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

  return (
    <motion.div 
      className="flex flex-col gap-6"
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
    >
      {/* Layout Principal: Gauge (1/3) + Info (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Card Principal de Probabilidade */}
        <motion.div 
          className="lg:col-span-1"
          variants={animations.scaleIn}
          initial="initial"
          animate="animate"
        >
          <ProbabilityGauge 
            probability={result.probabilityOver15}
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
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-black tracking-tighter uppercase break-words">
                    <span className="break-words">{data.homeTeam}</span> <span className="text-primary opacity-60">vs</span> <span className="break-words">{data.awayTeam}</span>
                  </h3>
                </div>
                <p className="text-[10px] sm:text-xs font-bold opacity-40 uppercase tracking-widest">Análise de Probabilidade Over 1.5</p>
              </div>
              <div className="flex flex-row sm:flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
                <div className={`badge badge-md sm:badge-lg p-2 sm:p-3 font-black border-none shadow-lg flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm ${
                  result.riskLevel === 'Baixo' 
                    ? 'bg-success/20 text-success border-success/30' 
                    : result.riskLevel === 'Moderado' 
                    ? 'bg-warning/20 text-warning border-warning/30' 
                    : result.riskLevel === 'Alto' 
                    ? 'bg-error/20 text-error border-error/30' 
                    : 'bg-error/30 text-error border-error/40'
                }`}>
                  <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">RISCO: </span>{result.riskLevel}
                </div>
                {onSave && (
                  <button 
                    onClick={onSave} 
                    className="btn btn-sm btn-primary uppercase font-bold tracking-tighter hover:scale-105 transition-transform min-h-[44px] flex-1 sm:flex-none"
                  >
                    Salvar Partida
                  </button>
                )}
              </div>
            </div>

            {/* Grid de 4 Métricas Essenciais */}
            <motion.div 
              className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
              variants={animations.staggerChildren}
              initial="initial"
              animate="animate"
            >
              <motion.div variants={animations.fadeInUp}>
                <MetricCard
                  title="Ataque (10j)"
                  value={result.advancedMetrics.offensiveVolume}
                  icon={Zap}
                  color="primary"
                  progress={result.advancedMetrics.offensiveVolume}
                />
              </motion.div>
              <motion.div variants={animations.fadeInUp}>
                <MetricCard
                  title="Defesa (10j)"
                  value={result.advancedMetrics.defensiveLeaking}
                  icon={Shield}
                  color="secondary"
                  progress={result.advancedMetrics.defensiveLeaking}
                />
              </motion.div>
              <motion.div variants={animations.fadeInUp}>
                <MetricCard
                  title="Tendência (5j)"
                  value={result.advancedMetrics.formTrend >= 0 ? 'SUBINDO' : 'CAINDO'}
                  icon={result.advancedMetrics.formTrend >= 0 ? TrendingUp : TrendingDown}
                  color={result.advancedMetrics.formTrend >= 0 ? 'success' : 'error'}
                  trend={result.advancedMetrics.formTrend >= 0 ? 'up' : 'down'}
                  trendValue={`${result.advancedMetrics.formTrend >= 0 ? '+' : ''}${result.advancedMetrics.formTrend.toFixed(1)}`}
                />
              </motion.div>
              <motion.div variants={animations.fadeInUp}>
                <MetricCard
                  title="Qualidade"
                  value={result.confidenceScore}
                  icon={Target}
                  color="accent"
                  progress={result.confidenceScore}
                />
              </motion.div>
            </motion.div>

            {/* Recomendação em Destaque */}
            <div className="mt-2 p-3 md:p-5 bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/10 border border-primary/30 rounded-xl md:rounded-2xl backdrop-blur-sm relative overflow-hidden group/recommendation">
              <div className="absolute top-2 right-2 opacity-20 group-hover/recommendation:opacity-40 transition-opacity">
                <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-primary" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-3 h-3 md:w-4 md:h-4 text-primary" />
                  <span className="text-[10px] md:text-xs font-black uppercase text-primary opacity-80">Recomendação</span>
                </div>
                <p className="text-xs md:text-sm font-bold italic leading-tight text-base-content/90">
                  "{result.recommendation}"
                </p>
              </div>
            </div>
          </div>

          {/* Shine effect on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-all duration-1000" />
        </div>
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
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                      <Calculator className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-black uppercase">Gerenciar Aposta</h3>
                  </div>
                  <button
                    onClick={() => setShowBetManager(true)}
                    className="btn btn-primary btn-sm gap-2 hover:scale-105 transition-transform"
                  >
                    {betInfo && betInfo.betAmount > 0 ? 'Editar Aposta' : 'Registrar Aposta'}
                  </button>
                </div>
                
                {betInfo && betInfo.betAmount > 0 ? (
                  <div className="bg-base-100/50 p-5 rounded-2xl border border-white/10 backdrop-blur-sm">
                    {/* Status Badge Destacado */}
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-xs font-bold opacity-60 uppercase">Status da Aposta</span>
                      <div className={`badge gap-2 px-4 py-2 font-bold text-xs uppercase tracking-wider ${
                        betInfo.status === 'won' 
                          ? 'bg-success/20 text-success border-success/30' 
                          : betInfo.status === 'lost'
                          ? 'bg-error/20 text-error border-error/30'
                          : betInfo.status === 'pending'
                          ? 'bg-warning/20 text-warning border-warning/30'
                          : 'bg-base-300/20 text-base-content/60 border-base-300/30'
                      }`}>
                        {betInfo.status === 'won' && <CheckCircle className="w-4 h-4" />}
                        {betInfo.status === 'lost' && <XCircle className="w-4 h-4" />}
                        {betInfo.status === 'pending' && <Clock className="w-4 h-4" />}
                        {betInfo.status === 'cancelled' && <Ban className="w-4 h-4" />}
                        <span>
                          {betInfo.status === 'won' ? 'Ganhou' :
                           betInfo.status === 'lost' ? 'Perdeu' :
                           betInfo.status === 'pending' ? 'Pendente' :
                           'Cancelada'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 text-xs md:text-sm">
                      <div className="bg-base-200/30 p-3 rounded-xl border border-white/5">
                        <span className="text-xs opacity-60 block mb-1">Valor Apostado</span>
                        <p className="font-bold text-lg">
                          {getCurrencySymbol(bankSettings?.currency || 'BRL')} {betInfo.betAmount.toFixed(2)}
                        </p>
                      </div>
                      {betInfo.status === 'pending' ? (
                        <div className="bg-base-200/30 p-3 rounded-xl border border-white/5">
                          <span className="text-xs opacity-60 block mb-1">Retorno Potencial</span>
                          <p className="font-bold text-lg text-primary">
                            {getCurrencySymbol(bankSettings?.currency || 'BRL')} {betInfo.potentialReturn.toFixed(2)}
                          </p>
                        </div>
                      ) : betInfo.status === 'won' ? (
                        <div className="bg-base-200/30 p-3 rounded-xl border border-white/5">
                          <span className="text-xs opacity-60 block mb-1">Ganho Realizado</span>
                          <p className="font-bold text-lg text-success">
                            +{getCurrencySymbol(bankSettings?.currency || 'BRL')} {betInfo.potentialProfit.toFixed(2)}
                          </p>
                        </div>
                      ) : betInfo.status === 'lost' ? (
                        <div className="bg-base-200/30 p-3 rounded-xl border border-white/5">
                          <span className="text-xs opacity-60 block mb-1">Perda</span>
                          <p className="font-bold text-lg text-error">
                            -{getCurrencySymbol(bankSettings?.currency || 'BRL')} {betInfo.betAmount.toFixed(2)}
                          </p>
                        </div>
                      ) : null}
                      {betInfo.status === 'pending' && (
                        <div className="bg-base-200/30 p-3 rounded-xl border border-white/5">
                          <span className="text-xs opacity-60 block mb-1">Lucro Potencial</span>
                          <p className={`font-bold text-lg ${betInfo.potentialProfit >= 0 ? 'text-success' : 'text-error'}`}>
                            {betInfo.potentialProfit >= 0 ? '+' : ''}{getCurrencySymbol(bankSettings?.currency || 'BRL')} {betInfo.potentialProfit.toFixed(2)}
                          </p>
                        </div>
                      )}
                      <div className="bg-base-200/30 p-3 rounded-xl border border-white/5">
                        <span className="text-xs opacity-60 block mb-1">% da Banca</span>
                        <p className="font-bold text-lg">
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
              probability={result.probabilityOver15}
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
    </div>
  );
};

export default AnalysisDashboard;
