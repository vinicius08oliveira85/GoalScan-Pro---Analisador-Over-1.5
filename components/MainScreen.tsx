import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SavedAnalysis } from '../types';
import { TrendingUp, TrendingDown, Calendar, X, Plus, Target, Activity, TrendingUp as TrendingUpIcon, CheckCircle, XCircle, Clock, Ban } from 'lucide-react';
import { SkeletonMatchCard } from './Skeleton';
import { cardHover, animations } from '../utils/animations';
import MatchTabs, { TabCategory } from './MatchTabs';
import { filterMatchesByCategory, getCategoryCounts } from '../utils/matchFilters';
import { getPrimaryProbability } from '../utils/probability';

// Componente de Empty State por categoria
const EmptyStateByCategory: React.FC<{ 
  category: TabCategory; 
  onNewMatch: () => void;
  totalMatches: number;
}> = ({ category, onNewMatch, totalMatches }) => {
  const emptyStates = {
    pendentes: {
      icon: Clock,
      title: 'Nenhuma Partida Pendente',
      description: totalMatches > 0 
        ? 'Todas as suas partidas já foram finalizadas ou não possuem apostas pendentes.'
        : 'Adicione partidas e registre apostas para acompanhar seus resultados.',
      showButton: totalMatches === 0
    },
    finalizadas: {
      icon: CheckCircle,
      title: 'Nenhuma Partida Finalizada',
      description: 'Ainda não há partidas finalizadas. As partidas aparecerão aqui após serem concluídas.',
      showButton: false
    },
    todas: {
      icon: Target,
      title: 'Nenhuma Partida Salva',
      description: 'Comece criando sua primeira análise. Clique no botão abaixo para adicionar uma nova partida e começar a usar o GoalScan Pro.',
      showButton: true
    }
  };

  const state = emptyStates[category];
  const Icon = state.icon;

  return (
    <motion.div
      key={category}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
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
          <Icon className="w-16 h-16 md:w-20 md:h-20 text-primary opacity-60" />
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
        {state.title}
      </motion.h3>
      
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-sm md:text-base opacity-70 mb-8 max-w-md leading-relaxed"
      >
        {state.description}
      </motion.p>
      
      {state.showButton && (
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
          Adicionar Partida
        </motion.button>
      )}
    </motion.div>
  );
};

interface MainScreenProps {
  savedMatches: SavedAnalysis[];
  onMatchClick: (match: SavedAnalysis) => void;
  onNewMatch: () => void;
  onDeleteMatch: (e: React.MouseEvent, id: string) => void;
  onUpdateBetStatus?: (match: SavedAnalysis, status: 'won' | 'lost') => void;
  isLoading?: boolean;
}

