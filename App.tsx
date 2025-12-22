
import React, { useState, useEffect } from 'react';
import MatchForm from './components/MatchForm';
import AnalysisDashboard from './components/AnalysisDashboard';
import MainScreen from './components/MainScreen';
import { performAnalysis } from './services/analysisEngine';
import { MatchData, AnalysisResult, SavedAnalysis } from './types';
import { ArrowLeft } from 'lucide-react';

type View = 'home' | 'analysis';

const App: React.FC = () => {
  const [view, setView] = useState<View>('home');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentMatchData, setCurrentMatchData] = useState<MatchData | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<SavedAnalysis | null>(null);
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

  // Funções de Navegação
  const handleNavigateToHome = () => {
    setView('home');
    setAnalysisResult(null);
    setCurrentMatchData(null);
    setSelectedMatch(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToAnalysis = (match: SavedAnalysis | null = null) => {
    if (match) {
      setSelectedMatch(match);
      setCurrentMatchData(match.data);
      setAnalysisResult(match.result);
    } else {
      setSelectedMatch(null);
      setCurrentMatchData(null);
      setAnalysisResult(null);
    }
    setView('analysis');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewMatch = () => {
    handleNavigateToAnalysis(null);
  };

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
      // Se já existe uma partida selecionada, atualizar ela
      if (selectedMatch) {
        const updatedMatch: SavedAnalysis = {
          ...selectedMatch,
          data: currentMatchData,
          result: analysisResult,
          timestamp: Date.now() // Atualizar timestamp
        };
        setSavedMatches(prev => prev.map(m => m.id === selectedMatch.id ? updatedMatch : m));
      } else {
        // Criar nova partida
        const newSaved: SavedAnalysis = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          data: currentMatchData,
          result: analysisResult
        };
        setSavedMatches(prev => [newSaved, ...prev]);
      }
      // Voltar para home após salvar
      setTimeout(() => {
        handleNavigateToHome();
      }, 300);
    }
  };

  const handleDeleteSaved = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSavedMatches(prev => prev.filter(m => m.id !== id));
  };

  // Renderizar tela principal ou tela de análise
  if (view === 'home') {
    return (
      <MainScreen
        savedMatches={savedMatches}
        onMatchClick={handleNavigateToAnalysis}
        onNewMatch={handleNewMatch}
        onDeleteMatch={handleDeleteSaved}
      />
    );
  }

  // Tela de Análise
  return (
    <div className="min-h-screen pb-20">
      <header className="bg-base-200/80 backdrop-blur-md border-b border-base-300 py-4 mb-8 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={handleNavigateToHome}
              className="btn btn-sm btn-ghost gap-2 hover:bg-base-300/50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center text-primary-content font-black italic text-xl shadow-lg">
              G
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none">GOALSCAN PRO</h1>
              <span className="text-[10px] uppercase font-bold tracking-widest text-primary opacity-80">AI Goal Analysis Engine</span>
            </div>
          </div>
          <div className="hidden md:flex gap-4 items-center">
            {analysisResult && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span className="text-xs font-bold text-primary">Análise Ativa</span>
              </div>
            )}
            <span className="badge badge-outline badge-sm font-bold">v3.8.2 Elite Edition</span>
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
                  onClick={() => { setAnalysisResult(null); setCurrentMatchData(null); setSelectedMatch(null); }}
                  className="btn btn-xs btn-ghost text-error"
                >
                  Limpar
                </button>
              )}
            </div>
            <MatchForm onAnalyze={handleAnalyze} initialData={currentMatchData} />
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
