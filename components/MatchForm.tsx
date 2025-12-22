
import React, { useState, useEffect } from 'react';
import { MatchData, RecentMatch, H2HMatch } from '../types';

interface MatchFormProps {
  onAnalyze: (data: MatchData) => void;
  initialData?: MatchData | null;
}

const MatchForm: React.FC<MatchFormProps> = ({ onAnalyze, initialData }) => {
  const [formData, setFormData] = useState<MatchData>(initialData || {
    homeTeam: '',
    awayTeam: '',
    oddOver15: 1.45,
    homeGoalsScoredAvg: 1.6,
    homeGoalsConcededAvg: 1.1,
    awayGoalsScoredAvg: 1.2,
    awayGoalsConcededAvg: 1.4,
    homeXG: 1.7,
    awayXG: 1.3,
    homeShotsOnTarget: 5.2,
    awayShotsOnTarget: 4.1,
    homeOver15Freq: 80,
    awayOver15Freq: 75,
    homeBTTSFreq: 60,
    awayBTTSFreq: 55,
    homeCleanSheetFreq: 20,
    awayCleanSheetFreq: 15,
    h2hOver15Freq: 70,
    matchImportance: 7,
    keyAbsences: 'none',
    homeHistory: [],
    awayHistory: []
  });

  useEffect(() => {
    if (initialData) setFormData(initialData);
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: isNaN(Number(value)) || name === 'homeTeam' || name === 'awayTeam' || name === 'keyAbsences' 
        ? value 
        : value === '' ? undefined : Number(value)
    }));
  };

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

      <div className="form-control">
        <label className="label ml-2 flex items-center">
          <span className="label-text font-bold">Odd Over 1.5</span>
          <InfoIcon text="Insira a odd atual do mercado Over 1.5 para calcular o EV (Valor Esperado)." />
        </label>
        <input type="number" step="0.01" name="oddOver15" value={formData.oddOver15} onChange={handleChange} className="input w-full" placeholder="Ex: 1.50" />
      </div>

      <div className="bg-primary/5 p-4 rounded-3xl border border-primary/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <span className="text-[10px] uppercase font-black opacity-40 tracking-widest">Tendência de Momentum</span>
            <InfoIcon text="Informe os placares reais dos últimos 5 jogos para analisar a fase atual de gols." />
          </div>
          <div className="badge badge-primary badge-xs py-2 px-3 text-[9px] font-bold">5 JOGOS</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <span className="text-[10px] font-bold opacity-60 ml-2">Casa</span>
            {renderHistoryInputs('home')}
          </div>
          <div>
            <span className="text-[10px] font-bold opacity-60 ml-2">Fora</span>
            {renderHistoryInputs('away')}
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
