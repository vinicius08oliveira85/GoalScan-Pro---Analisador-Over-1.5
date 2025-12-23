import React from 'react';
import { SavedAnalysis } from '../types';
import { TrendingUp, TrendingDown, Calendar, X, Plus, Target, Activity, TrendingUp as TrendingUpIcon, CheckCircle, XCircle, Clock, Ban } from 'lucide-react';

interface MainScreenProps {
  savedMatches: SavedAnalysis[];
  onMatchClick: (match: SavedAnalysis) => void;
  onNewMatch: () => void;
  onDeleteMatch: (e: React.MouseEvent, id: string) => void;
}

const MainScreen: React.FC<MainScreenProps> = ({ savedMatches, onMatchClick, onNewMatch, onDeleteMatch }) => {
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
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-base-200/80 backdrop-blur-md border-b border-base-300 py-4 mb-8 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center text-primary-content font-black italic text-xl shadow-lg">
              G
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none">GOALSCAN PRO</h1>
              <span className="text-[10px] uppercase font-bold tracking-widest text-primary opacity-80">AI Goal Analysis Engine</span>
            </div>
          </div>
          <div className="hidden md:flex gap-4 items-center">
            <span className="badge badge-outline badge-sm font-bold">v3.8.2 Elite Edition</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4">
        {/* Estatísticas Gerais */}
        {totalMatches > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="custom-card p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold opacity-40 uppercase mb-1">Total de Partidas</p>
                <p className="text-2xl font-black">{totalMatches}</p>
              </div>
            </div>
            <div className="custom-card p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-success/10 border border-success/20">
                <Target className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-xs font-bold opacity-40 uppercase mb-1">EV Positivo</p>
                <p className="text-2xl font-black text-success">{positiveEV}</p>
              </div>
            </div>
            <div className="custom-card p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20">
                <TrendingUpIcon className="w-6 h-6 text-teal-400" />
              </div>
              <div>
                <p className="text-xs font-bold opacity-40 uppercase mb-1">Prob. Média</p>
                <p className="text-2xl font-black text-teal-400">{avgProbability.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Título e Botão Adicionar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black tracking-tighter mb-1">Partidas Salvas</h2>
            <p className="text-sm opacity-60">Gerencie suas análises e resultados</p>
          </div>
          <button
            onClick={onNewMatch}
            className="btn btn-primary btn-lg gap-2 shadow-lg hover:scale-105 transition-transform"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Adicionar Partida</span>
            <span className="sm:hidden">Nova</span>
          </button>
        </div>

        {/* Grid de Partidas */}
        {savedMatches.length === 0 ? (
          <div className="custom-card p-16 flex flex-col items-center justify-center text-center border-dashed border-2">
            <div className="w-24 h-24 mb-6 rounded-full border-4 border-primary/20 flex items-center justify-center">
              <Target className="w-12 h-12 text-primary opacity-40" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Nenhuma Partida Salva</h3>
            <p className="text-sm opacity-60 mb-6 max-w-md">
              Comece criando sua primeira análise. Clique no botão abaixo para adicionar uma nova partida.
            </p>
            <button
              onClick={onNewMatch}
              className="btn btn-primary btn-lg gap-2"
            >
              <Plus className="w-5 h-5" />
              Adicionar Primeira Partida
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedMatches.map(match => (
              <div
                key={match.id}
                onClick={() => onMatchClick(match)}
                className="group custom-card p-6 hover:border-primary/50 hover:shadow-xl cursor-pointer transition-all duration-300 active:scale-[0.98] flex flex-col gap-4 relative overflow-hidden"
              >
                {/* Header: Data e Times */}
                <div className="flex justify-between items-start">
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <Calendar className="w-4 h-4 opacity-40" />
                      {match.data.matchDate ? (
                        <span className="text-[10px] font-black opacity-30 uppercase">
                          {new Date(match.data.matchDate).toLocaleDateString('pt-BR', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric' 
                          })}
                          {match.data.matchTime && ` • ${match.data.matchTime}`}
                        </span>
                      ) : (
                        <span className="text-[10px] font-black opacity-30 uppercase">
                          {new Date(match.timestamp).toLocaleDateString('pt-BR', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric' 
                          })}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-black uppercase leading-tight">
                      {match.data.homeTeam} <span className="text-primary opacity-60">vs</span> {match.data.awayTeam}
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
                      className="opacity-0 group-hover:opacity-100 btn btn-xs btn-circle btn-ghost text-error hover:bg-error/20 transition-all flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
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
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center p-3 rounded-xl bg-teal-500/5 border border-teal-500/10 group-hover:border-teal-500/20 transition-colors">
                    <span className="text-[9px] font-bold opacity-40 uppercase mb-1">Prob</span>
                    <span className="text-lg font-black text-teal-400">{match.result.probabilityOver15.toFixed(0)}%</span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-xl bg-primary/5 border border-primary/10 group-hover:border-primary/20 transition-colors">
                    <span className="text-[9px] font-bold opacity-40 uppercase mb-1">Odd</span>
                    <span className="text-lg font-black text-primary">{match.data.oddOver15?.toFixed(2) || '-'}</span>
                  </div>
                  <div className={`flex flex-col items-center p-3 rounded-xl border transition-colors ${
                    match.result.ev > 0
                      ? 'bg-success/5 border-success/10 group-hover:border-success/20'
                      : match.result.ev < 0
                      ? 'bg-error/5 border-error/10 group-hover:border-error/20'
                      : 'bg-base-300/5 border-base-300/10'
                  }`}>
                    <span className="text-[9px] font-bold opacity-40 uppercase mb-1">EV</span>
                    <div className="flex items-center gap-1">
                      {match.result.ev > 0 ? (
                        <TrendingUp className="w-4 h-4 text-success" />
                      ) : match.result.ev < 0 ? (
                        <TrendingDown className="w-4 h-4 text-error" />
                      ) : null}
                      <span className={`text-lg font-black ${
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
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-base-300 border-t border-base-100 p-2 md:hidden">
        <div className="flex justify-center gap-4 text-[10px] font-bold opacity-50 uppercase tracking-widest">
          <span>Poisson v3.8</span>
          <span>•</span>
          <span>EV Analysis</span>
        </div>
      </footer>
    </div>
  );
};

export default MainScreen;

