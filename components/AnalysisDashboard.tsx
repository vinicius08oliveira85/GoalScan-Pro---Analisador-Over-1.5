
import React from 'react';
import { AnalysisResult, MatchData, RecentMatch } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Target, Shield, Activity, Zap, AlertCircle } from 'lucide-react';

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
        <div className="custom-card p-6 flex flex-col items-center justify-center text-center relative overflow-hidden hover:shadow-xl transition-all duration-300">
          <div className="absolute top-2 right-4 flex items-center gap-1.5">
            <Target className="w-3 h-3 opacity-30" />
            <span className="text-[10px] font-bold opacity-30 uppercase">ALGORITMO V3.8</span>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-black uppercase tracking-widest">PROBABILIDADE OVER 1.5</h3>
          </div>
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
              <span className="text-4xl md:text-5xl font-black text-teal-400 leading-none">{result.probabilityOver15.toFixed(1)}%</span>
              <span className="text-[10px] font-bold opacity-40 mt-1 uppercase">CONFIANÇA</span>
            </div>
          </div>
          
          <div className="flex justify-between w-full mt-4 px-2 pt-4 border-t border-white/5 gap-4">
            <div className="text-center flex-1">
               <p className="text-[9px] font-bold opacity-40 uppercase mb-1">Odd Atual</p>
               <p className="text-lg md:text-xl font-black">{data.oddOver15?.toFixed(2) || '-'}</p>
            </div>
            <div className="text-center flex-1">
               <p className="text-[9px] font-bold opacity-40 uppercase mb-1">EV %</p>
               <div className="flex items-center justify-center gap-1">
                 {result.ev > 0 ? (
                   <TrendingUp className="w-4 h-4 text-success" />
                 ) : result.ev < 0 ? (
                   <TrendingDown className="w-4 h-4 text-error" />
                 ) : null}
                 <p className={`text-lg md:text-xl font-black ${result.ev > 0 ? 'text-success' : result.ev < 0 ? 'text-error' : ''}`}>
                   {result.ev > 0 ? '+' : ''}{result.ev.toFixed(1)}%
                 </p>
               </div>
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
              <div className={`badge badge-lg p-4 font-black border-none shadow-lg flex items-center gap-2 ${result.riskLevel === 'Baixo' ? 'bg-success text-success-content' : result.riskLevel === 'Moderado' ? 'bg-warning text-warning-content' : result.riskLevel === 'Alto' ? 'bg-error text-error-content' : 'bg-error/80 text-error-content'}`}>
                <AlertCircle className="w-4 h-4" />
                RISCO: {result.riskLevel}
              </div>
              {onSave && (
                <button onClick={onSave} className="btn btn-xs btn-outline btn-primary uppercase font-bold tracking-tighter hover:scale-105 transition-transform">
                  Salvar Partida
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-6">
            <div className="bg-base-100/50 p-4 rounded-2xl border border-white/5 hover:border-primary/30 transition-all duration-300 hover:shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black uppercase opacity-40">Ataque (10j)</p>
                <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                </div>
              </div>
              <progress className="progress progress-primary w-full h-2 mb-1" value={result.advancedMetrics.offensiveVolume} max="100"></progress>
              <p className="text-xs font-bold text-primary">{result.advancedMetrics.offensiveVolume.toFixed(0)}%</p>
            </div>
            <div className="bg-base-100/50 p-4 rounded-2xl border border-white/5 hover:border-secondary/30 transition-all duration-300 hover:shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black uppercase opacity-40">Defesa (10j)</p>
                <div className="p-1.5 rounded-lg bg-secondary/10 border border-secondary/20">
                  <Shield className="w-3.5 h-3.5 text-secondary" />
                </div>
              </div>
              <progress className="progress progress-secondary w-full h-2 mb-1" value={result.advancedMetrics.defensiveLeaking} max="100"></progress>
              <p className="text-xs font-bold text-secondary">{result.advancedMetrics.defensiveLeaking.toFixed(0)}%</p>
            </div>
            <div className="bg-base-100/50 p-4 rounded-2xl border border-white/5 hover:border-accent/30 transition-all duration-300 hover:shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black uppercase opacity-40">Tendência (5j)</p>
                <div className={`p-1.5 rounded-lg ${result.advancedMetrics.formTrend >= 0 ? 'bg-success/10 border border-success/20' : 'bg-error/10 border border-error/20'}`}>
                  {result.advancedMetrics.formTrend >= 0 ? (
                    <TrendingUp className={`w-3.5 h-3.5 text-success`} />
                  ) : (
                    <TrendingDown className={`w-3.5 h-3.5 text-error`} />
                  )}
                </div>
              </div>
              <div className={`text-sm font-black flex items-center gap-1 ${result.advancedMetrics.formTrend >= 0 ? 'text-success' : 'text-error'}`}>
                {result.advancedMetrics.formTrend >= 0 ? 'SUBINDO' : 'CAINDO'}
                <span className="text-xs opacity-70">({result.advancedMetrics.formTrend >= 0 ? '+' : ''}{result.advancedMetrics.formTrend.toFixed(1)})</span>
              </div>
            </div>
            <div className="bg-base-100/50 p-4 rounded-2xl border border-white/5 hover:border-accent/30 transition-all duration-300 hover:shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black uppercase opacity-40">Qualidade</p>
                <div className="p-1.5 rounded-lg bg-accent/10 border border-accent/20">
                  <Target className="w-3.5 h-3.5 text-accent" />
                </div>
              </div>
              <div className="text-sm font-black text-secondary">{result.confidenceScore.toFixed(0)}%</div>
              <div className="h-1.5 bg-base-300 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-gradient-to-r from-accent to-secondary" style={{ width: `${result.confidenceScore}%` }}></div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-3xl">
            <p className="text-sm font-bold italic leading-tight">"{result.recommendation}"</p>
          </div>
        </div>
      </div>

      {/* Gráfico de Distribuição */}
      <div className="custom-card p-8 hover:shadow-xl transition-all duration-300">
        <div className="flex items-center gap-2 mb-8">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-black uppercase tracking-tight">Distribuição Poisson Híbrida</h3>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={poissonData}>
              <defs>
                <linearGradient id="homeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id="awayGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <XAxis dataKey="goals" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
              <YAxis hide />
              <Tooltip 
                cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                contentStyle={{
                  backgroundColor: 'var(--color-base-200)', 
                  borderRadius: '1rem', 
                  border: '1px solid var(--color-base-300)', 
                  fontWeight: 'bold',
                  padding: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                }} 
              />
              <Bar name="Casa" dataKey="home" fill="url(#homeGradient)" radius={[10, 10, 0, 0]} />
              <Bar name="Fora" dataKey="away" fill="url(#awayGradient)" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AnalysisDashboard;
