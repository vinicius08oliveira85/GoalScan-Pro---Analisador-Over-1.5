
import React, { useState, useEffect } from 'react';
import { MatchData, RecentMatch, H2HMatch, TeamStatistics, PercursoStats, GolsStats, FirstGoalStats } from '../types';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface MatchFormProps {
  onAnalyze: (data: MatchData) => void;
  initialData?: MatchData | null;
}

// Função para criar MatchData vazio
const createEmptyMatchData = (): MatchData => ({
  homeTeam: '',
  awayTeam: '',
  oddOver15: undefined,
  homeGoalsScoredAvg: 0,
  homeGoalsConcededAvg: 0,
  awayGoalsScoredAvg: 0,
  awayGoalsConcededAvg: 0,
  homeXG: 0,
  awayXG: 0,
  homeShotsOnTarget: 0,
  awayShotsOnTarget: 0,
  homeOver15Freq: 0,
  awayOver15Freq: 0,
  homeBTTSFreq: 0,
  awayBTTSFreq: 0,
  homeCleanSheetFreq: 0,
  awayCleanSheetFreq: 0,
  h2hOver15Freq: 0,
  matchImportance: 0,
  keyAbsences: 'none',
  homeHistory: [],
  awayHistory: []
});

const MatchForm: React.FC<MatchFormProps> = ({ onAnalyze, initialData }) => {
  const [showFirstGoal, setShowFirstGoal] = useState(false);
  const [formData, setFormData] = useState<MatchData>(initialData || createEmptyMatchData());

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      // Resetar para vazio quando não há initialData (nova partida)
      setFormData(createEmptyMatchData());
      setShowFirstGoal(false); // Resetar também a seção colapsável
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: isNaN(Number(value)) || name === 'homeTeam' || name === 'awayTeam' || name === 'keyAbsences' || name === 'matchDate' || name === 'matchTime'
        ? value 
        : value === '' ? undefined : Number(value)
    }));
  };

  // Funções para atualizar TeamStatistics
  const updateTeamStats = (team: 'home' | 'away', path: string, value: number | undefined) => {
    setFormData(prev => {
      const teamKey = team === 'home' ? 'homeTeamStats' : 'awayTeamStats';
      const currentStats = prev[teamKey] || {
        percurso: { home: createEmptyPercurso(), away: createEmptyPercurso(), global: createEmptyPercurso() },
        gols: { home: createEmptyGols(), away: createEmptyGols(), global: createEmptyGols() }
      };
      
      // Inicializar firstGoal se necessário e se o path começar com 'firstGoal'
      if (path.startsWith('firstGoal') && !currentStats.firstGoal) {
        currentStats.firstGoal = {
          home: createEmptyFirstGoal(),
          away: createEmptyFirstGoal(),
          global: createEmptyFirstGoal()
        };
      }
      
      const keys = path.split('.');
      const newStats = JSON.parse(JSON.stringify(currentStats)); // Deep clone
      let current: any = newStats;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          if (keys[i] === 'firstGoal') {
            current[keys[i]] = {
              home: createEmptyFirstGoal(),
              away: createEmptyFirstGoal(),
              global: createEmptyFirstGoal()
            };
          } else if (keys[i] === 'percurso' || keys[i] === 'gols') {
            current[keys[i]] = {
              home: keys[i] === 'percurso' ? createEmptyPercurso() : createEmptyGols(),
              away: keys[i] === 'percurso' ? createEmptyPercurso() : createEmptyGols(),
              global: keys[i] === 'percurso' ? createEmptyPercurso() : createEmptyGols()
            };
          }
        } else {
          current[keys[i]] = { ...current[keys[i]] };
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value === '' ? undefined : value;
      
      return {
        ...prev,
        [teamKey]: newStats
      };
    });
  };

  const createEmptyPercurso = (): PercursoStats => ({
    winStreak: 0,
    drawStreak: 0,
    lossStreak: 0,
    withoutWin: 0,
    withoutDraw: 0,
    withoutLoss: 0
  });

  const createEmptyGols = (): GolsStats => ({
    avgScored: 0,
    avgConceded: 0,
    avgTotal: 0,
    cleanSheetPct: 0,
    noGoalsPct: 0,
    over25Pct: 0,
    under25Pct: 0
  });

  const createEmptyFirstGoal = (): FirstGoalStats => ({
    opensScorePct: 0,
    opensScoreCount: 0,
    winningAtHT: 0,
    winningAtHTCount: 0,
    winsFinal: 0,
    winsFinalCount: 0
  });

  const addHistoryEntry = (team: 'home' | 'away') => {
    const newEntry: RecentMatch = { date: new Date().toISOString().split('T')[0], homeScore: 0, awayScore: 0 };
    setFormData(prev => ({
      ...prev,
      [team === 'home' ? 'homeHistory' : 'awayHistory']: [...prev[team === 'home' ? 'homeHistory' : 'awayHistory'], newEntry]
    }));
  };

  const updateHistoryEntry = (team: 'home' | 'away', index: number, field: keyof RecentMatch, value: string | number) => {
    const list = [...(team === 'home' ? formData.homeHistory : formData.awayHistory)];
    list[index] = { ...list[index], [field]: field === 'date' ? value : Number(value) };
    setFormData(prev => ({ ...prev, [team === 'home' ? 'homeHistory' : 'awayHistory']: list }));
  };

  const removeHistoryEntry = (team: 'home' | 'away', index: number) => {
    setFormData(prev => ({
      ...prev,
      [team === 'home' ? 'homeHistory' : 'awayHistory']: prev[team === 'home' ? 'homeHistory' : 'awayHistory'].filter((_, i) => i !== index)
    }));
  };

  // FASE 1: Funções para H2H
  const addH2HEntry = () => {
    const newEntry: H2HMatch = { 
      date: new Date().toISOString().split('T')[0], 
      homeScore: 0, 
      awayScore: 0,
      totalGoals: 0
    };
    setFormData(prev => ({
      ...prev,
      h2hMatches: [...(prev.h2hMatches || []), newEntry]
    }));
  };

  const updateH2HEntry = (index: number, field: keyof H2HMatch, value: string | number) => {
    const list = [...(formData.h2hMatches || [])];
    const updatedEntry = { 
      ...list[index], 
      [field]: field === 'date' ? value : Number(value)
    };
    if (field === 'homeScore' || field === 'awayScore') {
      updatedEntry.totalGoals = updatedEntry.homeScore + updatedEntry.awayScore;
    }
    list[index] = updatedEntry;
    setFormData(prev => ({ ...prev, h2hMatches: list }));
  };

  const removeH2HEntry = (index: number) => {
    setFormData(prev => ({
      ...prev,
      h2hMatches: (prev.h2hMatches || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAnalyze(formData);
  };

  const InfoIcon = ({ text }: { text: string }) => (
    <div className="tooltip tooltip-top cursor-help ml-1" data-tip={text}>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 opacity-50 hover:opacity-100 transition-opacity">
        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
      </svg>
    </div>
  );

  const renderHistoryInputs = (team: 'home' | 'away') => {
    const history = team === 'home' ? formData.homeHistory : formData.awayHistory;
    return (
      <div className="flex flex-col gap-2 mt-2">
        {history.map((match, idx) => (
          <div key={idx} className="flex items-center gap-1 bg-base-100/30 p-2 rounded-xl border border-white/5">
            <input 
              type="date" 
              value={match.date} 
              onChange={(e) => updateHistoryEntry(team, idx, 'date', e.target.value)}
              className="input input-xs bg-transparent w-24 p-0 text-[10px]"
            />
            <input 
              type="number" 
              value={match.homeScore} 
              onChange={(e) => updateHistoryEntry(team, idx, 'homeScore', e.target.value)}
              className="input input-xs w-8 text-center bg-base-300 p-0"
            />
            <span className="text-[10px] opacity-30">x</span>
            <input 
              type="number" 
              value={match.awayScore} 
              onChange={(e) => updateHistoryEntry(team, idx, 'awayScore', e.target.value)}
              className="input input-xs w-8 text-center bg-base-300 p-0"
            />
            <button type="button" onClick={() => removeHistoryEntry(team, idx)} className="btn btn-xs btn-circle btn-ghost text-error ml-auto">×</button>
          </div>
        ))}
        {history.length < 5 && (
          <button type="button" onClick={() => addHistoryEntry(team)} className="btn btn-xs btn-ghost border-dashed border border-white/10 opacity-60 mt-1">
            + Adicionar Jogo Recente
          </button>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="custom-card p-8 flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control">
          <label className="label ml-2"><span className="label-text font-bold">Time Casa</span></label>
          <input name="homeTeam" value={formData.homeTeam} onChange={handleChange} className="input w-full" placeholder="Ex: Man City" required />
        </div>
        <div className="form-control">
          <label className="label ml-2"><span className="label-text font-bold">Time Fora</span></label>
          <input name="awayTeam" value={formData.awayTeam} onChange={handleChange} className="input w-full" placeholder="Ex: Real Madrid" required />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control">
          <label className="label ml-2 flex items-center">
            <span className="label-text font-bold">Data da Partida</span>
            <InfoIcon text="Data em que a partida será realizada." />
          </label>
          <input 
            type="date" 
            name="matchDate" 
            value={formData.matchDate || ''} 
            onChange={handleChange} 
            className="input w-full" 
          />
        </div>
        <div className="form-control">
          <label className="label ml-2 flex items-center">
            <span className="label-text font-bold">Hora da Partida</span>
            <InfoIcon text="Horário de início da partida (formato 24h)." />
          </label>
          <input 
            type="time" 
            name="matchTime" 
            value={formData.matchTime || ''} 
            onChange={handleChange} 
            className="input w-full" 
          />
        </div>
      </div>

      <div className="form-control">
        <label className="label ml-2 flex items-center">
          <span className="label-text font-bold">Odd Over 1.5</span>
          <InfoIcon text="Insira a odd atual do mercado Over 1.5 para calcular o EV (Valor Esperado)." />
        </label>
        <input type="number" step="0.01" name="oddOver15" value={formData.oddOver15} onChange={handleChange} className="input w-full" placeholder="Ex: 1.50" />
      </div>

      {/* Seção: ÚLTIMOS 10 JOGOS - PERCURSO */}
      <div className="bg-primary/5 p-4 rounded-3xl border border-primary/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <span className="text-[10px] uppercase font-black opacity-40 tracking-widest">PERCURSO - Últimos 10 Jogos</span>
            <InfoIcon text="Sequências e contadores baseados nos últimos 10 jogos. Separe por Casa (Home), Fora (Away) e Global." />
          </div>
          <div className="badge badge-primary badge-xs py-2 px-3 text-[9px] font-bold">10 JOGOS</div>
        </div>
        
        {/* Time Casa - PERCURSO */}
        <div className="mb-6">
          <h4 className="text-xs font-bold mb-3 text-primary">{formData.homeTeam || 'Time Casa'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Casa */}
            <div className="bg-base-100/30 p-3 rounded-xl border border-primary/10">
              <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Casa</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Vitórias</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.home.winStreak || ''} onChange={(e) => updateTeamStats('home', 'percurso.home.winStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Empates</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.home.drawStreak || ''} onChange={(e) => updateTeamStats('home', 'percurso.home.drawStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Derrotas</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.home.lossStreak || ''} onChange={(e) => updateTeamStats('home', 'percurso.home.lossStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não ganha há</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.home.withoutWin || ''} onChange={(e) => updateTeamStats('home', 'percurso.home.withoutWin', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não empata há</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.home.withoutDraw || ''} onChange={(e) => updateTeamStats('home', 'percurso.home.withoutDraw', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não perde há</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.home.withoutLoss || ''} onChange={(e) => updateTeamStats('home', 'percurso.home.withoutLoss', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
              </div>
            </div>
            
            {/* Fora */}
            <div className="bg-base-100/30 p-3 rounded-xl border border-primary/10">
              <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Fora</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Vitórias</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.away.winStreak || ''} onChange={(e) => updateTeamStats('home', 'percurso.away.winStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Empates</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.away.drawStreak || ''} onChange={(e) => updateTeamStats('home', 'percurso.away.drawStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Derrotas</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.away.lossStreak || ''} onChange={(e) => updateTeamStats('home', 'percurso.away.lossStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não ganha há</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.away.withoutWin || ''} onChange={(e) => updateTeamStats('home', 'percurso.away.withoutWin', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não empata há</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.away.withoutDraw || ''} onChange={(e) => updateTeamStats('home', 'percurso.away.withoutDraw', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não perde há</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.away.withoutLoss || ''} onChange={(e) => updateTeamStats('home', 'percurso.away.withoutLoss', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
              </div>
            </div>
            
            {/* Global */}
            <div className="bg-base-100/30 p-3 rounded-xl border border-primary/10">
              <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Global</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Vitórias</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.global.winStreak || ''} onChange={(e) => updateTeamStats('home', 'percurso.global.winStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Empates</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.global.drawStreak || ''} onChange={(e) => updateTeamStats('home', 'percurso.global.drawStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Derrotas</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.global.lossStreak || ''} onChange={(e) => updateTeamStats('home', 'percurso.global.lossStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não ganha há</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.global.withoutWin || ''} onChange={(e) => updateTeamStats('home', 'percurso.global.withoutWin', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não empata há</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.global.withoutDraw || ''} onChange={(e) => updateTeamStats('home', 'percurso.global.withoutDraw', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não perde há</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.percurso.global.withoutLoss || ''} onChange={(e) => updateTeamStats('home', 'percurso.global.withoutLoss', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Time Fora - PERCURSO */}
        <div>
          <h4 className="text-xs font-bold mb-3 text-secondary">{formData.awayTeam || 'Time Fora'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Casa */}
            <div className="bg-base-100/30 p-3 rounded-xl border border-secondary/10">
              <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Casa</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Vitórias</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.home.winStreak || ''} onChange={(e) => updateTeamStats('away', 'percurso.home.winStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Empates</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.home.drawStreak || ''} onChange={(e) => updateTeamStats('away', 'percurso.home.drawStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Derrotas</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.home.lossStreak || ''} onChange={(e) => updateTeamStats('away', 'percurso.home.lossStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não ganha há</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.home.withoutWin || ''} onChange={(e) => updateTeamStats('away', 'percurso.home.withoutWin', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não empata há</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.home.withoutDraw || ''} onChange={(e) => updateTeamStats('away', 'percurso.home.withoutDraw', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não perde há</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.home.withoutLoss || ''} onChange={(e) => updateTeamStats('away', 'percurso.home.withoutLoss', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
              </div>
            </div>
            
            {/* Fora */}
            <div className="bg-base-100/30 p-3 rounded-xl border border-secondary/10">
              <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Fora</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Vitórias</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.away.winStreak || ''} onChange={(e) => updateTeamStats('away', 'percurso.away.winStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Empates</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.away.drawStreak || ''} onChange={(e) => updateTeamStats('away', 'percurso.away.drawStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Derrotas</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.away.lossStreak || ''} onChange={(e) => updateTeamStats('away', 'percurso.away.lossStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não ganha há</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.away.withoutWin || ''} onChange={(e) => updateTeamStats('away', 'percurso.away.withoutWin', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não empata há</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.away.withoutDraw || ''} onChange={(e) => updateTeamStats('away', 'percurso.away.withoutDraw', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não perde há</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.away.withoutLoss || ''} onChange={(e) => updateTeamStats('away', 'percurso.away.withoutLoss', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
              </div>
            </div>
            
            {/* Global */}
            <div className="bg-base-100/30 p-3 rounded-xl border border-secondary/10">
              <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Global</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Vitórias</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.global.winStreak || ''} onChange={(e) => updateTeamStats('away', 'percurso.global.winStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Empates</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.global.drawStreak || ''} onChange={(e) => updateTeamStats('away', 'percurso.global.drawStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Seq. Derrotas</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.global.lossStreak || ''} onChange={(e) => updateTeamStats('away', 'percurso.global.lossStreak', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não ganha há</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.global.withoutWin || ''} onChange={(e) => updateTeamStats('away', 'percurso.global.withoutWin', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não empata há</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.global.withoutDraw || ''} onChange={(e) => updateTeamStats('away', 'percurso.global.withoutDraw', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Não perde há</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.percurso.global.withoutLoss || ''} onChange={(e) => updateTeamStats('away', 'percurso.global.withoutLoss', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="-" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seção: ÚLTIMOS 10 JOGOS - GOLS */}
      <div className="bg-teal-500/5 p-4 rounded-3xl border border-teal-500/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <span className="text-[10px] uppercase font-black opacity-40 tracking-widest">GOLS - Últimos 10 Jogos</span>
            <InfoIcon text="Estatísticas de gols baseadas nos últimos 10 jogos. Separe por Casa (Home), Fora (Away) e Global." />
          </div>
          <div className="badge badge-info badge-xs py-2 px-3 text-[9px] font-bold">10 JOGOS</div>
        </div>
        
        {/* Time Casa - GOLS */}
        <div className="mb-6">
          <h4 className="text-xs font-bold mb-3 text-teal-400">{formData.homeTeam || 'Time Casa'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Casa */}
            <div className="bg-base-100/30 p-3 rounded-xl border border-teal-500/10">
              <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Casa</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Marcados</span></label>
                  <input type="number" step="0.01" value={formData.homeTeamStats?.gols.home.avgScored || ''} onChange={(e) => updateTeamStats('home', 'gols.home.avgScored', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Sofridos</span></label>
                  <input type="number" step="0.01" value={formData.homeTeamStats?.gols.home.avgConceded || ''} onChange={(e) => updateTeamStats('home', 'gols.home.avgConceded', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Total</span></label>
                  <input type="number" step="0.01" value={formData.homeTeamStats?.gols.home.avgTotal || ''} onChange={(e) => updateTeamStats('home', 'gols.home.avgTotal', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Sem Sofrer %</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.gols.home.cleanSheetPct || ''} onChange={(e) => updateTeamStats('home', 'gols.home.cleanSheetPct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Sem Marcar %</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.gols.home.noGoalsPct || ''} onChange={(e) => updateTeamStats('home', 'gols.home.noGoalsPct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Over 2.5 %</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.gols.home.over25Pct || ''} onChange={(e) => updateTeamStats('home', 'gols.home.over25Pct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control col-span-2">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Under 2.5 %</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.gols.home.under25Pct || ''} onChange={(e) => updateTeamStats('home', 'gols.home.under25Pct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
              </div>
            </div>
            
            {/* Fora */}
            <div className="bg-base-100/30 p-3 rounded-xl border border-teal-500/10">
              <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Fora</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Marcados</span></label>
                  <input type="number" step="0.01" value={formData.homeTeamStats?.gols.away.avgScored || ''} onChange={(e) => updateTeamStats('home', 'gols.away.avgScored', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Sofridos</span></label>
                  <input type="number" step="0.01" value={formData.homeTeamStats?.gols.away.avgConceded || ''} onChange={(e) => updateTeamStats('home', 'gols.away.avgConceded', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Total</span></label>
                  <input type="number" step="0.01" value={formData.homeTeamStats?.gols.away.avgTotal || ''} onChange={(e) => updateTeamStats('home', 'gols.away.avgTotal', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Sem Sofrer %</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.gols.away.cleanSheetPct || ''} onChange={(e) => updateTeamStats('home', 'gols.away.cleanSheetPct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Sem Marcar %</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.gols.away.noGoalsPct || ''} onChange={(e) => updateTeamStats('home', 'gols.away.noGoalsPct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Over 2.5 %</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.gols.away.over25Pct || ''} onChange={(e) => updateTeamStats('home', 'gols.away.over25Pct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control col-span-2">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Under 2.5 %</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.gols.away.under25Pct || ''} onChange={(e) => updateTeamStats('home', 'gols.away.under25Pct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
              </div>
            </div>
            
            {/* Global */}
            <div className="bg-base-100/30 p-3 rounded-xl border border-teal-500/10">
              <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Global</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Marcados</span></label>
                  <input type="number" step="0.01" value={formData.homeTeamStats?.gols.global.avgScored || ''} onChange={(e) => updateTeamStats('home', 'gols.global.avgScored', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Sofridos</span></label>
                  <input type="number" step="0.01" value={formData.homeTeamStats?.gols.global.avgConceded || ''} onChange={(e) => updateTeamStats('home', 'gols.global.avgConceded', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Total</span></label>
                  <input type="number" step="0.01" value={formData.homeTeamStats?.gols.global.avgTotal || ''} onChange={(e) => updateTeamStats('home', 'gols.global.avgTotal', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Sem Sofrer %</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.gols.global.cleanSheetPct || ''} onChange={(e) => updateTeamStats('home', 'gols.global.cleanSheetPct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Sem Marcar %</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.gols.global.noGoalsPct || ''} onChange={(e) => updateTeamStats('home', 'gols.global.noGoalsPct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Over 2.5 %</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.gols.global.over25Pct || ''} onChange={(e) => updateTeamStats('home', 'gols.global.over25Pct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control col-span-2">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Under 2.5 %</span></label>
                  <input type="number" step="1" value={formData.homeTeamStats?.gols.global.under25Pct || ''} onChange={(e) => updateTeamStats('home', 'gols.global.under25Pct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Time Fora - GOLS */}
        <div>
          <h4 className="text-xs font-bold mb-3 text-teal-400">{formData.awayTeam || 'Time Fora'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Casa */}
            <div className="bg-base-100/30 p-3 rounded-xl border border-teal-500/10">
              <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Casa</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Marcados</span></label>
                  <input type="number" step="0.01" value={formData.awayTeamStats?.gols.home.avgScored || ''} onChange={(e) => updateTeamStats('away', 'gols.home.avgScored', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Sofridos</span></label>
                  <input type="number" step="0.01" value={formData.awayTeamStats?.gols.home.avgConceded || ''} onChange={(e) => updateTeamStats('away', 'gols.home.avgConceded', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Total</span></label>
                  <input type="number" step="0.01" value={formData.awayTeamStats?.gols.home.avgTotal || ''} onChange={(e) => updateTeamStats('away', 'gols.home.avgTotal', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Sem Sofrer %</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.gols.home.cleanSheetPct || ''} onChange={(e) => updateTeamStats('away', 'gols.home.cleanSheetPct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Sem Marcar %</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.gols.home.noGoalsPct || ''} onChange={(e) => updateTeamStats('away', 'gols.home.noGoalsPct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Over 2.5 %</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.gols.home.over25Pct || ''} onChange={(e) => updateTeamStats('away', 'gols.home.over25Pct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control col-span-2">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Under 2.5 %</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.gols.home.under25Pct || ''} onChange={(e) => updateTeamStats('away', 'gols.home.under25Pct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
              </div>
            </div>
            
            {/* Fora */}
            <div className="bg-base-100/30 p-3 rounded-xl border border-teal-500/10">
              <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Fora</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Marcados</span></label>
                  <input type="number" step="0.01" value={formData.awayTeamStats?.gols.away.avgScored || ''} onChange={(e) => updateTeamStats('away', 'gols.away.avgScored', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Sofridos</span></label>
                  <input type="number" step="0.01" value={formData.awayTeamStats?.gols.away.avgConceded || ''} onChange={(e) => updateTeamStats('away', 'gols.away.avgConceded', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Total</span></label>
                  <input type="number" step="0.01" value={formData.awayTeamStats?.gols.away.avgTotal || ''} onChange={(e) => updateTeamStats('away', 'gols.away.avgTotal', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Sem Sofrer %</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.gols.away.cleanSheetPct || ''} onChange={(e) => updateTeamStats('away', 'gols.away.cleanSheetPct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Sem Marcar %</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.gols.away.noGoalsPct || ''} onChange={(e) => updateTeamStats('away', 'gols.away.noGoalsPct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Over 2.5 %</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.gols.away.over25Pct || ''} onChange={(e) => updateTeamStats('away', 'gols.away.over25Pct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control col-span-2">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Under 2.5 %</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.gols.away.under25Pct || ''} onChange={(e) => updateTeamStats('away', 'gols.away.under25Pct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
              </div>
            </div>
            
            {/* Global */}
            <div className="bg-base-100/30 p-3 rounded-xl border border-teal-500/10">
              <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Global</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Marcados</span></label>
                  <input type="number" step="0.01" value={formData.awayTeamStats?.gols.global.avgScored || ''} onChange={(e) => updateTeamStats('away', 'gols.global.avgScored', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Sofridos</span></label>
                  <input type="number" step="0.01" value={formData.awayTeamStats?.gols.global.avgConceded || ''} onChange={(e) => updateTeamStats('away', 'gols.global.avgConceded', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Média Total</span></label>
                  <input type="number" step="0.01" value={formData.awayTeamStats?.gols.global.avgTotal || ''} onChange={(e) => updateTeamStats('away', 'gols.global.avgTotal', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0.00" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Sem Sofrer %</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.gols.global.cleanSheetPct || ''} onChange={(e) => updateTeamStats('away', 'gols.global.cleanSheetPct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Sem Marcar %</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.gols.global.noGoalsPct || ''} onChange={(e) => updateTeamStats('away', 'gols.global.noGoalsPct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Over 2.5 %</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.gols.global.over25Pct || ''} onChange={(e) => updateTeamStats('away', 'gols.global.over25Pct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
                <div className="form-control col-span-2">
                  <label className="label py-0"><span className="label-text text-[9px] font-bold">Under 2.5 %</span></label>
                  <input type="number" step="1" value={formData.awayTeamStats?.gols.global.under25Pct || ''} onChange={(e) => updateTeamStats('away', 'gols.global.under25Pct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FASE 1: Desempenho Casa vs Fora */}
      <div className="bg-secondary/5 p-4 rounded-3xl border border-secondary/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <span className="text-[10px] uppercase font-black opacity-40 tracking-widest">Desempenho Casa vs Fora</span>
            <InfoIcon text="Métricas específicas de desempenho em casa (mandante) e fora (visitante). Se não preenchido, usa médias gerais." />
          </div>
          <div className="badge badge-secondary badge-xs py-2 px-3 text-[9px] font-bold">OPCIONAL</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="form-control">
            <label className="label ml-2">
              <span className="label-text text-[10px] font-bold">Casa: Gols Marcados (Casa)</span>
            </label>
            <input type="number" step="0.1" name="homeGoalsScoredAtHome" value={formData.homeGoalsScoredAtHome || ''} onChange={handleChange} className="input w-full text-center input-sm" placeholder="Ex: 1.8" />
          </div>
          <div className="form-control">
            <label className="label ml-2">
              <span className="label-text text-[10px] font-bold">Casa: Gols Sofridos (Casa)</span>
            </label>
            <input type="number" step="0.1" name="homeGoalsConcededAtHome" value={formData.homeGoalsConcededAtHome || ''} onChange={handleChange} className="input w-full text-center input-sm" placeholder="Ex: 0.9" />
          </div>
          <div className="form-control">
            <label className="label ml-2">
              <span className="label-text text-[10px] font-bold">Fora: Gols Marcados (Fora)</span>
            </label>
            <input type="number" step="0.1" name="awayGoalsScoredAway" value={formData.awayGoalsScoredAway || ''} onChange={handleChange} className="input w-full text-center input-sm" placeholder="Ex: 1.3" />
          </div>
          <div className="form-control">
            <label className="label ml-2">
              <span className="label-text text-[10px] font-bold">Fora: Gols Sofridos (Fora)</span>
            </label>
            <input type="number" step="0.1" name="awayGoalsConcededAway" value={formData.awayGoalsConcededAway || ''} onChange={handleChange} className="input w-full text-center input-sm" placeholder="Ex: 1.5" />
          </div>
        </div>
      </div>

      <div className="divider opacity-30 text-[10px] uppercase tracking-[0.2em] font-black">
        Médias Estatísticas
        <InfoIcon text="Utilize médias calculadas sobre os últimos 10 jogos para maior estabilidade matemática." />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="form-control">
          <label className="label ml-2 flex items-center">
            <span className="label-text text-[10px] font-bold">Casa xG</span>
            <InfoIcon text="Média de Gols Esperados (xG) do time da casa nos últimos 10 jogos." />
          </label>
          <input type="number" step="0.1" name="homeXG" value={formData.homeXG} onChange={handleChange} className="input w-full text-center" />
        </div>
        <div className="form-control">
          <label className="label ml-2 flex items-center">
            <span className="label-text text-[10px] font-bold">Casa Chutes</span>
            <InfoIcon text="Média de chutes no alvo do time da casa nos últimos 10 jogos." />
          </label>
          <input type="number" step="0.1" name="homeShotsOnTarget" value={formData.homeShotsOnTarget} onChange={handleChange} className="input w-full text-center" />
        </div>
        <div className="form-control">
          <label className="label ml-2 flex items-center">
            <span className="label-text text-[10px] font-bold">Fora xG</span>
            <InfoIcon text="Média de Gols Esperados (xG) do time de fora nos últimos 10 jogos." />
          </label>
          <input type="number" step="0.1" name="awayXG" value={formData.awayXG} onChange={handleChange} className="input w-full text-center" />
        </div>
        <div className="form-control">
          <label className="label ml-2 flex items-center">
            <span className="label-text text-[10px] font-bold">Fora Chutes</span>
            <InfoIcon text="Média de chutes no alvo do time de fora nos últimos 10 jogos." />
          </label>
          <input type="number" step="0.1" name="awayShotsOnTarget" value={formData.awayShotsOnTarget} onChange={handleChange} className="input w-full text-center" />
        </div>
      </div>

      {/* FASE 1: xA e Passes Avançados */}
      <div className="bg-accent/5 p-4 rounded-3xl border border-accent/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <span className="text-[10px] uppercase font-black opacity-40 tracking-widest">Métricas Avançadas de Criação</span>
            <InfoIcon text="xA mede qualidade de assistências. Passes progressivos/chave indicam capacidade ofensiva." />
          </div>
          <div className="badge badge-accent badge-xs py-2 px-3 text-[9px] font-bold">OPCIONAL</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="form-control">
            <label className="label ml-2">
              <span className="label-text text-[10px] font-bold">Casa xA</span>
            </label>
            <input type="number" step="0.1" name="homeXA" value={formData.homeXA || ''} onChange={handleChange} className="input w-full text-center input-sm" placeholder="Ex: 1.2" />
          </div>
          <div className="form-control">
            <label className="label ml-2">
              <span className="label-text text-[10px] font-bold">Fora xA</span>
            </label>
            <input type="number" step="0.1" name="awayXA" value={formData.awayXA || ''} onChange={handleChange} className="input w-full text-center input-sm" placeholder="Ex: 1.0" />
          </div>
          <div className="form-control">
            <label className="label ml-2">
              <span className="label-text text-[10px] font-bold">Casa Passes Prog.</span>
            </label>
            <input type="number" step="1" name="homeProgressivePasses" value={formData.homeProgressivePasses || ''} onChange={handleChange} className="input w-full text-center input-sm" placeholder="Ex: 120" />
          </div>
          <div className="form-control">
            <label className="label ml-2">
              <span className="label-text text-[10px] font-bold">Fora Passes Prog.</span>
            </label>
            <input type="number" step="1" name="awayProgressivePasses" value={formData.awayProgressivePasses || ''} onChange={handleChange} className="input w-full text-center input-sm" placeholder="Ex: 100" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="form-control">
            <label className="label ml-2">
              <span className="label-text text-[10px] font-bold">Casa Passes Chave</span>
            </label>
            <input type="number" step="1" name="homeKeyPasses" value={formData.homeKeyPasses || ''} onChange={handleChange} className="input w-full text-center input-sm" placeholder="Ex: 12" />
          </div>
          <div className="form-control">
            <label className="label ml-2">
              <span className="label-text text-[10px] font-bold">Fora Passes Chave</span>
            </label>
            <input type="number" step="1" name="awayKeyPasses" value={formData.awayKeyPasses || ''} onChange={handleChange} className="input w-full text-center input-sm" placeholder="Ex: 10" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="form-control">
          <label className="label ml-2 flex items-center">
            <span className="label-text text-[10px] font-bold">Casa O1.5%</span>
            <InfoIcon text="Frequência (%) que o time da casa teve Over 1.5 nos últimos 10 jogos." />
          </label>
          <input type="number" name="homeOver15Freq" value={formData.homeOver15Freq} onChange={handleChange} className="input w-full text-center" />
        </div>
        <div className="form-control">
          <label className="label ml-2 flex items-center">
            <span className="label-text text-[10px] font-bold">Fora O1.5%</span>
            <InfoIcon text="Frequência (%) que o time de fora teve Over 1.5 nos últimos 10 jogos." />
          </label>
          <input type="number" name="awayOver15Freq" value={formData.awayOver15Freq} onChange={handleChange} className="input w-full text-center" />
        </div>
        <div className="form-control">
          <label className="label ml-2 flex items-center">
            <span className="label-text text-[10px] font-bold">Casa CS%</span>
            <InfoIcon text="Clean Sheet %: Quantas vezes não sofreu gols nos últimos 10 jogos." />
          </label>
          <input type="number" name="homeCleanSheetFreq" value={formData.homeCleanSheetFreq} onChange={handleChange} className="input w-full text-center" />
        </div>
        <div className="form-control">
          <label className="label ml-2 flex items-center">
            <span className="label-text text-[10px] font-bold">Fora CS%</span>
            <InfoIcon text="Clean Sheet %: Quantas vezes não sofreu gols nos últimos 10 jogos." />
          </label>
          <input type="number" name="awayCleanSheetFreq" value={formData.awayCleanSheetFreq} onChange={handleChange} className="input w-full text-center" />
        </div>
      </div>

      {/* Seção: Abre Marcador (Opcional, Colapsável) */}
      <div className="bg-warning/5 p-4 rounded-3xl border border-warning/10">
        <button
          type="button"
          onClick={() => setShowFirstGoal(!showFirstGoal)}
          className="flex items-center justify-between w-full mb-3"
        >
          <div className="flex items-center">
            <span className="text-[10px] uppercase font-black opacity-40 tracking-widest">Abre Marcador</span>
            <InfoIcon text="Estatísticas sobre quem abre o placar. Opcional, mas melhora a análise quando disponível." />
          </div>
          <div className="flex items-center gap-2">
            <div className="badge badge-warning badge-xs py-2 px-3 text-[9px] font-bold">OPCIONAL</div>
            {showFirstGoal ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showFirstGoal && (
          <div className="space-y-6">
            {/* Time Casa - Abre Marcador */}
            <div>
              <h4 className="text-xs font-bold mb-3 text-warning">{formData.homeTeam || 'Time Casa'}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Casa */}
                <div className="bg-base-100/30 p-3 rounded-xl border border-warning/10">
                  <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Casa</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Abre Marcador %</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.home.opensScorePct || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.home.opensScorePct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.home.opensScoreCount || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.home.opensScoreCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Vence HT %</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.home.winningAtHT || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.home.winningAtHT', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.home.winningAtHTCount || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.home.winningAtHTCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Vence Final %</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.home.winsFinal || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.home.winsFinal', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.home.winsFinalCount || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.home.winsFinalCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                  </div>
                </div>
                
                {/* Fora */}
                <div className="bg-base-100/30 p-3 rounded-xl border border-warning/10">
                  <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Fora</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Abre Marcador %</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.away.opensScorePct || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.away.opensScorePct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.away.opensScoreCount || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.away.opensScoreCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Vence HT %</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.away.winningAtHT || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.away.winningAtHT', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.away.winningAtHTCount || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.away.winningAtHTCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Vence Final %</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.away.winsFinal || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.away.winsFinal', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.away.winsFinalCount || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.away.winsFinalCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                  </div>
                </div>
                
                {/* Global */}
                <div className="bg-base-100/30 p-3 rounded-xl border border-warning/10">
                  <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Global</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Abre Marcador %</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.global.opensScorePct || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.global.opensScorePct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.global.opensScoreCount || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.global.opensScoreCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Vence HT %</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.global.winningAtHT || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.global.winningAtHT', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.global.winningAtHTCount || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.global.winningAtHTCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Vence Final %</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.global.winsFinal || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.global.winsFinal', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.homeTeamStats?.firstGoal?.global.winsFinalCount || ''} onChange={(e) => updateTeamStats('home', 'firstGoal.global.winsFinalCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Time Fora - Abre Marcador */}
            <div>
              <h4 className="text-xs font-bold mb-3 text-warning">{formData.awayTeam || 'Time Fora'}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Casa */}
                <div className="bg-base-100/30 p-3 rounded-xl border border-warning/10">
                  <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Casa</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Abre Marcador %</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.home.opensScorePct || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.home.opensScorePct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.home.opensScoreCount || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.home.opensScoreCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Vence HT %</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.home.winningAtHT || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.home.winningAtHT', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.home.winningAtHTCount || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.home.winningAtHTCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Vence Final %</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.home.winsFinal || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.home.winsFinal', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.home.winsFinalCount || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.home.winsFinalCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                  </div>
                </div>
                
                {/* Fora */}
                <div className="bg-base-100/30 p-3 rounded-xl border border-warning/10">
                  <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Fora</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Abre Marcador %</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.away.opensScorePct || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.away.opensScorePct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.away.opensScoreCount || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.away.opensScoreCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Vence HT %</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.away.winningAtHT || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.away.winningAtHT', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.away.winningAtHTCount || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.away.winningAtHTCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Vence Final %</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.away.winsFinal || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.away.winsFinal', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.away.winsFinalCount || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.away.winsFinalCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control col-span-2">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Reviravoltas</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.away.comebacks || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.away.comebacks', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                  </div>
                </div>
                
                {/* Global */}
                <div className="bg-base-100/30 p-3 rounded-xl border border-warning/10">
                  <span className="text-[9px] font-bold opacity-60 uppercase mb-2 block">Global</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Abre Marcador %</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.global.opensScorePct || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.global.opensScorePct', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.global.opensScoreCount || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.global.opensScoreCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Vence HT %</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.global.winningAtHT || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.global.winningAtHT', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.global.winningAtHTCount || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.global.winningAtHTCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Vence Final %</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.global.winsFinal || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.global.winsFinal', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-[9px] font-bold">Quantidade</span></label>
                      <input type="number" step="1" value={formData.awayTeamStats?.firstGoal?.global.winsFinalCount || ''} onChange={(e) => updateTeamStats('away', 'firstGoal.global.winsFinalCount', e.target.value ? Number(e.target.value) : undefined)} className="input input-xs text-center" placeholder="0" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FASE 1: H2H Detalhado */}
      <div className="bg-info/5 p-4 rounded-3xl border border-info/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <span className="text-[10px] uppercase font-black opacity-40 tracking-widest">Confrontos Diretos (H2H)</span>
            <InfoIcon text="Histórico detalhado dos confrontos entre as equipes. Melhora precisão da análise." />
          </div>
          <div className="badge badge-info badge-xs py-2 px-3 text-[9px] font-bold">OPCIONAL</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="form-control">
            <label className="label ml-2 flex items-center">
              <span className="label-text text-[10px] font-bold">H2H Over 1.5%</span>
              <InfoIcon text="Frequência (%) de Over 1.5 nos confrontos diretos." />
            </label>
            <input type="number" name="h2hOver15Freq" value={formData.h2hOver15Freq} onChange={handleChange} className="input w-full text-center" />
          </div>
          <div className="form-control">
            <label className="label ml-2 flex items-center">
              <span className="label-text text-[10px] font-bold">H2H Média de Gols</span>
              <InfoIcon text="Média de gols totais nos confrontos diretos." />
            </label>
            <input type="number" step="0.1" name="h2hAvgGoals" value={formData.h2hAvgGoals || ''} onChange={handleChange} className="input w-full text-center" placeholder="Ex: 2.5" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold opacity-60 ml-2">Últimos Confrontos</span>
          {(formData.h2hMatches || []).map((match, idx) => (
            <div key={idx} className="flex items-center gap-1 bg-base-100/30 p-2 rounded-xl border border-white/5">
              <input 
                type="date" 
                value={match.date} 
                onChange={(e) => updateH2HEntry(idx, 'date', e.target.value)}
                className="input input-xs bg-transparent w-24 p-0 text-[10px]"
              />
              <input 
                type="number" 
                value={match.homeScore} 
                onChange={(e) => updateH2HEntry(idx, 'homeScore', e.target.value)}
                className="input input-xs w-8 text-center bg-base-300 p-0"
              />
              <span className="text-[10px] opacity-30">x</span>
              <input 
                type="number" 
                value={match.awayScore} 
                onChange={(e) => updateH2HEntry(idx, 'awayScore', e.target.value)}
                className="input input-xs w-8 text-center bg-base-300 p-0"
              />
              <span className="text-[10px] opacity-50 ml-1">({match.totalGoals} gols)</span>
              <button type="button" onClick={() => removeH2HEntry(idx)} className="btn btn-xs btn-circle btn-ghost text-error ml-auto">×</button>
            </div>
          ))}
          {(!formData.h2hMatches || formData.h2hMatches.length < 5) && (
            <button type="button" onClick={addH2HEntry} className="btn btn-xs btn-ghost border-dashed border border-white/10 opacity-60 mt-1">
              + Adicionar Confronto H2H
            </button>
          )}
        </div>
      </div>

      <button type="submit" className="btn btn-primary btn-lg mt-4 uppercase font-black tracking-widest shadow-2xl hover:scale-[1.01] active:scale-95 transition-all">
        PROCESSAR ALGORITMO GOALSCAN
      </button>
    </form>
  );
};

export default MatchForm;
