import React, { useState, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { tabScreenTransition } from './utils/animations';
import MatchForm from './components/MatchForm';
import InAppNotification from './components/InAppNotification';
import ToastContainer from './components/ToastContainer';
import CommandPalette from './components/CommandPalette';
import { TabType } from './components/navTypes';
import MobileBottomNav from './components/layout/MobileBottomNav';
import DesktopSidebar from './components/layout/DesktopSidebar';
import AnalysisDashboardSkeleton from './components/analysis/AnalysisDashboardSkeleton';
import ModalShell from './components/ui/ModalShell';
import MatchResultAnalysisModal from './components/MatchResultAnalysisModal';
import { useToast } from './hooks/useToast';
import { useSavedMatches } from './hooks/useSavedMatches';
import { useBankSettings } from './hooks/useBankSettings';
import { useNotifications } from './hooks/useNotifications';
import { useAnalysisActions } from './hooks/useAnalysisActions';
import { useBankActions } from './hooks/useBankActions';
import { Loader, Plus, Settings, Home, Wallet, ArrowLeft, X } from 'lucide-react';

// Lazy loading de componentes pesados para code splitting
const AnalysisDashboard = lazy(() => import('./components/AnalysisDashboard'));

import {
  SavedAnalysis,
  BankSettings as BankSettingsType,
  MatchResultAnalysis,
} from './types';
import { getCurrencySymbol } from './utils/currency';
import { generateAnalysisText, parseWebSearchResults } from './services/matchResultAnalysisService';
import { useAnalysisModal } from './hooks/useAnalysisModal';

// Lazy loading para code splitting
const DashboardScreen = lazy(() => import('./components/DashboardScreen'));
const MatchesScreen = lazy(() => import('./components/MatchesScreen'));
const ChampionshipsScreen = lazy(() => import('./components/ChampionshipsScreen'));
const BankScreen = lazy(() => import('./components/BankScreen'));
const SettingsScreen = lazy(() => import('./components/SettingsScreen'));

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
    setAnalysisResult,
    setCurrentMatchData,
    setSelectedMatch,
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
      console.log('[App] Solicitando busca web:', query);
      
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
      console.error('Erro ao buscar informações:', error);
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
    <div className="min-h-[100dvh] flex flex-col md:flex-row md:items-stretch pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
      <DesktopSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
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
      <header className="sticky top-0 z-40 border-b border-white/10 bg-base-100/65 shadow-lg shadow-primary/5 backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-base-200/50 dark:shadow-primary/10 pt-[env(safe-area-inset-top)]">
        <div className="app-container py-3 md:py-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary to-secondary/90 text-lg font-black italic text-primary-content shadow-lg shadow-primary/25 md:h-10 md:w-10 md:text-xl">
              G
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[clamp(1.05rem,1rem+0.8vw,1.35rem)] font-black leading-none tracking-tighter md:text-xl">
                GOALSCAN PRO
              </h1>
              <span className="hidden text-xs font-black uppercase leading-tight tracking-widest text-primary opacity-60 sm:inline md:text-sm">
                AI Goal Analysis Engine
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2 md:hidden">
              {isLoading && (
                <div className="flex items-center gap-1.5 rounded-xl border border-info/20 bg-info/10 px-2 py-1 shadow-sm shadow-info/10 backdrop-blur-sm">
                  <span className="loading loading-spinner loading-xs text-info" aria-hidden />
                  <span className="text-[10px] font-bold text-info">…</span>
                </div>
              )}
              {!isLoading && isUsingLocalData && (
                <div className="flex items-center gap-1 rounded-xl border border-warning/25 bg-warning/10 px-2 py-1 shadow-sm shadow-warning/10 backdrop-blur-sm" title="Usando dados locais">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
                </div>
              )}
              {bankSettings && (
                <div className="flex items-center gap-1 rounded-xl border border-secondary/30 bg-secondary/15 px-2 py-1 text-[10px] font-bold text-secondary shadow-lg shadow-secondary/5 backdrop-blur-md">
                  <Wallet className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="tabular-nums">{getCurrencySymbol(bankSettings.currency)}{bankSettings.totalBank.toFixed(0)}</span>
                </div>
              )}
              <button
                type="button"
                className="btn btn-circle btn-ghost btn-sm touch-target ui-hover-rise focus-ring-sm"
                onClick={() => setActiveTab('settings')}
                aria-label="Configurações"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
            <div className="hidden shrink-0 items-center gap-4 md:flex">
              {isLoading && (
                <div className="flex items-center gap-2 rounded-xl border border-info/20 bg-info/10 px-3 py-1.5 shadow-md shadow-info/10 backdrop-blur-sm">
                  <span className="loading loading-spinner loading-xs text-info" aria-hidden />
                  <span className="text-xs font-bold text-info">Carregando...</span>
                </div>
              )}
              {!isLoading && isUsingLocalData && (
                <div
                  className="flex items-center gap-2 rounded-xl border border-warning/25 bg-warning/10 px-3 py-1.5 shadow-md shadow-warning/10 backdrop-blur-sm"
                  title="Usando dados locais"
                >
                  <div className="h-2 w-2 animate-pulse rounded-full bg-warning" />
                  <span className="text-xs font-bold text-warning">Offline</span>
                </div>
              )}
              {bankSettings && (
                <div className="flex items-center gap-2 rounded-2xl border border-secondary/30 bg-secondary/15 px-4 py-2 shadow-xl shadow-secondary/10 backdrop-blur-md transition-all hover:scale-105">
                  <Wallet className="h-3 w-3 text-secondary" />
                  <span className="text-sm font-black text-secondary tracking-tight">
                    {getCurrencySymbol(bankSettings.currency)} {bankSettings.totalBank.toFixed(0)}
                  </span>
                </div>
              )}
              <span className="badge badge-outline badge-sm font-bold">v3.8.3</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Renderizar tela baseada na aba ativa */}
      <main className="app-container flex-1 w-full pt-4 md:pt-6 pb-6 md:pb-8">
        <Suspense fallback={<div className="flex items-center justify-center h-64"><span className="loading loading-spinner loading-lg text-primary" /></div>}>
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={tabScreenTransition}
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
              transition={tabScreenTransition}
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
                bankCurrency={bankSettings?.currency}
              />
            </motion.div>
          )}
          {activeTab === 'championships' && (
            <motion.div
              key="championships"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={tabScreenTransition}
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
              transition={tabScreenTransition}
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
              transition={tabScreenTransition}
            >
              <SettingsScreen />
            </motion.div>
          )}
        </AnimatePresence>
        </Suspense>
      </main>

      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Modal de Análise — flex col + scroll isolado no filho (basis-0) para rolagem confiável em mobile/desktop */}
      <ModalShell
        isOpen={showAnalysisModal}
        onClose={handleCloseAnalysis}
        closeOnOverlayClick
        closeOnEscape
        showCloseButton={false}
        bodyLayout="fill"
        overlayClassName="bg-black/55 backdrop-blur-md"
        containerClassName="box-border px-[max(0.75rem,env(safe-area-inset-left))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-4 md:px-6"
        panelClassName="box-border flex h-[min(92dvh,calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem))] max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem))] min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-base-200/90 shadow-2xl shadow-primary/15 backdrop-blur-xl dark:border-white/10 md:h-[min(92vh,calc(100dvh-2rem))] md:max-h-[min(92vh,calc(100dvh-2rem))]"
        bodyClassName="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0"
      >
        {/* Header: shrink-0 + z acima do corpo rolável; blur sólido evita “vazamento” do glass por baixo */}
        <div className="relative z-[5] flex shrink-0 items-center justify-between border-b border-white/10 bg-base-200/95 p-4 shadow-sm shadow-black/5 backdrop-blur-xl dark:border-white/10 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={handleCloseAnalysis}
              className="btn btn-ghost btn-sm shrink-0 gap-2 ui-hover-rise"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <h2 className="min-w-0 truncate text-lg font-black md:text-xl">
              {currentMatchData
                ? `${currentMatchData.homeTeam} vs ${currentMatchData.awayTeam}`
                : 'Nova Análise'}
            </h2>
          </div>
            <button
            type="button"
            onClick={handleCloseAnalysis}
            className="btn btn-circle btn-ghost btn-sm shrink-0 ui-hover-rise"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo: única região com scroll (flex-1 + basis-0 + min-h-0); gutter estável + thumb visível (webkit / thin) */}
        <div
          className="relative z-0 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-smooth [-webkit-overflow-scrolling:touch] [scrollbar-color:rgb(148_163_184/0.45)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] p-4 pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] md:p-6 md:pb-8 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-base-content/25 [&::-webkit-scrollbar-track]:bg-transparent dark:[scrollbar-color:rgb(148_163_184/0.35)_transparent]"
        >
          <div className="mx-auto flex min-h-0 min-w-0 w-full max-w-6xl flex-col gap-6 pb-2">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-black">
                  <span className="h-6 w-2 rounded-full bg-gradient-to-b from-secondary to-primary shadow-sm shadow-primary/20" />
                  Análise Manual
                </h3>
                {analysisResult && (
                  <button
                    type="button"
                    onClick={() => {
                      setAnalysisResult(null);
                      setCurrentMatchData(null);
                      setSelectedMatch(null);
                      setAnalysisModalTab('dados');
                    }}
                    className="btn btn-ghost btn-xs text-error ui-hover-rise"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div
                role="tablist"
                aria-label="Etapas da análise"
                className="tabs tabs-boxed tabs-sm mb-4 flex-wrap gap-1 rounded-2xl border border-white/10 bg-base-300/35 p-1 shadow-inner shadow-primary/5 backdrop-blur-md dark:border-white/10"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={analysisModalTab === 'dados'}
                  className={`tab rounded-xl transition-all duration-200 ${analysisModalTab === 'dados' ? 'tab-active shadow-md shadow-primary/15' : 'ui-hover-rise'}`}
                  onClick={() => setAnalysisModalTab('dados')}
                >
                  Dados do jogo
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={analysisModalTab === 'stats'}
                  disabled={!analysisResult || !currentMatchData}
                  className={`tab rounded-xl transition-all duration-200 ${!analysisResult ? 'pointer-events-none opacity-40' : ''} ${analysisModalTab === 'stats' ? 'tab-active shadow-md shadow-primary/15' : 'ui-hover-rise'}`}
                  onClick={() => analysisResult && currentMatchData && setAnalysisModalTab('stats')}
                >
                  Estatísticas
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={analysisModalTab === 'verdict'}
                  disabled={!analysisResult || !currentMatchData}
                  className={`tab rounded-xl transition-all duration-200 ${!analysisResult ? 'pointer-events-none opacity-40' : ''} ${analysisModalTab === 'verdict' ? 'tab-active shadow-md shadow-primary/15' : 'ui-hover-rise'}`}
                  onClick={() => analysisResult && currentMatchData && setAnalysisModalTab('verdict')}
                >
                  Veredito da IA
                </button>
              </div>

              {analysisModalTab === 'dados' && (
                <div className="min-h-0 w-full">
                  <MatchForm onAnalyze={handleAnalyze} initialData={currentMatchData} />
                </div>
              )}

              {analysisResult && currentMatchData && (analysisModalTab === 'stats' || analysisModalTab === 'verdict') && (
                <Suspense fallback={<AnalysisDashboardSkeleton />}>
                  <div className="min-h-0 w-full">
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
                    analysisUiTab={analysisModalTab}
                  />
                  </div>
                </Suspense>
              )}

              {analysisModalTab === 'dados' && !analysisResult && (
                <div className="custom-card mt-6 flex flex-col items-center justify-center border-2 border-dashed border-base-content/15 bg-gradient-to-br from-base-100/40 via-base-200/30 to-base-300/20 p-8 text-center opacity-60 shadow-inner backdrop-blur-sm md:p-12">
                  <div className="w-20 h-20 mb-4 rounded-full border-4 border-base-300 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-10 w-10 text-base-content/40"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold">Próximo passo</h3>
                  <p className="max-w-sm mx-auto mt-2 text-sm text-base-content/70">
                    Preencha os dados do jogo e toque em analisar. Depois, abra as abas Estatísticas ou Veredito da IA.
                  </p>
                </div>
              )}
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
  );
};

export default App;
