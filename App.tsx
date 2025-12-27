
import React, { useState, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MatchForm from './components/MatchForm';
import BankSettings from './components/BankSettings';
import InAppNotification from './components/InAppNotification';
import ToastContainer from './components/ToastContainer';
import Breadcrumb from './components/Breadcrumb';
import CommandPalette from './components/CommandPalette';
import MobileNav from './components/MobileNav';
import SettingsScreen from './components/SettingsScreen';
import { useToast } from './hooks/useToast';
import { useSavedMatches } from './hooks/useSavedMatches';
import { useBankSettings } from './hooks/useBankSettings';
import { useNotifications } from './hooks/useNotifications';
import { Loader, Plus, Settings, Home, Wallet } from 'lucide-react';
import { animations } from './utils/animations';

// Lazy loading de componentes pesados para code splitting
const AnalysisDashboard = lazy(() => import('./components/AnalysisDashboard'));
const MainScreen = lazy(() => import('./components/MainScreen'));

import { cancelNotification } from './services/notificationService';
import { performAnalysis } from './services/analysisEngine';
import { MatchData, AnalysisResult, SavedAnalysis, BankSettings as BankSettingsType, BetInfo } from './types';
import { calculateBankUpdate } from './utils/bankCalculator';
import { getCurrencySymbol } from './utils/currency';
import { ArrowLeft, Wallet } from 'lucide-react';

type View = 'home' | 'analysis' | 'settings';

const App: React.FC = () => {
  const { toasts, removeToast, error: showError, success: showSuccess } = useToast();
  const { savedMatches, isLoading, isSaving, syncError, isUsingLocalData, saveMatch, removeMatch } = useSavedMatches(showError);
  const { bankSettings, isSyncing, lastSyncTime, saveSettings } = useBankSettings(showError);
  const { activeNotifications, removeNotification, cancelMatchNotification } = useNotifications(savedMatches);
  
  const [view, setView] = useState<View>('home');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentMatchData, setCurrentMatchData] = useState<MatchData | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<SavedAnalysis | null>(null);
  const [showBankSettings, setShowBankSettings] = useState<boolean>(false);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);


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

  const handleNavigateToSettings = () => {
    setView('settings');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemoveNotification = (matchId: string) => {
    removeNotification(matchId);
  };

  const handleNotificationClick = (match: SavedAnalysis) => {
    handleNavigateToAnalysis(match);
  };

  const handleAnalyze = (data: MatchData) => {
    const result = performAnalysis(data);
    setAnalysisResult(result);
    setCurrentMatchData(data);
    if (window.innerWidth < 768) {
      window.scrollTo({ top: 600, behavior: 'smooth' });
    }
  };

  const handleSaveMatch = async () => {
    if (analysisResult && currentMatchData) {
      try {
        let matchToSave: SavedAnalysis;

        // Se já existe uma partida selecionada, atualizar ela
        if (selectedMatch) {
          matchToSave = {
            ...selectedMatch,
            data: currentMatchData,
            result: analysisResult,
            betInfo: selectedMatch.betInfo, // Manter betInfo se existir
            timestamp: Date.now() // Atualizar timestamp
          };
        } else {
          // Criar nova partida
          matchToSave = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            data: currentMatchData,
            result: analysisResult,
            betInfo: selectedMatch?.betInfo // Incluir betInfo se existir
          };
        }

        // Salvar usando o hook
        await saveMatch(matchToSave);
        showSuccess('Partida salva com sucesso!');

        // Voltar para home após salvar
        setTimeout(() => {
          handleNavigateToHome();
        }, 300);
      } catch (error) {
        showError('Erro ao salvar partida. Tente novamente.');
      }
    }
  };

  const handleSaveBankSettings = async (settings: BankSettingsType) => {
    try {
      await saveSettings(settings);
      showSuccess('Configurações de banca salvas com sucesso!');
    } catch (error) {
      showError('Erro ao salvar configurações de banca.');
    }
  };

  const handleSaveBetInfo = async (betInfo: BetInfo) => {
    // Atualizar banca se há banca configurada
    if (bankSettings) {
      // Detectar se é uma nova aposta ou remoção
      const oldBetInfo = selectedMatch?.betInfo;
      const isNewBet = !oldBetInfo || oldBetInfo.betAmount === 0;
      const isRemovingBet = betInfo.betAmount === 0 || betInfo.status === 'cancelled';
      
      // Determinar oldStatus corretamente
      let oldStatus: BetInfo['status'] | undefined;
      let oldBetAmount = 0;
      
      if (isNewBet) {
        // Nova aposta: oldStatus é undefined
        oldStatus = undefined;
      } else {
        // Aposta existente: usar status e valor anterior
        oldStatus = oldBetInfo.status;
        oldBetAmount = oldBetInfo.betAmount;
      }
      
      const newStatus = betInfo.status;
      const newBetAmount = betInfo.betAmount;
      
      // Se está removendo a aposta, usar valores antigos para calcular devolução
      const betAmountForCalc = isRemovingBet ? oldBetAmount : newBetAmount;
      const potentialReturnForCalc = isRemovingBet 
        ? (oldBetInfo?.potentialReturn || 0)
        : betInfo.potentialReturn;
      
      // Tratar mudança de valor da aposta (quando não é nova e não está removendo)
      let valueChangeAdjustment = 0;
      if (!isNewBet && !isRemovingBet && oldBetAmount !== newBetAmount && oldStatus) {
        // Se o valor mudou, precisa ajustar a diferença
        if (oldStatus === 'pending') {
          // Estava pending: reverter desconto antigo e aplicar novo desconto
          valueChangeAdjustment = oldBetAmount - newBetAmount;
        } else if (oldStatus === 'won') {
          // Estava won: reverter retorno antigo e aplicar novo retorno
          const oldReturn = oldBetInfo.potentialReturn || 0;
          valueChangeAdjustment = betInfo.potentialReturn - oldReturn;
        }
        // Se estava lost, não precisa ajustar (já estava descontado)
      }
      
      // Calcular diferença na banca
      const bankDifference = calculateBankUpdate(
        oldStatus,
        newStatus,
        betAmountForCalc,
        potentialReturnForCalc
      ) + valueChangeAdjustment;

      // Se houve mudança que afeta a banca, atualizar
      if (bankDifference !== 0) {
        const updatedBank = bankSettings.totalBank + bankDifference;
        const newBankSettings: BankSettingsType = {
          ...bankSettings,
          totalBank: Math.max(0, updatedBank), // Banca não pode ser negativa
          updatedAt: Date.now()
        };
        await saveSettings(newBankSettings);
        showSuccess('Banca atualizada com sucesso!');
      }

      // Atualizar resultAt quando status muda para won/lost
      if ((newStatus === 'won' || newStatus === 'lost') && !betInfo.resultAt) {
        betInfo.resultAt = Date.now();
      }
    }

    if (selectedMatch && currentMatchData && analysisResult) {
      try {
        const updatedMatch: SavedAnalysis = {
          ...selectedMatch,
          data: currentMatchData,
          result: analysisResult,
          betInfo,
          timestamp: Date.now()
        };

        // Salvar usando o hook
        const savedMatch = await saveMatch(updatedMatch);
        setSelectedMatch(savedMatch);
        showSuccess('Aposta atualizada com sucesso!');
      } catch (error) {
        showError('Erro ao salvar aposta. Tente novamente.');
      }
    } else if (currentMatchData && analysisResult) {
      // Se não há partida salva ainda, apenas atualizar o estado local
      // A aposta será salva quando o usuário salvar a partida
      const tempMatch: SavedAnalysis = {
        id: selectedMatch?.id || Math.random().toString(36).substr(2, 9),
        timestamp: selectedMatch?.timestamp || Date.now(),
        data: currentMatchData,
        result: analysisResult,
        betInfo
      };
      setSelectedMatch(tempMatch);
    }
  };

  const handleDeleteSaved = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      // Cancelar notificação da partida
      cancelMatchNotification(id);
      // Deletar usando o hook
      await removeMatch(id);
      showSuccess('Partida removida com sucesso!');
    } catch (error) {
      showError('Erro ao remover partida. Tente novamente.');
    }
  };

  // Keyboard shortcut para Command Palette (⌘K ou Ctrl+K)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
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
      category: 'Ações'
    },
    {
      id: 'home',
      label: 'Ir para Início',
      description: 'Voltar para a tela principal',
      icon: <Home className="w-4 h-4" />,
      shortcut: '⌘H',
      action: () => {
        handleNavigateToHome();
        setShowCommandPalette(false);
      },
      category: 'Navegação'
    },
    {
      id: 'bank-settings',
      label: 'Configurar Banca',
      description: 'Abrir configurações da banca',
      icon: <Wallet className="w-4 h-4" />,
      shortcut: '⌘B',
      action: () => {
        setShowBankSettings(true);
        setShowCommandPalette(false);
      },
      category: 'Configurações'
    },
    {
      id: 'settings',
      label: 'Configurações',
      description: 'Abrir configurações gerais',
      icon: <Settings className="w-4 h-4" />,
      shortcut: '⌘,',
      action: () => {
        handleNavigateToSettings();
        setShowCommandPalette(false);
      },
      category: 'Configurações'
    }
  ];

  // Renderizar tela principal ou tela de análise
  if (view === 'home') {
    return (
      <div className="min-h-screen pb-12 md:pb-20">
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

        <header className="bg-base-200/80 backdrop-blur-md border-b border-base-300 py-3 md:py-4 mb-6 md:mb-8 sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto px-3 md:px-4 flex justify-between items-center gap-2">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center text-primary-content font-black italic text-lg md:text-xl shadow-lg flex-shrink-0">
                G
              </div>
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-black tracking-tighter leading-none truncate">GOALSCAN PRO</h1>
                <span className="text-[9px] md:text-[10px] uppercase font-bold tracking-widest text-primary opacity-80 hidden sm:inline">AI Goal Analysis Engine</span>
              </div>
            </div>
            {/* Versão Mobile - Banca Compacta */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={handleNavigateToSettings}
                className="btn btn-sm btn-ghost px-2"
                title="Configurações"
                aria-label="Configurações"
              >
                <Settings className="w-5 h-5" />
              </button>
              {bankSettings && (
                <button
                  onClick={() => setShowBankSettings(!showBankSettings)}
                  className="btn btn-sm btn-outline btn-secondary flex items-center gap-1.5 px-2"
                  title="Banca"
                >
                  <Wallet className="w-4 h-4" />
                  <span className="text-xs font-bold">
                    {getCurrencySymbol(bankSettings.currency)} {bankSettings.totalBank.toFixed(0)}
                  </span>
                </button>
              )}
              {!bankSettings && (
                <button
                  onClick={() => setShowBankSettings(!showBankSettings)}
                  className="btn btn-sm btn-outline btn-secondary flex items-center gap-1.5 px-2"
                  title="Configurar Banca"
                >
                  <Wallet className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Versão Desktop */}
            <div className="hidden md:flex gap-4 items-center">
              {/* Indicador de status das partidas salvas */}
              {isLoading && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-info/10 border border-info/20 rounded-lg">
                  <Loader className="w-3 h-3 text-info animate-spin" />
                  <span className="text-xs font-bold text-info">Carregando partidas...</span>
                </div>
              )}
              {!isLoading && isUsingLocalData && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border border-warning/20 rounded-lg" title="Usando dados locais. Verifique a conexão com Supabase.">
                  <div className="w-2 h-2 bg-warning rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-warning">Modo Offline</span>
                </div>
              )}
              {!isLoading && !isUsingLocalData && !syncError && savedMatches.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/20 rounded-lg" title="Partidas sincronizadas com Supabase">
                  <div className="w-2 h-2 bg-success rounded-full" />
                  <span className="text-xs font-bold text-success">{savedMatches.length} partida(s)</span>
                </div>
              )}
              {syncError && !isLoading && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-error/10 border border-error/20 rounded-lg" title={syncError}>
                  <span className="text-xs font-bold text-error">Erro de sincronização</span>
                </div>
              )}
              
              {/* Indicador de status da banca */}
              {isSyncing && !isLoading && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-info/10 border border-info/20 rounded-lg">
                  <Loader className="w-3 h-3 text-info animate-spin" />
                  <span className="text-xs font-bold text-info">Sincronizando banca...</span>
                </div>
              )}
              {!isSyncing && !isLoading && !syncError && lastSyncTime && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/20 rounded-lg" title={`Última sincronização: ${new Date(lastSyncTime).toLocaleTimeString('pt-BR')}`}>
                  <div className="w-2 h-2 bg-success rounded-full" />
                  <span className="text-xs font-bold text-success">Banca sincronizada</span>
                </div>
              )}
              <button
                onClick={() => setShowBankSettings(!showBankSettings)}
                className="btn btn-sm btn-outline btn-secondary flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Banca
                {bankSettings && (
                  <span className="badge badge-sm">
                    {getCurrencySymbol(bankSettings.currency)} {bankSettings.totalBank.toFixed(0)}
                  </span>
                )}
              </button>
              <button
                onClick={handleNavigateToSettings}
                className="btn btn-sm btn-outline flex items-center gap-2"
                aria-label="Abrir configurações"
              >
                <Settings className="w-4 h-4" />
                Configurações
              </button>
              <span className="badge badge-outline badge-sm font-bold">v3.8.2 Elite Edition</span>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 pt-0">
          {/* Configurações de Banca */}
          {showBankSettings && (
            <div className="mb-6">
              <BankSettings
                bankSettings={bankSettings}
                onSave={async (settings) => {
                  await handleSaveBankSettings(settings);
                  setShowBankSettings(false);
                }}
                onError={showError}
              />
            </div>
          )}

          <Suspense fallback={
            <div className="flex flex-col items-center justify-center py-20">
              <Loader className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-sm opacity-60">Carregando...</p>
            </div>
          }>
            <MainScreen
              savedMatches={savedMatches}
              onMatchClick={handleNavigateToAnalysis}
              onNewMatch={handleNewMatch}
              onDeleteMatch={handleDeleteSaved}
              isLoading={isLoading}
            />
          </Suspense>
        </main>

        {/* Mobile Navigation */}
        <MobileNav
          items={[
            {
              id: 'home',
              label: 'Início',
              icon: <Home className="w-5 h-5" />,
              onClick: handleNavigateToHome,
              active: view === 'home'
            },
            {
              id: 'new',
              label: 'Nova',
              icon: <Plus className="w-5 h-5" />,
              onClick: handleNewMatch
            }
          ]}
          menuItems={[
            {
              id: 'home',
              label: 'Início',
              icon: <Home className="w-5 h-5" />,
              onClick: handleNavigateToHome,
              active: view === 'home'
            },
            {
              id: 'new',
              label: 'Nova Análise',
              icon: <Plus className="w-5 h-5" />,
              onClick: handleNewMatch
            },
            {
              id: 'settings',
              label: 'Configurações',
              icon: <Settings className="w-5 h-5" />,
              onClick: handleNavigateToSettings
            }
          ]}
          onBankClick={() => setShowBankSettings(true)}
          bankLabel={bankSettings ? `${getCurrencySymbol(bankSettings.currency)} ${bankSettings.totalBank.toFixed(0)}` : 'Banca'}
        />
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <>
        {/* Command Palette */}
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          actions={commandActions}
        />

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} onClose={removeToast} />

        <SettingsScreen
          onBack={handleNavigateToHome}
          onSuccess={showSuccess}
          onError={showError}
        />
      </>
    );
  }

  // Tela de Análise
  return (
    <motion.div 
      className="min-h-screen pb-12 md:pb-20"
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
    >
      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        actions={commandActions}
      />
      
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
      
      {/* Notificações In-App */}
      {activeNotifications.map((match, index) => (
        <div key={match.id} style={{ top: `${80 + index * 120}px` }} className="fixed left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100]">
          <InAppNotification
            match={match}
            onClose={() => handleRemoveNotification(match.id)}
            onClick={() => handleNotificationClick(match)}
          />
        </div>
      ))}

      <header className="bg-base-200/80 backdrop-blur-md border-b border-base-300 py-3 md:py-4 mb-6 md:mb-8 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 md:px-4 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <button
              onClick={handleNavigateToHome}
              className="btn btn-sm btn-ghost gap-1 md:gap-2 hover:bg-base-300/50 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center text-primary-content font-black italic text-lg md:text-xl shadow-lg flex-shrink-0">
              G
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-black tracking-tighter leading-none truncate">GOALSCAN PRO</h1>
              <span className="text-[9px] md:text-[10px] uppercase font-bold tracking-widest text-primary opacity-80 hidden sm:inline">AI Goal Analysis Engine</span>
            </div>
          </div>
          {/* Versão Mobile - Banca Compacta */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={handleNavigateToSettings}
              className="btn btn-sm btn-ghost px-2"
              title="Configurações"
              aria-label="Configurações"
            >
              <Settings className="w-5 h-5" />
            </button>
            {bankSettings && (
              <button
                onClick={() => setShowBankSettings(!showBankSettings)}
                className="btn btn-sm btn-outline btn-secondary flex items-center gap-1.5 px-2"
                title="Banca"
              >
                <Wallet className="w-4 h-4" />
                <span className="text-xs font-bold">
                  {getCurrencySymbol(bankSettings.currency)} {bankSettings.totalBank.toFixed(0)}
                </span>
              </button>
            )}
            {!bankSettings && (
              <button
                onClick={() => setShowBankSettings(!showBankSettings)}
                className="btn btn-sm btn-outline btn-secondary flex items-center gap-1.5 px-2"
                title="Configurar Banca"
              >
                <Wallet className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Versão Desktop */}
          <div className="hidden md:flex gap-4 items-center">
            {isSaving && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-info/10 border border-info/20 rounded-lg">
                <Loader className="w-3 h-3 text-info animate-spin" />
                <span className="text-xs font-bold text-info">Salvando...</span>
              </div>
            )}
            {isSyncing && !isSaving && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-info/10 border border-info/20 rounded-lg">
                <Loader className="w-3 h-3 text-info animate-spin" />
                <span className="text-xs font-bold text-info">Sincronizando...</span>
              </div>
            )}
            {!isSyncing && !isSaving && !syncError && lastSyncTime && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/20 rounded-lg" title={`Última sincronização: ${new Date(lastSyncTime).toLocaleTimeString('pt-BR')}`}>
                <div className="w-2 h-2 bg-success rounded-full" />
                <span className="text-xs font-bold text-success">Sincronizado</span>
              </div>
            )}
            {syncError && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border border-warning/20 rounded-lg">
                <span className="text-xs font-bold text-warning">{syncError}</span>
              </div>
            )}
            {analysisResult && !isSaving && !isSyncing && (
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
        <Breadcrumb
          items={[
            { label: 'Início', onClick: handleNavigateToHome },
            { label: currentMatchData ? `${currentMatchData.homeTeam} vs ${currentMatchData.awayTeam}` : 'Nova Análise' }
          ]}
        />
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
              <Suspense fallback={
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader className="w-12 h-12 text-primary animate-spin mb-4" />
                  <p className="text-sm opacity-60">Carregando análise...</p>
                </div>
              }>
                <AnalysisDashboard 
                  result={analysisResult} 
                  data={currentMatchData} 
                  onSave={handleSaveMatch}
                  betInfo={selectedMatch?.betInfo}
                  bankSettings={bankSettings}
                  onBetSave={handleSaveBetInfo}
                  onError={showError}
                />
              </Suspense>
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
    </motion.div>
  );
};

export default App;
