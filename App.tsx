
import React, { useState, useEffect } from 'react';
import MatchForm from './components/MatchForm';
import AnalysisDashboard from './components/AnalysisDashboard';
import { performAnalysis } from './services/analysisEngine';
import { MatchData, AnalysisResult, SavedAnalysis } from './types';

const App: React.FC = () => {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentMatchData, setCurrentMatchData] = useState<MatchData | null>(null);
  const [savedMatches, setSavedMatches] = useState<SavedAnalysis[]>([]);

  // Carregar do localStorage na inicialização
  useEffect(() => {
    const stored = localStorage.getItem('goalscan_saved');
    if (stored) {
      setSavedMatches(JSON.parse(stored));
    }
  }, []);

  // Salvar no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem('goalscan_saved', JSON.stringify(savedMatches));
  }, [savedMatches]);

  const handleAnalyze = (data: MatchData) => {
    const result = performAnalysis(data);
    setAnalysisResult(result);
    setCurrentMatchData(data);
    if (window.innerWidth < 768) {
      window.scrollTo({ top: 600, behavior: 'smooth' });
    }
  };

  const handleSaveMatch = () => {
    if (analysisResult && currentMatchData) {
      const newSaved: SavedAnalysis = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        data: currentMatchData,
        result: analysisResult
      };
      setSavedMatches(prev => [newSaved, ...prev]);
    }
  };

  const handleOpenSaved = (match: SavedAnalysis) => {
    setCurrentMatchData(match.data);
    setAnalysisResult(match.result);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSaved = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSavedMatches(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-base-200 border-b border-base-300 py-4 mb-8 sticky top-0 z-50">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-content font-black italic text-xl">
              G
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none">GOALSCAN PRO</h1>
              <span className="text-[10px] uppercase font-bold tracking-widest text-primary opacity-80">AI Goal Analysis Engine</span>
            </div>
          </div>
          <div className="hidden md:flex gap-4">
            <span className="badge badge-outline badge-sm">v3.8.2 Elite Edition</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* Sidebar: Entry Form */}
          <aside className="xl:col-span-4 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="w-2 h-6 bg-secondary rounded-full"></span>
                Análise Manual
              </h2>
              {analysisResult && (
                <button 
                  onClick={() => { setAnalysisResult(null); setCurrentMatchData(null); }}
                  className="btn btn-xs btn-ghost text-error"
                >
                  Limpar
                </button>
              )}
            </div>
            <MatchForm onAnalyze={handleAnalyze} initialData={currentMatchData} />
            
            {/* Galeria de Salvos */}
            <div className="flex flex-col gap-4 mt-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="w-2 h-6 bg-accent rounded-full"></span>
                Partidas Salvas
              </h2>
              <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {savedMatches.length === 0 ? (
                  <p className="text-[10px] uppercase opacity-30 font-black text-center py-8 border-2 border-dashed rounded-3xl border-white/5">Nenhuma partida salva</p>
                ) : (
                  savedMatches.map(match => (
                    <div 
                      key={match.id}
                      onClick={() => handleOpenSaved(match)}
                      className="group custom-card p-4 hover:border-primary/50 cursor-pointer transition-all active:scale-95 flex flex-col gap-3 relative overflow-hidden"
                    >
                      {/* Header: Data e Times */}
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col flex-1 min-w-0">
                           <span className="text-[9px] font-black opacity-30 uppercase">{new Date(match.timestamp).toLocaleDateString()}</span>
                           <span className="text-xs font-black uppercase truncate">{match.data.homeTeam} x {match.data.awayTeam}</span>
                        </div>
                        <button onClick={(e) => handleDeleteSaved(e, match.id)} className="opacity-0 group-hover:opacity-100 btn btn-xs btn-circle btn-ghost text-error transition-opacity flex-shrink-0">×</button>
                      </div>

                      {/* Métricas Principais: Probabilidade, Odd e EV */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-bold opacity-40 uppercase mb-1">Prob</span>
                          <span className="text-sm font-black text-teal-400">{match.result.probabilityOver15.toFixed(0)}%</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-bold opacity-40 uppercase mb-1">Odd</span>
                          <span className="text-sm font-black text-primary">{match.data.oddOver15?.toFixed(2) || '-'}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-bold opacity-40 uppercase mb-1">EV</span>
                          <span className={`text-sm font-black ${
                            match.result.ev > 0 ? 'text-success' : 
                            match.result.ev < 0 ? 'text-error' : 
                            'opacity-50'
                          }`}>
                            {match.result.ev > 0 ? '+' : ''}{match.result.ev.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Barra de Progresso */}
                      <div className="flex items-center gap-2 mt-1">
                        <div className={`h-1 flex-1 rounded-full overflow-hidden bg-base-300`}>
                          <div className="h-full bg-primary" style={{ width: `${match.result.probabilityOver15}%` }}></div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>

          {/* Main Content: Results */}
          <section className="xl:col-span-8 flex flex-col gap-6">
             <div className="flex items-center gap-2">
                <span className="w-2 h-6 bg-primary rounded-full"></span>
                <h2 className="text-lg font-bold">Painel de Resultados e EV</h2>
              </div>
            
            {analysisResult && currentMatchData ? (
              <AnalysisDashboard 
                result={analysisResult} 
                data={currentMatchData} 
                onSave={handleSaveMatch}
              />
            ) : (
              <div className="custom-card p-12 flex flex-col items-center justify-center text-center opacity-40 border-dashed border-2">
                <div className="w-24 h-24 mb-6 rounded-full border-4 border-current flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold">Aguardando Análise</h3>
                <p className="max-w-xs mx-auto mt-2 italic">Insira os dados e as odds para descobrir o valor esperado (EV) e a confiança matemática da partida.</p>
              </div>
            )}
          </section>
        </div>
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

export default App;
