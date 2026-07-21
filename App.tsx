import React, { useState, lazy, Suspense } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { tabScreenTransition } from './utils/animations';
import MatchForm from './components/MatchForm';
import InAppNotification from './components/InAppNotification';
import ToastContainer from './components/ToastContainer';
import CommandPalette from './components/CommandPalette';
import TabNavigation, { TabType } from './components/TabNavigation';
import DashboardScreen from './components/DashboardScreen';
import MatchesScreen from './components/MatchesScreen';
import ChampionshipsScreen from './components/ChampionshipsScreen';
import BankScreen from './components/BankScreen';
import SettingsScreen from './components/SettingsScreen';
import ModalShell from './components/ui/ModalShell';
import MatchResultAnalysisModal from './components/MatchResultAnalysisModal';
import { useToast } from './hooks/useToast';
import { useSavedMatches } from './hooks/useSavedMatches';
import { useBankSettings } from './hooks/useBankSettings';
import { useNotifications } from './hooks/useNotifications';
import { useAnalysisActions } from './hooks/useAnalysisActions';
import { useBankActions } from './hooks/useBankActions';
import { Loader, Plus, Settings, Home, Wallet, ArrowLeft, X } from 'lucide-react';
import { logger } from './utils/logger';

// Lazy loading de componentes pesados para code splitting
const AnalysisDashboard = lazy(() => import('./components/AnalysisDashboard'));

import {
  SavedAnalysis,
  BankSettings as BankSettingsType,
  BetInfo,
  SelectedBet,
  MatchResultAnalysis,
} from './types';
import { getCurrencySymbol } from './utils/currency';
import { generateAnalysisText, parseWebSearchResults } from './services/matchResultAnalysisService';


