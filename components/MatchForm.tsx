
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MatchData, TeamStatistics, GolsStats } from '../types';
import { validateMatchData } from '../utils/validation';
import { errorService } from '../services/errorService';
import { animations } from '../utils/animations';

interface MatchFormProps {
  onAnalyze: (data: MatchData) => void;
  initialData?: MatchData | null;
  onError?: (message: string) => void;
}

// Função para criar MatchData vazio
const createEmptyMatchData = (): MatchData => ({
  homeTeam: '',
  awayTeam: '',
  homeOver15Freq: 0,
  awayOver15Freq: 0,
  homeGoalsScoredAvg: 0,
  homeGoalsConcededAvg: 0,
  awayGoalsScoredAvg: 0,
  awayGoalsConcededAvg: 0,
  homeXG: 0,
  awayXG: 0,
  homeShotsOnTarget: 0,
  awayShotsOnTarget: 0,
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

const createEmptyGols = (): GolsStats => ({
  avgScored: 0,
  avgConceded: 0,
  avgTotal: 0,
  cleanSheetPct: 0,
  noGoalsPct: 0,
  over25Pct: 0,
  under25Pct: 0
});

const MatchForm: React.FC<MatchFormProps> = ({ onAnalyze, initialData, onError }) => {
  const [formData, setFormData] = useState<MatchData>(initialData || createEmptyMatchData());

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData(createEmptyMatchData());
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: isNaN(Number(value)) || name === 'homeTeam' || name === 'awayTeam' || name === 'matchDate' || name === 'matchTime'
        ? value 
        : value === '' ? undefined : Number(value)
    }));
  };

  // Função para atualizar estatísticas globais de gols
  const updateTeamStats = (team: 'home' | 'away', field: keyof GolsStats, value: number | undefined) => {
    setFormData(prev => {
      const teamKey = team === 'home' ? 'homeTeamStats' : 'awayTeamStats';
      const currentStats = prev[teamKey] || {
        percurso: { home: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 }, away: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 }, global: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 } },
        gols: { home: createEmptyGols(), away: createEmptyGols(), global: createEmptyGols() }
      };
      
      const newStats: TeamStatistics = {
        ...currentStats,
        gols: {
          ...currentStats.gols,
          global: {
            ...currentStats.gols.global,
            [field]: value === '' ? 0 : (value ?? 0)
          }
        }
      };
      
      return {
        ...prev,
        [teamKey]: newStats
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validar dados antes de enviar
      const validatedData = validateMatchData(formData);
      onAnalyze(validatedData);
    } catch (error) {
      // Mostrar erro de validação de forma amigável
      const errorMessage = error instanceof Error ? error.message : 'Erro de validação desconhecido';
      // Registrar erro no serviço centralizado
      errorService.logValidationError('MatchForm', formData, errorMessage);
      
      if (onError) {
        onError(`Erro ao validar dados: ${errorMessage}`);
      } else {
        alert(`Erro ao validar dados: ${errorMessage}`);
      }
    }
  };

  const InfoIcon = ({ text }: { text: string }) => (
    <div className="tooltip tooltip-top cursor-help ml-1" data-tip={text} role="tooltip">
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        strokeWidth={1.5} 
        stroke="currentColor" 
        className="w-4 h-4 opacity-50 hover:opacity-100 transition-opacity"
        aria-label={text}
        role="img"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
      </svg>
    </div>
  );

  return (
    <motion.form 
      onSubmit={handleSubmit} 
      className="custom-card p-4 md:p-6 lg:p-8 flex flex-col gap-4 md:gap-6"
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
    >
      {/* Informações Básicas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control">
          <label htmlFor="homeTeam" className="label ml-2"><span className="label-text font-bold">Time Casa</span></label>
          <input 
            id="homeTeam"
            name="homeTeam" 
            value={formData.homeTeam} 
            onChange={handleChange} 
            className="input w-full min-h-[44px] text-base focus:outline-none focus:ring-2 focus:ring-primary" 
            placeholder="Ex: Man City" 
            required 
            aria-required="true"
            aria-label="Nome do time da casa"
          />
        </div>
        <div className="form-control">
          <label htmlFor="awayTeam" className="label ml-2"><span className="label-text font-bold">Time Visitante</span></label>
          <input 
            id="awayTeam"
            name="awayTeam" 
            value={formData.awayTeam} 
            onChange={handleChange} 
            className="input w-full min-h-[44px] text-base focus:outline-none focus:ring-2 focus:ring-primary" 
            placeholder="Ex: Real Madrid" 
            required 
            aria-required="true"
            aria-label="Nome do time visitante"
          />
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
            className="input w-full min-h-[44px] text-base" 
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
            className="input w-full min-h-[44px] text-base" 
          />
        </div>
      </div>

      {/* Competição (Média) */}
      <div className="form-control">
        <label className="label ml-2 flex items-center">
          <span className="label-text font-bold">Competição (Média)</span>
          <InfoIcon text="Média da competição." />
        </label>
        <input 
          type="number" 
          step="0.01" 
          name="competitionAvg" 
          value={formData.competitionAvg || ''} 
          onChange={handleChange} 
          className="input w-full" 
          placeholder="Ex: 76.87" 
        />
      </div>

      {/* Odd Over 1.5 */}
      <div className="form-control">
        <label className="label ml-2 flex items-center">
          <span className="label-text font-bold">Odd Over 1.5</span>
          <InfoIcon text="Insira a odd atual do mercado Over 1.5 para calcular o EV (Valor Esperado)." />
        </label>
        <input 
          type="number" 
          step="0.01" 
          name="oddOver15" 
          value={formData.oddOver15 || ''} 
          onChange={handleChange} 
          className="input w-full" 
          placeholder="Ex: 1.50" 
        />
      </div>

      {/* Estatísticas Globais - Time Casa */}
      <div className="bg-teal-500/5 p-4 rounded-3xl border border-teal-500/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <span className="text-[10px] uppercase font-black opacity-40 tracking-widest">Estatísticas Globais - {formData.homeTeam || 'Time Casa'}</span>
            <InfoIcon text="Estatísticas de gols baseadas nos últimos 10 jogos (Geral)." />
              </div>
            </div>
            
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="form-control">
            <label className="label py-0"><span className="label-text text-[10px] font-bold">Média Marcados</span></label>
            <input 
              type="number" 
              step="0.01" 
              value={formData.homeTeamStats?.gols.global.avgScored || ''} 
              onChange={(e) => updateTeamStats('home', 'avgScored', e.target.value ? Number(e.target.value) : undefined)} 
              className="input input-sm text-center min-h-[44px]" 
              placeholder="0.00" 
            />
                </div>
                <div className="form-control">
            <label className="label py-0"><span className="label-text text-[10px] font-bold">Média Sofridos</span></label>
            <input 
              type="number" 
              step="0.01" 
              value={formData.homeTeamStats?.gols.global.avgConceded || ''} 
              onChange={(e) => updateTeamStats('home', 'avgConceded', e.target.value ? Number(e.target.value) : undefined)} 
              className="input input-sm text-center min-h-[44px]" 
              placeholder="0.00" 
            />
                </div>
                <div className="form-control">
            <label className="label py-0"><span className="label-text text-[10px] font-bold">Média Total</span></label>
            <input 
              type="number" 
              step="0.01" 
              value={formData.homeTeamStats?.gols.global.avgTotal || ''} 
              onChange={(e) => updateTeamStats('home', 'avgTotal', e.target.value ? Number(e.target.value) : undefined)} 
              className="input input-sm text-center min-h-[44px]" 
              placeholder="0.00" 
            />
                </div>
                <div className="form-control">
            <label className="label py-0"><span className="label-text text-[10px] font-bold">Sem Sofrer %</span></label>
            <input 
              type="number" 
              step="1" 
              value={formData.homeTeamStats?.gols.global.cleanSheetPct || ''} 
              onChange={(e) => updateTeamStats('home', 'cleanSheetPct', e.target.value ? Number(e.target.value) : undefined)} 
              className="input input-sm text-center min-h-[44px]" 
              placeholder="0" 
            />
                </div>
                <div className="form-control">
            <label className="label py-0"><span className="label-text text-[10px] font-bold">Sem Marcar %</span></label>
            <input 
              type="number" 
              step="1" 
              value={formData.homeTeamStats?.gols.global.noGoalsPct || ''} 
              onChange={(e) => updateTeamStats('home', 'noGoalsPct', e.target.value ? Number(e.target.value) : undefined)} 
              className="input input-sm text-center min-h-[44px]" 
              placeholder="0" 
            />
                </div>
                <div className="form-control">
            <label className="label py-0"><span className="label-text text-[10px] font-bold">Over 2.5 %</span></label>
            <input 
              type="number" 
              step="1" 
              value={formData.homeTeamStats?.gols.global.over25Pct || ''} 
              onChange={(e) => updateTeamStats('home', 'over25Pct', e.target.value ? Number(e.target.value) : undefined)} 
              className="input input-sm text-center min-h-[44px]" 
              placeholder="0" 
            />
                </div>
                <div className="form-control">
            <label className="label py-0"><span className="label-text text-[10px] font-bold">Under 2.5 %</span></label>
            <input 
              type="number" 
              step="1" 
              value={formData.homeTeamStats?.gols.global.under25Pct || ''} 
              onChange={(e) => updateTeamStats('home', 'under25Pct', e.target.value ? Number(e.target.value) : undefined)} 
              className="input input-sm text-center min-h-[44px]" 
              placeholder="0" 
            />
                </div>
                <div className="form-control">
            <label className="label py-0"><span className="label-text text-[10px] font-bold">Over 1.5 %</span></label>
            <input 
              type="number" 
              step="1" 
              name="homeOver15Freq" 
              value={formData.homeOver15Freq} 
              onChange={handleChange} 
              className="input input-sm text-center min-h-[44px]" 
              placeholder="0" 
            />
            </div>
          </div>
        </div>

      {/* Estatísticas Globais - Time Visitante */}
      <div className="bg-teal-500/5 p-4 rounded-3xl border border-teal-500/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <span className="text-[10px] uppercase font-black opacity-40 tracking-widest">Estatísticas Globais - {formData.awayTeam || 'Time Visitante'}</span>
            <InfoIcon text="Estatísticas de gols baseadas nos últimos 10 jogos (Geral)." />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="form-control">
            <label className="label py-0"><span className="label-text text-[10px] font-bold">Média Marcados</span></label>
            <input 
              type="number" 
              step="0.01" 
              value={formData.awayTeamStats?.gols.global.avgScored || ''} 
              onChange={(e) => updateTeamStats('away', 'avgScored', e.target.value ? Number(e.target.value) : undefined)} 
              className="input input-sm text-center min-h-[44px]" 
              placeholder="0.00" 
            />
        </div>
        <div className="form-control">
            <label className="label py-0"><span className="label-text text-[10px] font-bold">Média Sofridos</span></label>
            <input 
              type="number" 
              step="0.01" 
              value={formData.awayTeamStats?.gols.global.avgConceded || ''} 
              onChange={(e) => updateTeamStats('away', 'avgConceded', e.target.value ? Number(e.target.value) : undefined)} 
              className="input input-sm text-center min-h-[44px]" 
              placeholder="0.00" 
            />
        </div>
        <div className="form-control">
            <label className="label py-0"><span className="label-text text-[10px] font-bold">Média Total</span></label>
            <input 
              type="number" 
              step="0.01" 
              value={formData.awayTeamStats?.gols.global.avgTotal || ''} 
              onChange={(e) => updateTeamStats('away', 'avgTotal', e.target.value ? Number(e.target.value) : undefined)} 
              className="input input-sm text-center min-h-[44px]" 
              placeholder="0.00" 
            />
        </div>
        <div className="form-control">
            <label className="label py-0"><span className="label-text text-[10px] font-bold">Sem Sofrer %</span></label>
            <input 
              type="number" 
              step="1" 
              value={formData.awayTeamStats?.gols.global.cleanSheetPct || ''} 
              onChange={(e) => updateTeamStats('away', 'cleanSheetPct', e.target.value ? Number(e.target.value) : undefined)} 
              className="input input-sm text-center min-h-[44px]" 
              placeholder="0" 
            />
                    </div>
                    <div className="form-control">
            <label className="label py-0"><span className="label-text text-[10px] font-bold">Sem Marcar %</span></label>
            <input 
              type="number" 
              step="1" 
              value={formData.awayTeamStats?.gols.global.noGoalsPct || ''} 
              onChange={(e) => updateTeamStats('away', 'noGoalsPct', e.target.value ? Number(e.target.value) : undefined)} 
              className="input input-sm text-center min-h-[44px]" 
              placeholder="0" 
            />
                    </div>
                    <div className="form-control">
            <label className="label py-0"><span className="label-text text-[10px] font-bold">Over 2.5 %</span></label>
            <input 
              type="number" 
              step="1" 
              value={formData.awayTeamStats?.gols.global.over25Pct || ''} 
              onChange={(e) => updateTeamStats('away', 'over25Pct', e.target.value ? Number(e.target.value) : undefined)} 
              className="input input-sm text-center min-h-[44px]" 
              placeholder="0" 
            />
                    </div>
                    <div className="form-control">
            <label className="label py-0"><span className="label-text text-[10px] font-bold">Under 2.5 %</span></label>
              <input 
                type="number" 
              step="1" 
              value={formData.awayTeamStats?.gols.global.under25Pct || ''} 
              onChange={(e) => updateTeamStats('away', 'under25Pct', e.target.value ? Number(e.target.value) : undefined)} 
              className="input input-sm text-center min-h-[44px]" 
              placeholder="0" 
            />
          </div>
          <div className="form-control">
            <label className="label py-0"><span className="label-text text-[10px] font-bold">Over 1.5 %</span></label>
              <input 
                type="number" 
              step="1" 
              name="awayOver15Freq" 
              value={formData.awayOver15Freq} 
              onChange={handleChange} 
              className="input input-sm text-center min-h-[44px]" 
              placeholder="0" 
            />
            </div>
        </div>
      </div>

      <button type="submit" className="btn btn-primary btn-lg mt-4 uppercase font-black tracking-widest shadow-2xl hover:scale-[1.01] active:scale-95 transition-all min-h-[44px] text-base md:text-lg w-full sm:w-auto">
        PROCESSAR ALGORITMO GOALSCAN
      </button>
    </motion.form>
  );
};

export default MatchForm;
