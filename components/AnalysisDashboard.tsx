
import React from 'react';
import { AnalysisResult, MatchData, RecentMatch } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

interface AnalysisDashboardProps {
  result: AnalysisResult;
  data: MatchData;
  onSave?: () => void;
}

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ result, data, onSave }) => {
  const chartData = [
    { name: 'Over 1.5', value: result.probabilityOver15 },
    { name: 'Under 1.5', value: 100 - result.probabilityOver15 },
  ];

  const poissonData = result.poissonHome.map((val, idx) => ({
    goals: idx,
    home: Number((val * 100).toFixed(1)),
    away: Number((result.poissonAway[idx] * 100).toFixed(1)),
  }));

  const COLORS = ['#2dd4bf', '#f87171'];

  const renderHistoryStrip = (history: RecentMatch[]) => {
    return (
      <div className="flex gap-1 mt-2">
        {history.map((m, i) => {
          const total = m.homeScore + m.awayScore;
          const isOver = total >= 2;
          return (
            <div key={i} className={`tooltip flex flex-col items-center`} data-tip={`${m.date}: ${m.homeScore}x${m.awayScore}`}>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${isOver ? 'bg-success text-success-content' : 'bg-base-300 opacity-50'}`}>
                {isOver ? 'O' : 'U'}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Probabilidade Principal */}
        <div className="custom-card p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute top-2 right-4 text-[10px] font-bold opacity-30 uppercase">Algoritmo v3.8</div>
          <h3 className="text-sm font-black opacity-60 uppercase tracking-widest mb-4">Probabilidade Over 1.5</h3>
          <div className="w-full h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={5} dataKey="value">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black text-teal-400 leading-none">{result.probabilityOver15.toFixed(1)}%</span>
              <span className="text-[10px] font-bold opacity-40 mt-1 uppercase">Confiança</span>
            </div>
          </div>
          
          <div className="flex justify-between w-full mt-4 px-2 pt-4 border-t border-white/5">
            <div className="text-center">
               <p className="text-[9px] font-bold opacity-40 uppercase">Odd Atual</p>
               <p className="text-lg font-black">{data.oddOver15?.toFixed(2) || '-'}</p>
            </div>
            <div className="text-center">
               <p className="text-[9px] font-bold opacity-40 uppercase">EV %</p>
               <p className={`text-lg font-black ${result.ev > 0 ? 'text-success' : result.ev < 0 ? 'text-error' : ''}`}>
                 {result.ev > 0 ? '+' : ''}{result.ev.toFixed(1)}%
               </p>
            </div>
          </div>
        </div>

        {/* Painel de Veredito */}
        <div className="custom-card p-6 lg:col-span-2 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                 <h3 className="text-2xl font-black tracking-tighter uppercase">{data.homeTeam} <span className="text-primary">vs</span> {data.awayTeam}</h3>
              </div>
              <p className="text-xs font-bold opacity-40 uppercase tracking-widest mt-1">Comparativo de Momentum (5j)</p>
              
              <div className="flex gap-8 mt-4">
                <div>
                   <span className="text-[9px] font-black uppercase opacity-40">Status {data.homeTeam}</span>
                   {renderHistoryStrip(data.homeHistory)}
                </div>
                <div>
                   <span className="text-[9px] font-black uppercase opacity-40">Status {data.awayTeam}</span>
                   {renderHistoryStrip(data.awayHistory)}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className={`badge badge-lg p-4 font-black border-none shadow-lg ${result.riskLevel === 'Baixo' ? 'bg-success text-success-content' : result.riskLevel === 'Moderado' ? 'bg-warning text-warning-content' : 'bg-error text-error-content'}`}>
                RISCO: {result.riskLevel}
              </div>
              {onSave && (
                <button onClick={onSave} className="btn btn-xs btn-outline btn-primary uppercase font-bold tracking-tighter">
                  Salvar Partida
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-base-100/50 p-3 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black uppercase opacity-40 mb-2">Ataque (10j)</p>
              <progress className="progress progress-primary w-full h-2" value={result.advancedMetrics.offensiveVolume} max="100"></progress>
            </div>
            <div className="bg-base-100/50 p-3 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black uppercase opacity-40 mb-2">Defesa (10j)</p>
              <progress className="progress progress-secondary w-full h-2" value={result.advancedMetrics.defensiveLeaking} max="100"></progress>
            </div>
            <div className="bg-base-100/50 p-3 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black uppercase opacity-40 mb-2">Tendência (5j)</p>
              <div className={`text-sm font-black ${result.advancedMetrics.formTrend >= 0 ? 'text-success' : 'text-error'}`}>
                {result.advancedMetrics.formTrend >= 0 ? 'SUBINDO' : 'CAINDO'}
              </div>
            </div>
            <div className="bg-base-100/50 p-3 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black uppercase opacity-40 mb-2">Qualidade</p>
              <div className="text-sm font-black text-secondary">{result.confidenceScore.toFixed(0)}%</div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-3xl">
            <p className="text-sm font-bold italic leading-tight">"{result.recommendation}"</p>
          </div>
        </div>
      </div>

      {/* Gráfico de Distribuição */}
      <div className="custom-card p-8">
        <h3 className="text-lg font-black uppercase tracking-tight mb-8">Distribuição Poisson Híbrida</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={poissonData}>
              <XAxis dataKey="goals" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
              <YAxis hide />
              <Tooltip cursor={{fill: 'rgba(255,255,255,0.02)'}} contentStyle={{backgroundColor: 'var(--color-base-200)', borderRadius: '1rem', border: 'none', fontWeight: 'bold'}} />
              <Bar name="Casa" dataKey="home" fill="var(--color-primary)" radius={[10, 10, 0, 0]} />
              <Bar name="Fora" dataKey="away" fill="var(--color-secondary)" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AnalysisDashboard;