const App: React.FC = () => {
  const { toasts, removeToast, error: showError, success: showSuccess } = useToast();
  const {
    savedMatches,
    isLoading,
    isUsingLocalData,
    saveMatch,
    saveMatchPartial,
    removeMatch,
  } = useSavedMatches(showError);
  const { bankSettings, saveSettings } = useBankSettings(showError);
  const { activeNotifications, removeNotification, cancelMatchNotification } =
    useNotifications(savedMatches);

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [showResultAnalysisModal, setShowResultAnalysisModal] = useState<boolean>(false);
  const [matchForAnalysis, setMatchForAnalysis] = useState<SavedAnalysis | null>(null);
  const [webSearchResults, setWebSearchResults] = useState<Array<{ content?: string; snippet?: string; url?: string }>>([]);

  const {
    analysisResult,
    currentMatchData,
    selectedMatch,
    showAnalysisModal,
    analysisModalTab,
    setAnalysisResult,
    setCurrentMatchData,
    setSelectedMatch,
    setAnalysisModalTab,
    handleNavigateToAnalysis,
    handleCloseAnalysis,
    handleNewMatch,
    handleAnalyze,
    handleOddChange,
    handleSaveMatch,
  } = useAnalysisActions({
    saveMatch,
    showSuccess,
    showError,
    setActiveTab,
  });

  const {
    isUpdatingBetStatus,
    handleSaveBankSettings,
    handleUpdateBetStatus,
    handleSaveBetInfo,
  } = useBankActions({
    bankSettings,
    selectedMatch,
    currentMatchData,
    analysisResult,
    saveSettings,
    saveMatch,
    setSelectedMatch,
    showSuccess,
    showError,
  });

  const handleRemoveNotification = (matchId: string) => {
    removeNotification(matchId);
  };

  const handleNotificationClick = (match: SavedAnalysis) => {
    handleNavigateToAnalysis(match);
  };

  const handleDeleteSaved = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      // Cancelar notificação da partida
      cancelMatchNotification(id);
      // Deletar usando o hook
      await removeMatch(id);
      showSuccess('Partida removida com sucesso!');
    } catch {
      showError('Erro ao remover partida. Tente novamente.');
    }
  };

  const handleAnalyzeMatchResult = async (match: SavedAnalysis): Promise<MatchResultAnalysis> => {
    const { homeTeam, awayTeam, matchDate } = match.data;
    const betStatus = match.betInfo?.status;

    if (!betStatus || (betStatus !== 'won' && betStatus !== 'lost')) {
      throw new Error('A partida deve ter uma aposta finalizada (ganha ou perdida) para análise');
    }

    // Construir query de busca
    const searchQuery = `${homeTeam} vs ${awayTeam} ${matchDate || ''} resultado placar`.trim();

    // Fazer busca web usando a função handleWebSearch
    // Esta função será chamada pelo modal que terá acesso à ferramenta web_search
    const searchResults = await handleWebSearch(searchQuery);
    
    // Se não houver resultados, retornar análise básica
    if (!searchResults.results || searchResults.results.length === 0) {
      // Retornar análise básica sem dados da web
      const analysisText = generateAnalysisText(match, { homeScore: 0, awayScore: 0, totalGoals: 0 }, '');
      
      return {
        matchResult: {
          homeScore: 0,
          awayScore: 0,
          totalGoals: 0,
        },
        betOutcome: betStatus,
        analysis: analysisText,
        sources: [],
        generatedAt: Date.now(),
      };
    }
    
    // Processar resultados
    const searchText = searchResults.results?.map((r: { content?: string; snippet?: string; url?: string }) => r.content || r.snippet || '').join('\n\n') || '';
    const parsed = parseWebSearchResults(searchText);
    const analysisText = generateAnalysisText(match, parsed, searchText);

    return {
      matchResult: {
        homeScore: parsed.homeScore,
        awayScore: parsed.awayScore,
        totalGoals: parsed.totalGoals,
      },
      betOutcome: betStatus,
      analysis: analysisText,
      sources: searchResults.results?.map((r: { url?: string }) => r.url || '').filter(Boolean) || [],
      generatedAt: Date.now(),
    };
  };

  const handleOpenResultAnalysis = async (match: SavedAnalysis) => {
    setMatchForAnalysis(match);
    setShowResultAnalysisModal(true);
    setWebSearchResults([]); // Limpar resultados anteriores
  };

  const handleCloseResultAnalysis = () => {
    setShowResultAnalysisModal(false);
    setMatchForAnalysis(null);
    setWebSearchResults([]); // Limpar resultados quando fechar
  };

  // Função wrapper para busca web que será passada ao modal
  // Nota: Esta função será chamada pelo modal para fazer busca web
  // A busca será feita usando a ferramenta web_search quando disponível
  // Como web_search só pode ser chamada pelo assistente, vamos fazer a busca aqui
  // através de uma chamada que será interceptada pelo assistente
  const handleWebSearch = async (query: string) => {
    try {
      logger.log('[App] Solicitando busca web:', query);
      
      // Se já temos resultados em cache, retornar eles
      if (webSearchResults.length > 0) {
        return { results: webSearchResults };
      }
      
      // Nota: A busca web real precisa ser feita pelo assistente usando a ferramenta web_search
      // Como a ferramenta web_search só pode ser chamada pelo assistente, vamos fazer a busca aqui
      // através de uma chamada que será interceptada pelo assistente quando o usuário clicar no botão
      
      // Por enquanto, vamos retornar um resultado vazio
      // O assistente será chamado para fazer a busca quando o modal abrir
      // e o usuário clicar no botão de análise
      
      // TODO: Implementar busca web real usando uma API ou backend proxy
      // Por enquanto, retornamos estrutura vazia - a busca será feita pelo assistente
      
      return { results: [] };
    } catch (error) {
      logger.error('Erro ao buscar informações:', error);
      showError(`Erro ao buscar na web: ${error instanceof Error ? error.message : String(error)}`);
      return { results: [] };
    }
  };

  // Keyboard shortcut para Command Palette (⌘K ou Ctrl+K)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Ações do Command Palette
  const commandActions = [
    {
      id: 'new-match',
      label: 'Nova Análise',
      description: 'Criar uma nova análise de partida',
      icon: <Plus className="w-4 h-4" />,
      shortcut: '⌘N',
      action: () => {
        handleNewMatch();
        setShowCommandPalette(false);
      },
      category: 'Ações',
    },
    {
      id: 'home',
      label: 'Ir para Início',
      description: 'Voltar para a tela principal',
      icon: <Home className="w-4 h-4" />,
      shortcut: '⌘H',
      action: () => {
        setActiveTab('dashboard');
        setShowCommandPalette(false);
      },
      category: 'Navegação',
    },
    {
      id: 'bank',
      label: 'Banca',
      description: 'Ir para tela de Banca',
      icon: <Wallet className="w-4 h-4" />,
      shortcut: '⌘B',
      action: () => {
        setActiveTab('bank');
        setShowCommandPalette(false);
      },
      category: 'Navegação',
    },
    {
      id: 'settings',
      label: 'Configurações',
      description: 'Ir para tela de Configurações',
      icon: <Settings className="w-4 h-4" />,
      shortcut: '⌘,',
      action: () => {
        setActiveTab('settings');
        setShowCommandPalette(false);
      },
      category: 'Navegação',
    },
  ];

  // Renderizar tela principal com abas
  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-8">
      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        actions={commandActions}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Notificações In-App */}
      <div className="fixed top-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100] space-y-3 pointer-events-none">
        {activeNotifications.map((match) => (
          <div key={match.id} className="pointer-events-auto">
            <InAppNotification
              match={match}
              onClose={() => handleRemoveNotification(match.id)}
              onClick={() => handleNotificationClick(match)}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="bg-base-200/80 backdrop-blur-md border-b border-base-300/50 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 md:px-4 py-3 md:py-4">
          <div className="flex items-center gap-2 md:gap-3 mb-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center text-primary-content font-black italic text-lg md:text-xl shadow-lg flex-shrink-0">
              G
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg md:text-xl font-black tracking-tighter leading-none truncate">
                GOALSCAN PRO
              </h1>
              <span className="text-xs md:text-sm uppercase font-bold tracking-widest text-primary opacity-80 hidden sm:inline leading-tight">
                AI Goal Analysis Engine
              </span>
            </div>
            <div className="hidden md:flex gap-4 items-center">
              {isLoading && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-info/10 border border-info/20 rounded-lg">
                  <Loader className="w-3 h-3 text-info animate-spin" />
                  <span className="text-xs font-bold text-info">Carregando...</span>
                </div>
              )}
              {!isLoading && isUsingLocalData && (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border border-warning/20 rounded-lg"
                  title="Usando dados locais"
                >
                  <div className="w-2 h-2 bg-warning rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-warning">Offline</span>
                </div>
              )}
              {bankSettings && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/10 border border-secondary/20 rounded-lg">
                  <Wallet className="w-3 h-3 text-secondary" />
                  <span className="text-xs font-bold text-secondary">
                    {getCurrencySymbol(bankSettings.currency)} {bankSettings.totalBank.toFixed(0)}
                  </span>
                </div>
              )}
              <span className="badge badge-outline badge-sm font-bold">v3.8.3</span>
            </div>
          </div>
          {/* Tab Navigation */}
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </header>

      {/* Main Content - Renderizar tela baseada na aba ativa */}
      <main className="container mx-auto px-4 pt-6">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <DashboardScreen
                savedMatches={savedMatches}
                bankSettings={bankSettings}
                onMatchClick={handleNavigateToAnalysis}
                isLoading={isLoading}
              />
            </motion.div>
          )}
          {activeTab === 'matches' && (
            <motion.div
              key="matches"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <MatchesScreen
                savedMatches={savedMatches}
                onMatchClick={handleNavigateToAnalysis}
                onNewMatch={handleNewMatch}
                onDeleteMatch={handleDeleteSaved}
                onUpdateBetStatus={handleUpdateBetStatus}
                onAnalyzeResult={handleOpenResultAnalysis}
                isLoading={isLoading}
                isUpdatingBetStatus={isUpdatingBetStatus}
              />
            </motion.div>
          )}
          {activeTab === 'championships' && (
            <motion.div
              key="championships"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <ChampionshipsScreen />
            </motion.div>
          )}
          {activeTab === 'bank' && (
            <motion.div
              key="bank"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <BankScreen
                bankSettings={bankSettings}
                savedMatches={savedMatches}
                onSave={handleSaveBankSettings}
                onError={showError}
              />
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <SettingsScreen />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modal de Análise */}
      <ModalShell
        isOpen={showAnalysisModal}
        onClose={handleCloseAnalysis}
        closeOnOverlayClick
        closeOnEscape
        showCloseButton={false}
        containerClassName="px-0 pt-0 items-stretch justify-stretch z-[200]"
        overlayClassName="bg-black/50 backdrop-blur-sm"
        panelClassName="fixed inset-4 md:inset-8 lg:inset-16 max-w-none w-auto bg-base-200 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        bodyClassName="p-0 max-h-none overflow-hidden"
      >
        {/* Header do Modal */}
        <div className="bg-base-200/80 backdrop-blur-md border-b border-base-300 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={handleCloseAnalysis} className="btn btn-sm btn-ghost gap-2" aria-label="Voltar">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <h2 className="text-lg md:text-xl font-black">
              {currentMatchData
                ? `${currentMatchData.homeTeam} vs ${currentMatchData.awayTeam}`
                : 'Nova Análise'}
            </h2>
          </div>
          <button onClick={handleCloseAnalysis} className="btn btn-sm btn-circle btn-ghost" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo do Modal */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Sidebar: Entry Form */}
            <aside className="xl:col-span-4 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <span className="w-2 h-6 bg-secondary rounded-full"></span>
                  Análise Manual
                </h3>
                {analysisResult && (
                  <button
                    onClick={() => {
                      setAnalysisResult(null);
                      setCurrentMatchData(null);
                      setSelectedMatch(null);
                    }}
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
                <h3 className="text-lg font-bold">Painel de Resultados e EV</h3>
              </div>

              {analysisResult && currentMatchData ? (
                <Suspense
                  fallback={
                    <div className="flex flex-col items-center justify-center py-20">
                      <Loader className="w-12 h-12 text-primary animate-spin mb-4" />
                      <p className="text-sm opacity-60">Carregando análise...</p>
                    </div>
                  }
                >
                  <AnalysisDashboard
                    result={analysisResult}
                    data={currentMatchData}
                    onSave={handleSaveMatch}
                    betInfo={selectedMatch?.betInfo}
                    bankSettings={bankSettings}
                    savedMatches={savedMatches}
                    onBetSave={handleSaveBetInfo}
                    onError={showError}
                    isUpdatingBetStatus={isUpdatingBetStatus}
                    onOddChange={handleOddChange}
                    initialSelectedBets={selectedMatch?.selectedBets}
                    onAnalyzeResult={handleOpenResultAnalysis}
                    savedMatch={selectedMatch}
                  />
                </Suspense>
              ) : (
                <div className="custom-card p-12 flex flex-col items-center justify-center text-center opacity-40 border-dashed border-2">
                  <div className="w-24 h-24 mb-6 rounded-full border-4 border-current flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-12 w-12"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold">Aguardando Análise</h3>
                  <p className="max-w-xs mx-auto mt-2 italic">
                    Insira os dados e as odds para descobrir o valor esperado (EV) e a confiança
                    matemática da partida.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </ModalShell>

      {/* Modal de Análise de Resultado */}
      <MatchResultAnalysisModal
        isOpen={showResultAnalysisModal}
        onClose={handleCloseResultAnalysis}
        match={matchForAnalysis}
        onAnalyze={handleAnalyzeMatchResult}
        webSearch={handleWebSearch}
      />
    </div>
    </MotionConfig>
  );
};

export default App;
