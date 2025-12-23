import React from 'react';
import { motion } from 'framer-motion';
import { SavedAnalysis } from '../types';
import { TrendingUp, TrendingDown, Calendar, X, Plus, Target, Activity, TrendingUp as TrendingUpIcon, CheckCircle, XCircle, Clock, Ban } from 'lucide-react';
import { SkeletonMatchCard } from './Skeleton';
import { cardHover, animations } from '../utils/animations';

interface MainScreenProps {
  savedMatches: SavedAnalysis[];
  onMatchClick: (match: SavedAnalysis) => void;
  onNewMatch: () => void;
  onDeleteMatch: (e: React.MouseEvent, id: string) => void;
  isLoading?: boolean;
}

const MainScreen: React.FC<MainScreenProps> = ({ savedMatches, onMatchClick, onNewMatch, onDeleteMatch, isLoading = false }) => {
  // Calcular estatísticas gerais
  const totalMatches = savedMatches.length;
  const positiveEV = savedMatches.filter(m => m.result.ev > 0).length;
  const avgProbability = savedMatches.length > 0 
    ? savedMatches.reduce((sum, m) => sum + m.result.probabilityOver15, 0) / savedMatches.length 
    : 0;
  const avgEV = savedMatches.length > 0
    ? savedMatches.reduce((sum, m) => sum + m.result.ev, 0) / savedMatches.length
    : 0;

  return (
    <div>
        {/* Estatísticas Gerais */}
        {totalMatches > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
            <div className="custom-card p-3 md:p-4 flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-xl bg-primary/10 border border-primary/20 flex-shrink-0">
                <Activity className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs font-bold opacity-40 uppercase mb-1">Total de Partidas</p>
                <p className="text-xl md:text-2xl font-black">{totalMatches}</p>
              </div>
            </div>
            <div className="custom-card p-3 md:p-4 flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-xl bg-success/10 border border-success/20 flex-shrink-0">
                <Target className="w-5 h-5 md:w-6 md:h-6 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs font-bold opacity-40 uppercase mb-1">EV Positivo</p>
                <p className="text-xl md:text-2xl font-black text-success">{positiveEV}</p>
              </div>
            </div>
            <div className="custom-card p-3 md:p-4 flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 flex-shrink-0">
                <TrendingUpIcon className="w-5 h-5 md:w-6 md:h-6 text-teal-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs font-bold opacity-40 uppercase mb-1">Prob. Média</p>
                <p className="text-xl md:text-2xl font-black text-teal-400">{avgProbability.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Título e Botão Adicionar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-black tracking-tighter mb-1">Partidas Salvas</h2>
            <p className="text-xs sm:text-sm opacity-60">Gerencie suas análises e resultados</p>
          </div>
          <button
            onClick={onNewMatch}
            className="btn btn-primary btn-md sm:btn-lg gap-2 shadow-lg hover:scale-105 transition-transform w-full sm:w-auto min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Adicionar nova partida para análise"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
            <span className="hidden sm:inline">Adicionar Partida</span>
            <span className="sm:hidden">Nova Partida</span>
          </button>
        </div>

        {/* Grid de Partidas */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonMatchCard key={index} />
            ))}
          </div>
        ) : savedMatches.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
            className="custom-card p-12 md:p-16 flex flex-col items-center justify-center text-center border-dashed border-2 relative overflow-hidden"
          >
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-50" />
            
            {/* Animated icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", bounce: 0.6, delay: 0.2 }}
              className="relative mb-6"
            >
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center shadow-lg">
                <Target className="w-16 h-16 md:w-20 md:h-20 text-primary opacity-60" />
              </div>
              {/* Pulsing ring */}
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-primary/20"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0, 0.5]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </motion.div>
            
            <motion.h3
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl md:text-3xl font-black mb-3 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
            >
              Nenhuma Partida Salva
            </motion.h3>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-sm md:text-base opacity-70 mb-8 max-w-md leading-relaxed"
            >
              Comece criando sua primeira análise. Clique no botão abaixo para adicionar uma nova partida e começar a usar o GoalScan Pro.
            </motion.p>
            
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onNewMatch}
              className="btn btn-primary btn-lg gap-2 shadow-xl hover:shadow-2xl focus-ring"
            >
              <Plus className="w-5 h-5" />
              Adicionar Primeira Partida
            </motion.button>
          </motion.div>
        ) : (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
            variants={animations.staggerChildren}
            initial="initial"
            animate="animate"
          >
            {savedMatches.map((match, index) => (
              <motion.div
                key={match.id}
                onClick={() => onMatchClick(match)}
                variants={animations.fadeInUp}
                custom={index}
                initial="initial"
                animate="animate"
                whileHover="hover"
                whileTap="tap"
                variants={cardHover}
                className="group custom-card p-4 md:p-6 hover:border-primary/50 hover:shadow-xl cursor-pointer flex flex-col gap-3 md:gap-4 relative overflow-hidden"
              >
                {/* Header: Data e Times */}
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <Calendar className="w-3 h-3 md:w-4 md:h-4 opacity-40 flex-shrink-0" />
                      {match.data.matchDate ? (
                        <span className="text-[9px] md:text-[10px] font-black opacity-30 uppercase break-words">
                          {new Date(match.data.matchDate).toLocaleDateString('pt-BR', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric' 
                          })}
                          {match.data.matchTime && ` • ${match.data.matchTime}`}
                        </span>
                      ) : (
                        <span className="text-[9px] md:text-[10px] font-black opacity-30 uppercase break-words">
                          {new Date(match.timestamp).toLocaleDateString('pt-BR', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric' 
                          })}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm md:text-base font-black uppercase leading-tight break-words">
                      <span className="break-words">{match.data.homeTeam}</span> <span className="text-primary opacity-60">vs</span> <span className="break-words">{match.data.awayTeam}</span>
                    </h3>
                  </div>
                  <div className="flex items-start gap-2">
                    {/* Status da Aposta */}
                    {match.betInfo && match.betInfo.betAmount > 0 && (
                      <div className={`badge gap-1.5 px-2.5 py-2 font-bold text-[10px] uppercase tracking-wider flex-shrink-0 ${
                        match.betInfo.status === 'won' 
                          ? 'bg-success/20 text-success border-success/30' 
                          : match.betInfo.status === 'lost'
                          ? 'bg-error/20 text-error border-error/30'
                          : match.betInfo.status === 'pending'
                          ? 'bg-warning/20 text-warning border-warning/30'
                          : 'bg-base-300/20 text-base-content/60 border-base-300/30'
                      }`}>
                        {match.betInfo.status === 'won' && <CheckCircle className="w-3 h-3" />}
                        {match.betInfo.status === 'lost' && <XCircle className="w-3 h-3" />}
                        {match.betInfo.status === 'pending' && <Clock className="w-3 h-3" />}
                        {match.betInfo.status === 'cancelled' && <Ban className="w-3 h-3" />}
                        <span>
                          {match.betInfo.status === 'won' ? 'Ganhou' :
                           match.betInfo.status === 'lost' ? 'Perdeu' :
                           match.betInfo.status === 'pending' ? 'Pendente' :
                           'Cancelada'}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={(e) => onDeleteMatch(e, match.id)}
                      className="opacity-0 group-hover:opacity-100 btn btn-xs btn-circle btn-ghost text-error hover:bg-error/20 transition-all flex-shrink-0 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-error"
                      aria-label={`Remover partida ${match.data.homeTeam} vs ${match.data.awayTeam}`}
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Informações da Aposta */}
                {match.betInfo && match.betInfo.betAmount > 0 && (
                  <div className="bg-base-100/30 p-3 rounded-xl border border-white/5">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[9px] font-bold opacity-40 uppercase">Valor Apostado</span>
                        <p className="font-black text-sm mt-0.5">
                          {match.betInfo.betAmount.toFixed(2)}
                        </p>
                      </div>
                      {match.betInfo.status === 'won' && (
                        <div>
                          <span className="text-[9px] font-bold opacity-40 uppercase">Ganho</span>
                          <p className="font-black text-sm text-success mt-0.5">
                            +{match.betInfo.potentialProfit.toFixed(2)}
                          </p>
                        </div>
                      )}
                      {match.betInfo.status === 'lost' && (
                        <div>
                          <span className="text-[9px] font-bold opacity-40 uppercase">Perda</span>
                          <p className="font-black text-sm text-error mt-0.5">
                            -{match.betInfo.betAmount.toFixed(2)}
                          </p>
                        </div>
                      )}
                      {match.betInfo.status === 'pending' && (
                        <div>
                          <span className="text-[9px] font-bold opacity-40 uppercase">Retorno Potencial</span>
                          <p className="font-black text-sm text-primary mt-0.5">
                            {match.betInfo.potentialReturn.toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Métricas Principais */}
                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  <div className="flex flex-col items-center p-2 md:p-3 rounded-xl bg-teal-500/5 border border-teal-500/10 group-hover:border-teal-500/20 transition-colors">
                    <span className="text-[8px] md:text-[9px] font-bold opacity-40 uppercase mb-1">Prob</span>
                    <span className="text-base md:text-lg font-black text-teal-400">{match.result.probabilityOver15.toFixed(0)}%</span>
                  </div>
                  <div className="flex flex-col items-center p-2 md:p-3 rounded-xl bg-primary/5 border border-primary/10 group-hover:border-primary/20 transition-colors">
                    <span className="text-[8px] md:text-[9px] font-bold opacity-40 uppercase mb-1">Odd</span>
                    <span className="text-base md:text-lg font-black text-primary">{match.data.oddOver15?.toFixed(2) || '-'}</span>
                  </div>
                  <div className={`flex flex-col items-center p-2 md:p-3 rounded-xl border transition-colors ${
                    match.result.ev > 0
                      ? 'bg-success/5 border-success/10 group-hover:border-success/20'
                      : match.result.ev < 0
                      ? 'bg-error/5 border-error/10 group-hover:border-error/20'
                      : 'bg-base-300/5 border-base-300/10'
                  }`}>
                    <span className="text-[8px] md:text-[9px] font-bold opacity-40 uppercase mb-1">EV</span>
                    <div className="flex items-center gap-1">
                      {match.result.ev > 0 ? (
                        <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-success" />
                      ) : match.result.ev < 0 ? (
                        <TrendingDown className="w-3 h-3 md:w-4 md:h-4 text-error" />
                      ) : null}
                      <span className={`text-base md:text-lg font-black ${
                        match.result.ev > 0 ? 'text-success' :
                        match.result.ev < 0 ? 'text-error' :
                        'opacity-50'
                      }`}>
                        {match.result.ev > 0 ? '+' : ''}{match.result.ev.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Barra de Progresso e Badge */}
                <div className="flex items-center gap-3 mt-2">
                  <div className="h-2 flex-1 rounded-full overflow-hidden bg-base-300">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-teal-400 transition-all duration-500"
                      style={{ width: `${match.result.probabilityOver15}%` }}
                    ></div>
                  </div>
                  {match.result.ev > 0 && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/10 border border-success/20">
                      <TrendingUp className="w-3 h-3 text-success" />
                      <span className="text-[9px] font-bold text-success">EV+</span>
                    </div>
                  )}
                </div>

                {/* Nível de Risco */}
                <div className="pt-3 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold opacity-40 uppercase">Nível de Risco</span>
                    <span className={`text-xs font-black px-2 py-1 rounded ${
                      match.result.riskLevel === 'Baixo' ? 'bg-success/20 text-success' :
                      match.result.riskLevel === 'Moderado' ? 'bg-warning/20 text-warning' :
                      match.result.riskLevel === 'Alto' ? 'bg-error/20 text-error' :
                      'bg-error/30 text-error'
                    }`}>
                      {match.result.riskLevel}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
    </div>
  );
};

export default MainScreen;

