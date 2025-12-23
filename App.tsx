
import React, { useState, useEffect } from 'react';
import MatchForm from './components/MatchForm';
import AnalysisDashboard from './components/AnalysisDashboard';
import MainScreen from './components/MainScreen';
import BankSettings from './components/BankSettings';
import InAppNotification from './components/InAppNotification';
import { 
  scheduleNotificationsForMatches, 
  cancelNotification, 
  restoreScheduledNotifications,
  getMatchesWithinNotificationWindow,
  requestNotificationPermission
} from './services/notificationService';
import { performAnalysis } from './services/analysisEngine';
import { loadSavedAnalyses, saveOrUpdateAnalysis, deleteAnalysis, loadBankSettings, saveBankSettings } from './services/supabaseService';
import { syncDataToWidgets, syncMatchesToWidgets, syncBankToWidgets } from './services/widgetSyncService';
import { MatchData, AnalysisResult, SavedAnalysis, BankSettings as BankSettingsType, BetInfo } from './types';
import { calculateBankUpdate } from './utils/bankCalculator';
import { ArrowLeft, Loader, Wallet } from 'lucide-react';

type View = 'home' | 'analysis';

// Função de debounce para evitar muitas requisições
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const App: React.FC = () => {
  const [view, setView] = useState<View>('home');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentMatchData, setCurrentMatchData] = useState<MatchData | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<SavedAnalysis | null>(null);
  const [savedMatches, setSavedMatches] = useState<SavedAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [bankSettings, setBankSettings] = useState<BankSettingsType | undefined>(undefined);
  const [showBankSettings, setShowBankSettings] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [activeNotifications, setActiveNotifications] = useState<SavedAnalysis[]>([]);

  // Carregar do Supabase na inicialização
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setSyncError(null);
        
        // Carregar análises e banca em paralelo
        const [matches, bank] = await Promise.all([
          loadSavedAnalyses(),
          loadBankSettings()
        ]);
        
        setSavedMatches(matches);
        if (bank) {
          setBankSettings(bank);
        } else {
          // Se não há banca no Supabase, tentar carregar do localStorage
          const storedBank = localStorage.getItem('goalscan_bank_settings');
          if (storedBank) {
            try {
              setBankSettings(JSON.parse(storedBank));
            } catch (e) {
              console.error('Erro ao carregar configurações de banca do localStorage:', e);
            }
          }
        }

        // Agendar notificações para as partidas carregadas
        await restoreScheduledNotifications(matches);
        
        // Solicitar permissão de notificações na primeira vez
        await requestNotificationPermission();
        
        // Salvar no localStorage como backup
        try {
          localStorage.setItem('goalscan_saved', JSON.stringify(matches));
          if (bank) {
            localStorage.setItem('goalscan_bank_settings', JSON.stringify(bank));
          }
          
          // Sincronizar com widgets Android no carregamento inicial
          syncDataToWidgets(matches, bank);
        } catch (e) {
          console.warn('Erro ao salvar no localStorage (backup):', e);
        }
        
        setLastSyncTime(Date.now());
      } catch (error) {
        console.error('Erro ao carregar dados do Supabase:', error);
        setSyncError('Erro ao sincronizar com o servidor. Usando dados locais...');
        // Tentar carregar do localStorage como fallback
        const stored = localStorage.getItem('goalscan_saved');
        if (stored) {
          try {
            setSavedMatches(JSON.parse(stored));
          } catch (e) {
            console.error('Erro ao carregar do localStorage:', e);
          }
        }
        const storedBank = localStorage.getItem('goalscan_bank_settings');
        if (storedBank) {
          try {
            setBankSettings(JSON.parse(storedBank));
          } catch (e) {
            console.error('Erro ao carregar configurações de banca do localStorage:', e);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Salvamento automático de análises com debounce
  useEffect(() => {
    // Não salvar na inicialização (já foi carregado)
    if (isLoading || savedMatches.length === 0) {
      return;
    }

    const debouncedSave = debounce(async () => {
      try {
        setIsSyncing(true);
        setSyncError(null);
        
        // Salvar todas as análises no Supabase
        const savePromises = savedMatches.map(match => saveOrUpdateAnalysis(match));
        await Promise.all(savePromises);
        
        // Atualizar localStorage como backup
        try {
          localStorage.setItem('goalscan_saved', JSON.stringify(savedMatches));
        } catch (e) {
          console.warn('Erro ao salvar no localStorage (backup):', e);
        }
        
        setLastSyncTime(Date.now());
      } catch (error) {
        console.error('Erro ao salvar análises automaticamente:', error);
        setSyncError('Erro ao sincronizar. Dados salvos localmente.');
        // Salvar no localStorage mesmo em caso de erro
        try {
          localStorage.setItem('goalscan_saved', JSON.stringify(savedMatches));
        } catch (e) {
          console.error('Erro ao salvar no localStorage:', e);
        }
      } finally {
        setIsSyncing(false);
      }
    }, 2500); // 2.5 segundos de debounce

    debouncedSave();

    // Cleanup: cancelar debounce se componente desmontar ou dependências mudarem
    return () => {
      // O debounce já gerencia seu próprio cleanup via setTimeout
    };
  }, [savedMatches, isLoading]);

  // Salvamento automático de configurações de banca com debounce
  useEffect(() => {
    // Não salvar se não há banca configurada ou se ainda está carregando
    if (isLoading || !bankSettings) {
      return;
    }

    const debouncedSave = debounce(async () => {
      try {
        setIsSyncing(true);
        setSyncError(null);
        
        // Salvar no Supabase
        await saveBankSettings(bankSettings);
        
        // Atualizar localStorage como backup
        try {
          localStorage.setItem('goalscan_bank_settings', JSON.stringify(bankSettings));
        } catch (e) {
          console.warn('Erro ao salvar no localStorage (backup):', e);
        }
        
        setLastSyncTime(Date.now());
      } catch (error) {
        console.error('Erro ao salvar configurações de banca automaticamente:', error);
        setSyncError('Erro ao sincronizar banca. Dados salvos localmente.');
        // Salvar no localStorage mesmo em caso de erro
        try {
          localStorage.setItem('goalscan_bank_settings', JSON.stringify(bankSettings));
        } catch (e) {
          console.error('Erro ao salvar no localStorage:', e);
        }
      } finally {
        setIsSyncing(false);
      }
    }, 2500); // 2.5 segundos de debounce

    debouncedSave();
  }, [bankSettings, isLoading]);

  // Verificação periódica de notificações in-app
  useEffect(() => {
    const checkNotifications = () => {
      const matchesToNotify = getMatchesWithinNotificationWindow(savedMatches);
      
      setActiveNotifications(prev => {
        // Filtrar apenas partidas que ainda não estão sendo exibidas
        const newNotifications = matchesToNotify.filter(
          match => !prev.some(n => n.id === match.id)
        );
        
        // Combinar notificações existentes com novas
        const allNotifications = [...prev, ...newNotifications];

        // Remover notificações de partidas que já passaram
        return allNotifications.filter(match => {
          const matchTimestamp = match.data.matchDate && match.data.matchTime
            ? new Date(`${match.data.matchDate}T${match.data.matchTime}:00`).getTime()
            : null;
          if (!matchTimestamp) return false;
          return matchTimestamp > Date.now();
        });
      });
    };

    // Verificar imediatamente
    checkNotifications();

    // Verificar a cada minuto
    const interval = setInterval(checkNotifications, 60000);

    return () => clearInterval(interval);
  }, [savedMatches]);

  // Atualizar notificações quando partidas mudarem
  useEffect(() => {
    if (!isLoading && savedMatches.length > 0) {
      scheduleNotificationsForMatches(savedMatches);
    }
  }, [savedMatches, isLoading]);

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

  const handleRemoveNotification = (matchId: string) => {
    setActiveNotifications(prev => prev.filter(n => n.id !== matchId));
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
        setIsSaving(true);
        setSyncError(null);

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

        // Salvar no Supabase
        const savedMatch = await saveOrUpdateAnalysis(matchToSave);

        // Atualizar estado local
        if (selectedMatch) {
          setSavedMatches(prev => prev.map(m => m.id === selectedMatch.id ? savedMatch : m));
        } else {
          setSavedMatches(prev => [savedMatch, ...prev]);
        }

        // Salvar também no localStorage como backup
        try {
          const allMatches = selectedMatch
            ? savedMatches.map(m => m.id === selectedMatch.id ? savedMatch : m)
            : [savedMatch, ...savedMatches];
          localStorage.setItem('goalscan_saved', JSON.stringify(allMatches));
          
          // Sincronizar com widgets Android
          syncMatchesToWidgets(allMatches);
        } catch (e) {
          console.warn('Erro ao salvar no localStorage (backup):', e);
        }

        // Reagendar notificações será feito pelo useEffect que monitora savedMatches

        // Voltar para home após salvar
        setTimeout(() => {
          handleNavigateToHome();
        }, 300);
      } catch (error) {
        console.error('Erro ao salvar partida:', error);
        setSyncError('Erro ao salvar no servidor. Os dados foram salvos localmente.');
        // Salvar no localStorage como fallback
        try {
          if (selectedMatch) {
            const updatedMatch: SavedAnalysis = {
              ...selectedMatch,
              data: currentMatchData,
              result: analysisResult,
              timestamp: Date.now()
            };
            setSavedMatches(prev => prev.map(m => m.id === selectedMatch.id ? updatedMatch : m));
            localStorage.setItem('goalscan_saved', JSON.stringify(savedMatches.map(m => m.id === selectedMatch.id ? updatedMatch : m)));
          } else {
            const newSaved: SavedAnalysis = {
              id: Math.random().toString(36).substr(2, 9),
              timestamp: Date.now(),
              data: currentMatchData,
              result: analysisResult
            };
            setSavedMatches(prev => [newSaved, ...prev]);
            localStorage.setItem('goalscan_saved', JSON.stringify([newSaved, ...savedMatches]));
          }
        } catch (e) {
          console.error('Erro ao salvar no localStorage:', e);
        }
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSaveBankSettings = (settings: BankSettingsType) => {
    setBankSettings(settings);
    // O salvamento automático será feito pelo useEffect com debounce
    // Mas também salvar imediatamente no localStorage como backup
    try {
      localStorage.setItem('goalscan_bank_settings', JSON.stringify(settings));
      
      // Sincronizar com widgets Android
      syncBankToWidgets(settings);
    } catch (e) {
      console.warn('Erro ao salvar no localStorage:', e);
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
        setBankSettings(newBankSettings);
        localStorage.setItem('goalscan_bank_settings', JSON.stringify(newBankSettings));
        
        // Sincronizar com widgets Android
        syncBankToWidgets(newBankSettings);
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

        // Salvar no Supabase
        const savedMatch = await saveOrUpdateAnalysis(updatedMatch);
        
        // Atualizar estado local
        setSavedMatches(prev => prev.map(m => m.id === selectedMatch.id ? savedMatch : m));
        setSelectedMatch(savedMatch);

        // Salvar também no localStorage como backup
        try {
          const allMatches = savedMatches.map(m => m.id === selectedMatch.id ? savedMatch : m);
          localStorage.setItem('goalscan_saved', JSON.stringify(allMatches));
        } catch (e) {
          console.warn('Erro ao salvar no localStorage (backup):', e);
        }
      } catch (error) {
        console.error('Erro ao salvar aposta:', error);
        // Salvar localmente mesmo em caso de erro
        const updatedMatch: SavedAnalysis = {
          ...selectedMatch,
          data: currentMatchData,
          result: analysisResult,
          betInfo,
          timestamp: Date.now()
        };
        setSavedMatches(prev => prev.map(m => m.id === selectedMatch.id ? updatedMatch : m));
        setSelectedMatch(updatedMatch);
        try {
          const allMatches = savedMatches.map(m => m.id === selectedMatch.id ? updatedMatch : m);
          localStorage.setItem('goalscan_saved', JSON.stringify(allMatches));
        } catch (e) {
          console.error('Erro ao salvar no localStorage:', e);
        }
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
      setSyncError(null);
      // Cancelar notificação da partida
      cancelNotification(id);
      // Remover notificação in-app se estiver ativa
      setActiveNotifications(prev => prev.filter(n => n.id !== id));
      // Deletar do Supabase
      await deleteAnalysis(id);
      // Atualizar estado local
      setSavedMatches(prev => {
        const updated = prev.filter(m => m.id !== id);
        
        // Sincronizar com widgets Android
        syncMatchesToWidgets(updated);
        
        return updated;
      });
      // Atualizar localStorage como backup
      try {
        const updated = savedMatches.filter(m => m.id !== id);
        localStorage.setItem('goalscan_saved', JSON.stringify(updated));
      } catch (e) {
        console.warn('Erro ao atualizar localStorage:', e);
      }
    } catch (error) {
      console.error('Erro ao deletar partida:', error);
      setSyncError('Erro ao deletar no servidor. A partida foi removida localmente.');
      // Remover localmente mesmo em caso de erro
      setSavedMatches(prev => prev.filter(m => m.id !== id));
      try {
        const updated = savedMatches.filter(m => m.id !== id);
        localStorage.setItem('goalscan_saved', JSON.stringify(updated));
      } catch (e) {
        console.error('Erro ao atualizar localStorage:', e);
      }
    }
  };

  // Renderizar tela principal ou tela de análise
  if (view === 'home') {
    return (
      <div className="min-h-screen pb-12 md:pb-20">
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
              {bankSettings && (
                <button
                  onClick={() => setShowBankSettings(!showBankSettings)}
                  className="btn btn-sm btn-outline btn-secondary flex items-center gap-1.5 px-2"
                  title="Banca"
                >
                  <Wallet className="w-4 h-4" />
                  <span className="text-xs font-bold">
                    {bankSettings.currency} {bankSettings.totalBank.toFixed(0)}
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
              {isLoading && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-info/10 border border-info/20 rounded-lg">
                  <Loader className="w-3 h-3 text-info animate-spin" />
                  <span className="text-xs font-bold text-info">Carregando...</span>
                </div>
              )}
              {isSyncing && !isLoading && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-info/10 border border-info/20 rounded-lg">
                  <Loader className="w-3 h-3 text-info animate-spin" />
                  <span className="text-xs font-bold text-info">Sincronizando...</span>
                </div>
              )}
              {!isSyncing && !isLoading && !syncError && lastSyncTime && (
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
              <button
                onClick={() => setShowBankSettings(!showBankSettings)}
                className="btn btn-sm btn-outline btn-secondary flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Banca
                {bankSettings && (
                  <span className="badge badge-sm">
                    {bankSettings.currency} {bankSettings.totalBank.toFixed(0)}
                  </span>
                )}
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
                onSave={(settings) => {
                  handleSaveBankSettings(settings);
                  setShowBankSettings(false);
                }}
              />
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-sm opacity-60">Carregando partidas salvas...</p>
            </div>
          ) : (
            <MainScreen
              savedMatches={savedMatches}
              onMatchClick={handleNavigateToAnalysis}
              onNewMatch={handleNewMatch}
              onDeleteMatch={handleDeleteSaved}
            />
          )}
        </main>

        <footer className="fixed bottom-0 left-0 right-0 bg-base-300 border-t border-base-100 p-2 md:hidden z-40">
          <div className="flex justify-center gap-4 text-[10px] font-bold opacity-50 uppercase tracking-widest">
            <span>Poisson v3.8</span>
            <span>•</span>
            <span>EV Analysis</span>
          </div>
        </footer>
      </div>
    );
  }

  // Tela de Análise
  return (
    <div className="min-h-screen pb-12 md:pb-20">
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
            {bankSettings && (
              <button
                onClick={() => setShowBankSettings(!showBankSettings)}
                className="btn btn-sm btn-outline btn-secondary flex items-center gap-1.5 px-2"
                title="Banca"
              >
                <Wallet className="w-4 h-4" />
                <span className="text-xs font-bold">
                  {bankSettings.currency} {bankSettings.totalBank.toFixed(0)}
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
                betInfo={selectedMatch?.betInfo}
                bankSettings={bankSettings}
                onBetSave={handleSaveBetInfo}
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
