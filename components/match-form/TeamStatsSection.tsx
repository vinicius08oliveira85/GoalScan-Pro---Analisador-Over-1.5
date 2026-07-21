import React, { useState } from 'react';
import { TeamStatistics, GolsStats } from '../../types';
import { Clipboard } from 'lucide-react';
import InfoIcon from './InfoIcon';

interface TeamStatsSectionProps {
  teamLabel: string;
  teamStats: TeamStatistics;
  onStatChange: (context: 'home' | 'away' | 'global', field: keyof GolsStats, value: number) => void;
  context: 'home' | 'away';
  onProcessPaste: (text: string, team: 'home' | 'away') => void;
}

const METRICS: Array<{
  key: keyof GolsStats;
  label: string;
  step: string;
  placeholder: string;
}> = [
  { key: 'avgScored', label: 'Média Marcados', step: '0.01', placeholder: '0.00' },
  { key: 'avgConceded', label: 'Média Sofridos', step: '0.01', placeholder: '0.00' },
  { key: 'avgTotal', label: 'Média Total', step: '0.01', placeholder: '0.00' },
  { key: 'cleanSheetPct', label: 'Sem Sofrer %', step: '1', placeholder: '0' },
  { key: 'noGoalsPct', label: 'Sem Marcar %', step: '1', placeholder: '0' },
  { key: 'over25Pct', label: 'Over 2.5 %', step: '1', placeholder: '0' },
  { key: 'under25Pct', label: 'Under 2.5 %', step: '1', placeholder: '0' },
];

const STAT_CONTEXTS = [
  { key: 'home' as const, label: 'Casa' },
  { key: 'away' as const, label: 'Fora' },
  { key: 'global' as const, label: 'Global' },
];

const TeamStatsSection: React.FC<TeamStatsSectionProps> = ({
  teamLabel,
  teamStats,
  onStatChange,
  context,
  onProcessPaste,
}) => {
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const handleProcessPaste = () => {
    onProcessPaste(pasteText, context);
    setPasteText('');
  };

  return (
    <div className="bg-info/5 p-4 rounded-3xl border border-info/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <span className="text-[10px] uppercase font-black opacity-40 tracking-widest">
            Estatísticas Globais - {teamLabel}
          </span>
          <InfoIcon text="Estatísticas dos 10 últimos jogos do campeonato. Insira manualmente os dados ou importe via Excel. Cada métrica mostra dados para Casa, Fora e Global." />
        </div>
        <button
          type="button"
          onClick={() => setShowPaste(!showPaste)}
          className="btn btn-xs btn-ghost gap-1 text-info"
        >
          <Clipboard className="w-3 h-3" />
          Colar Dados
        </button>
      </div>

      {showPaste && (
        <div className="mb-4 p-3 bg-base-200 rounded-lg border border-base-300">
          <p className="text-xs opacity-60 mb-2">Cole as estatísticas (Casa, Fora, Global) abaixo:</p>
          <textarea
            className="textarea textarea-bordered w-full text-xs font-mono min-h-[100px]"
            placeholder={`Exemplo:\nMédia de gols marcados por jogo\t0.67\t1.1\t0.89\n...`}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className="btn btn-xs" onClick={() => setShowPaste(false)}>Cancelar</button>
            <button type="button" className="btn btn-xs btn-primary" onClick={handleProcessPaste}>Processar</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {METRICS.map(({ key, label, step, placeholder }) => (
          <div key={key}>
            <label className="label py-1">
              <span className="label-text text-[10px] font-bold">{label}</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {STAT_CONTEXTS.map(({ key: statCtx, label: statLabel }) => (
                <div className="form-control" key={statCtx}>
                  <label className="label py-0">
                    <span className="label-text text-[9px] opacity-70">{statLabel}</span>
                  </label>
                  <input
                    type="number"
                    step={step}
                    value={teamStats.gols[statCtx][key] || ''}
                    onChange={(e) =>
                      onStatChange(
                        statCtx,
                        key,
                        e.target.value ? Number(e.target.value) : 0
                      )
                    }
                    className="input input-sm text-center min-h-[44px]"
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeamStatsSection;