const MainScreen: React.FC<MainScreenProps> = ({ savedMatches, onMatchClick, onNewMatch, onDeleteMatch, onUpdateBetStatus, isLoading = false }) => {
  // Contadores por categoria
  const categoryCounts = useMemo(() => getCategoryCounts(savedMatches), [savedMatches]);
  
  // Estado da aba ativa - inicia com 'pendentes' se houver partidas pendentes, senão 'todas'
  const [activeTab, setActiveTab] = useState<TabCategory>(() => {
    const counts = getCategoryCounts(savedMatches);
    return counts.pendentes > 0 ? 'pendentes' : 'todas';
  });
  
  // Filtrar partidas baseado na aba ativa
  const filteredMatches = useMemo(() => {
    return filterMatchesByCategory(savedMatches, activeTab);
  }, [savedMatches, activeTab]);
  
  // Calcular estatísticas gerais (baseadas nas partidas filtradas)
  const totalMatches = filteredMatches.length;
  const positiveEV = filteredMatches.filter(m => m.result.ev > 0).length;
  const avgProbability = filteredMatches.length > 0 
    ? filteredMatches.reduce((sum, m) => sum + getPrimaryProbability(m.result), 0) / filteredMatches.length 
    : 0;
  const avgEV = filteredMatches.length > 0
    ? filteredMatches.reduce((sum, m) => sum + m.result.ev, 0) / filteredMatches.length
    : 0;

  return (
    <div>
        {/* Sistema de Abas */}
        <MatchTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          counts={categoryCounts}
        />
        
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
        ) : filteredMatches.length === 0 ? (
          <EmptyStateByCategory 
            category={activeTab} 
            onNewMatch={onNewMatch}
            totalMatches={savedMatches.length}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
              variants={animations.staggerChildren}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {filteredMatches.map((match, index) => {
                // Determinar cor da borda e status baseado no estado da aposta
                const getStatusConfig = () => {
                  if (match.betInfo && match.betInfo.betAmount > 0) {
                    if (match.betInfo.status === 'won') {
                      return { border: 'border-t-2 border-success', bg: 'bg-success/10' };
                    } else if (match.betInfo.status === 'lost') {
                      return { border: 'border-t-2 border-error', bg: 'bg-error/10' };
                    } else if (match.betInfo.status === 'pending') {
                      return { border: 'border-t-2 border-warning', bg: 'bg-warning/10' };
                    }
                  }
                  return { border: 'border-t-2 border-primary', bg: 'bg-primary/10' };
                };
                
                const statusConfig = getStatusConfig();
                
                return (
                <motion.div
                  key={match.id}
                  onClick={() => onMatchClick(match)}
                  custom={index}
                  initial="initial"
                  animate="animate"
                  whileHover="hover"
                  whileTap="tap"
                  variants={cardHover}
                  className={`group custom-card p-3 hover:shadow-xl cursor-pointer flex flex-col gap-1.5 relative overflow-hidden ${statusConfig.border}`}
                >
                  {/* Header: Times e Status */}
                  <div className={`flex justify-between items-start gap-2 px-3 py-2 -mx-3 -mt-3 mb-1 ${statusConfig.bg} rounded-t-lg`}>
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold truncate">
                        <span className="truncate">{match.data.homeTeam}</span>
                        <span className="text-primary opacity-60 shrink-0">vs</span>
                        <span className="truncate">{match.data.awayTeam}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      {/* Status da Aposta */}
                      {match.betInfo && match.betInfo.betAmount > 0 && (
                        <div className={`badge gap-1 px-2 py-1 h-6 text-xs font-medium flex-shrink-0 ${
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
                          <span className="text-[10px]">
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
                        <X className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Data/Hora e Risco na mesma linha */}
                  <div className="flex items-center justify-between text-xs px-1">
                    <div className="flex items-center gap-1.5 opacity-60">
                      <Calendar className="w-3 h-3 shrink-0" />
                      {match.data.matchDate ? (
                        <>
                          <span>
                            {new Date(match.data.matchDate).toLocaleDateString('pt-BR', { 
                              day: '2-digit', 
                              month: 'short'
                            })}
                          </span>
                          {match.data.matchTime && (
                            <>
                              <span>•</span>
                              <Clock className="w-3 h-3" />
                              <span>{match.data.matchTime}</span>
                            </>
                          )}
                        </>
                      ) : (
                        <span>
                          {new Date(match.timestamp).toLocaleDateString('pt-BR', { 
                            day: '2-digit', 
                            month: 'short'
                          })}
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                      match.result.riskLevel === 'Baixo' ? 'bg-success/10 text-success border-success/20' :
                      match.result.riskLevel === 'Moderado' ? 'bg-warning/10 text-warning border-warning/20' :
                      match.result.riskLevel === 'Alto' ? 'bg-error/10 text-error border-error/20' :
                      'bg-error/10 text-error border-error/20'
                    }`}>
                      {match.result.riskLevel}
                    </span>
                  </div>

                  {/* Barra de Probabilidade com Cores Dinâmicas */}
                  <div className="space-y-1.5 bg-base-200/30 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium opacity-70">Probabilidade</span>
                      <span className="font-bold">{getPrimaryProbability(match.result).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full bg-base-300 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          getPrimaryProbability(match.result) >= 70 
                            ? 'bg-gradient-to-r from-success to-emerald-400' 
                            : getPrimaryProbability(match.result) >= 50
                            ? 'bg-gradient-to-r from-warning to-amber-400'
                            : 'bg-gradient-to-r from-error to-rose-400'
                        }`}
                        style={{ width: `${getPrimaryProbability(match.result)}%` }}
                      />
                    </div>
                  </div>

                  {/* Grid de Métricas Compacto */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="bg-base-200/30 rounded-md px-2 py-1.5">
                      <div className="text-[10px] font-medium opacity-60 uppercase tracking-wide">Odd</div>
                      <div className="text-sm font-bold mt-0.5 text-primary">{match.data.oddOver15?.toFixed(2) || '-'}</div>
                    </div>
                    <div className="bg-base-200/30 rounded-md px-2 py-1.5">
                      <div className="text-[10px] font-medium opacity-60 uppercase tracking-wide">EV</div>
                      <div className={`text-sm font-bold mt-0.5 flex items-center gap-1 ${
                        match.result.ev > 0 ? 'text-success' :
                        match.result.ev < 0 ? 'text-error' :
                        'opacity-50'
                      }`}>
                        {match.result.ev > 0 && <TrendingUp className="w-3 h-3" />}
                        {match.result.ev < 0 && <TrendingDown className="w-3 h-3" />}
                        <span>{match.result.ev > 0 ? '+' : ''}{match.result.ev.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="bg-base-200/30 rounded-md px-2 py-1.5">
                      <div className="text-[10px] font-medium opacity-60 uppercase tracking-wide">Stake</div>
                      <div className="text-sm font-bold mt-0.5">
                        {match.betInfo && match.betInfo.betAmount > 0 
                          ? match.betInfo.betAmount.toFixed(2) 
                          : '-'}
                      </div>
                    </div>
                  </div>

                  {/* Informações Financeiras - Layout Compacto */}
                  {match.betInfo && match.betInfo.betAmount > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg border bg-base-200/30 px-3 py-2.5">
                        <div>
                          <div className="text-[10px] font-medium opacity-60 uppercase tracking-wide mb-0.5">Aposta</div>
                          <div className="text-sm font-bold">{match.betInfo.betAmount.toFixed(2)}</div>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-40">
                          <TrendingUp className="h-3.5 w-3.5" />
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-medium opacity-60 uppercase tracking-wide mb-0.5">
                            {match.betInfo.status === 'won' ? 'Ganho' :
                             match.betInfo.status === 'lost' ? 'Perda' :
                             'Retorno'}
                          </div>
                          <div className="flex items-baseline gap-1 justify-end">
                            <div className={`text-base font-bold ${
                              match.betInfo.status === 'won' ? 'text-success' :
                              match.betInfo.status === 'lost' ? 'text-error' :
                              'text-primary'
                            }`}>
                              {match.betInfo.status === 'won' && '+'}
                              {match.betInfo.status === 'won' ? match.betInfo.potentialProfit.toFixed(2) :
                               match.betInfo.status === 'lost' ? `-${match.betInfo.betAmount.toFixed(2)}` :
                               match.betInfo.potentialReturn.toFixed(2)}
                            </div>
                            {match.betInfo.status === 'pending' && (
                              <div className="text-xs font-semibold opacity-60">
                                ({((match.betInfo.potentialReturn - match.betInfo.betAmount) / match.betInfo.betAmount * 100).toFixed(0)}%)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Botões Rápidos para Marcar Resultado (apenas se pendente) */}
                      {match.betInfo.status === 'pending' && onUpdateBetStatus && (
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateBetStatus(match, 'won');
                            }}
                            className="btn btn-xs btn-success flex-1 gap-1 min-h-[32px] text-[10px] font-bold border-success/30"
                            title="Marcar como ganha"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Ganhou
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateBetStatus(match, 'lost');
                            }}
                            className="btn btn-xs btn-error flex-1 gap-1 min-h-[32px] text-[10px] font-bold border-error/30"
                            title="Marcar como perdida"
                          >
                            <XCircle className="w-3 h-3" />
                            Perdeu
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )})}
            </motion.div>
          </AnimatePresence>
        )}
    </div>
  );
};

export default MainScreen;

