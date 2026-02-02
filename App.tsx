import React, { useState, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MatchForm from './components/MatchForm';
import StatusBadge from './components/StatusBadge';
import BetConfirmationModal from './BetConfirmationModal';
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
import { useToast } from './hooks/useToast'; // Importar o hook useToast
import { useSavedMatches } from './hooks/useSavedMatches';
import { useBankSettings } from './hooks/useBankSettings';
import { useNotifications } from './hooks/useNotifications';
import { Loader, Plus, Settings, Home, Wallet, ArrowLeft, X } from 'lucide-react';

// Lazy loading de componentes pesados para code splitting
const AnalysisDashboard = lazy(() => import('./components/AnalysisDashboard'));

import { performAnalysis } from './services/analysisEngine';
import {
  MatchData,
  AnalysisResult,
  SavedAnalysis,
  BankSettings as BankSettingsType,
  BetInfo,
  SelectedBet,
  MatchResultAnalysis,
} from './types';
import { calculateBankUpdate } from './utils/bankCalculator';
import { getCurrencySymbol } from './utils/currency';
import { logger } from './utils/logger';
import { generateAnalysisText, parseWebSearchResults } from './services/matchResultAnalysisService';

const App: React.FC = () => {
  const { toasts, removeToast, error: showError, success: showSuccess, addToast } = useToast(); // Usar o hook useToast
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
  const [showAnalysisModal, setShowAnalysisModal] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentMatchData, setCurrentMatchData] = useState<MatchData | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<SavedAnalysis | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [isUpdatingBetStatus, setIsUpdatingBetStatus] = useState<boolean>(false);
  const [showResultAnalysisModal, setShowResultAnalysisModal] = useState<boolean>(false);
  const [matchForAnalysis, setMatchForAnalysis] = useState<SavedAnalysis | null>(null);
  const [webSearchResults, setWebSearchResults] = useState<Array<{ content?: string; snippet?: string; url?: string }>>([]);

  const [showBetConfirmModal, setShowBetConfirmModal] = useState<boolean>(false);
  const [betInfoToConfirm, setBetInfoToConfirm] = useState<BetInfo | null>(null);

  // Funções de Navegação
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
    setShowAnalysisModal(true);
  };

  const handleCloseAnalysis = () => {
    setShowAnalysisModal(false);
    setAnalysisResult(null);
    setCurrentMatchData(null);
    setSelectedMatch(null);
  };

  const handleNewMatch = () => {
    handleNavigateToAnalysis(null);
  };

  const handleRemoveNotification = (matchId: string) => {
    removeNotification(matchId);
  };

  const handleNotificationClick = (match: SavedAnalysis) => {
    handleNavigateToAnalysis(match);
  };

  const handleAnalyze = async (data: MatchData) => {
    // Log: verificar dados recebidos antes de analisar
    if (import.meta.env.DEV) {
      console.log('[App] ===== handleAnalyze - Dados recebidos do MatchForm =====');
      console.log('[App] Times:', {
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
      });
      console.log('[App] Status das tabelas:', {
        geral: !!(data.homeTableData && data.awayTableData),
        complement: !!(data.homeComplementData && data.awayComplementData && data.competitionComplementAvg),
      });
      
      // Validação explícita antes de análise (apenas tabelas suportadas)
      const hasGeral = !!(data.homeTableData && data.awayTableData);
      const hasComplement = !!(data.homeComplementData && data.awayComplementData && data.competitionComplementAvg);
      
      const allTablesPresent = hasGeral && hasComplement;
      
      if (allTablesPresent) {
        console.log('[App] ✅ Todas as 2 tabelas presentes (geral, complement) - análise será completa');
      } else {
        const missingTables = [];
        if (!hasGeral) missingTables.push('geral');
        if (!hasComplement) missingTables.push('complement');
        console.warn(`[App] ⚠️ Tabelas faltando: ${missingTables.join(', ')} - análise será parcial`);
      }
    }
    
    // Executar análise estatística (combina estatísticas + tabela)
    const result = performAnalysis(data);
    setAnalysisResult(result);
    setCurrentMatchData(data);
    
    // Scroll para resultados em mobile
    if (window.innerWidth < 768) {
      window.scrollTo({ top: 600, behavior: 'smooth' });
    }
  };


  const handleOddChange = (newOdd: number) => {
    if (currentMatchData) {
      // Atualizar odd no currentMatchData
      const updatedData = { ...currentMatchData, oddOver15: newOdd };
      setCurrentMatchData(updatedData);

      // Recalcular análise com nova odd (EV será recalculado automaticamente)
      if (analysisResult) {
        const updatedResult = performAnalysis(updatedData);
        
        // Manter as probabilidades Over/Under e combinações existentes
        updatedResult.overUnderProbabilities = analysisResult.overUnderProbabilities;
        updatedResult.recommendedCombinations = analysisResult.recommendedCombinations;
        
        setAnalysisResult(updatedResult);
      }
    }
  };

  const handleSaveMatch = async (selectedBets?: SelectedBet[]) => {
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
            selectedBets: selectedBets, // Incluir apostas selecionadas
            timestamp: Date.now(), // Atualizar timestamp
          };
        } else {
          // Criar nova partida
          matchToSave = {
            id: Math.random().toString(36).slice(2, 11),
            timestamp: Date.now(),
            data: currentMatchData,
            result: analysisResult,
            betInfo: selectedMatch?.betInfo, // Incluir betInfo se existir
            selectedBets: selectedBets, // Incluir apostas selecionadas
          };
        }

        // Salvar usando o hook
        await saveMatch(matchToSave);
        showSuccess('Partida salva com sucesso!');

        // Fechar modal após salvar
        setTimeout(() => {
          handleCloseAnalysis();
          setActiveTab('matches');
        }, 300);
      } catch {
        showError('Erro ao salvar partida. Tente novamente.');
      }
    }
  };

  const handleSaveBankSettings = async (settings: BankSettingsType) => {
    try {
      await saveSettings(settings);
      showSuccess('Configurações de banca salvas com sucesso!');
    } catch {
      showError('Erro ao salvar configurações de banca.');
    }
  };

  const handleUpdateBetStatus = async (match: SavedAnalysis, status: 'won' | 'lost' | 'pending', isUndo: boolean = false) => {
    if (!match.betInfo || match.betInfo.betAmount === 0) {
      showError('Esta partida não possui aposta registrada.');
      return;
    }

    // Verificar se o status já é o mesmo - evitar processamento desnecessário
    if (match.betInfo.status === status) {
      return; // Status já é o mesmo, não precisa processar
    }

    // Proteção contra múltiplos cliques
    if (isUpdatingBetStatus) {
      return; // Já está processando outra atualização
    }

    try {
      setIsUpdatingBetStatus(true);

      const oldBetInfo = { ...match.betInfo }; // Criar uma cópia para garantir a imutabilidade
      const updatedBetInfo: BetInfo = {
        ...oldBetInfo,
        status,
        resultAt: Date.now(),
      };

      // Atualizar a partida com o novo betInfo
      const updatedMatch: SavedAnalysis = {
        ...match,
        betInfo: updatedBetInfo,
        timestamp: Date.now(),
      };

      // Se a partida está selecionada, atualizar o estado local também
      if (selectedMatch && selectedMatch.id === match.id) {
        setSelectedMatch(updatedMatch);
        // Atualizar também currentMatchData e analysisResult se necessário
        if (!currentMatchData) setCurrentMatchData(match.data);
        if (!analysisResult) setAnalysisResult(match.result);
      }

      // Atualizar banca e salvar partida diretamente para evitar conflitos
      await updateBankFromBetChange(updatedBetInfo, oldBetInfo);
      await saveMatch(updatedMatch);

      if (isUndo) {
        showSuccess('Ação desfeita!');
      } else {
        const originalStatus = oldBetInfo.status;
        showSuccess(`Aposta marcada como ${status === 'won' ? 'ganha' : 'perdida'}!`, {
          label: 'Desfazer',
          onClick: () => {
            // Ao clicar em desfazer, reverter para o status original
            handleUpdateBetStatus(updatedMatch, originalStatus, true);
          },
        });
      }
    } catch {
      // O erro já é tratado pelo hook useToast, não precisa de ação de desfazer aqui
      // pois a operação falhou e nada foi alterado.
      showError('Erro ao atualizar status da aposta. Tente novamente.');
    } finally {
      setIsUpdatingBetStatus(false);
    }
  };

  const handleRequestBetSave = (betInfo: BetInfo) => {
    // Para apostas de valor 0 (remover aposta), não mostrar modal
    if (betInfo.betAmount > 0) {
      setBetInfoToConfirm(betInfo);
      setShowBetConfirmModal(true);
    } else {
      handleSaveBetInfo(betInfo);
    }
  };

  const handleConfirmBetSave = async () => {
    if (betInfoToConfirm) {
      await handleSaveBetInfo(betInfoToConfirm);
    }
    setShowBetConfirmModal(false);
    setBetInfoToConfirm(null);
  };

  const handleCancelBetSave = () => {
    setShowBetConfirmModal(false);
    setBetInfoToConfirm(null);
  };

  const updateBankFromBetChange = async (betInfo: BetInfo, oldBetInfo?: BetInfo) => {
    // Atualizar banca se há banca configurada
    if (bankSettings) {
      // Usar oldBetInfo fornecido ou undefined (nova aposta)
      // const oldBetInfo = providedOldBetInfo || selectedMatch?.betInfo; // Removido pois oldBetInfo já vem como argumento
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

      // Verificar se há mudança que afeta a banca (status ou valor)
      const statusChanged = oldStatus !== newStatus;
      const valueChanged = oldBetAmount !== newBetAmount;
      const needsBankUpdate = isNewBet || isRemovingBet || statusChanged || valueChanged;

      if (needsBankUpdate) {
        // Se está removendo a aposta, usar valores antigos para calcular devolução
        const betAmountForCalc = isRemovingBet ? oldBetAmount : newBetAmount;
        const potentialReturnForCalc = isRemovingBet
          ? oldBetInfo?.potentialReturn || 0
          : betInfo.potentialReturn;

        // Tratar mudança de valor da aposta (quando não é nova e não está removendo)
        let valueChangeAdjustment = 0;
        if (!isNewBet && !isRemovingBet && valueChanged && oldStatus) {
          // Se o valor mudou, precisa ajustar a diferença
          if (oldStatus === 'pending') {
            // Estava pending: reverter desconto antigo e aplicar novo desconto
            valueChangeAdjustment = oldBetAmount - newBetAmount;
          } else if (oldStatus === 'won') {
            // Estava won: reverter retorno antigo e aplicar novo retorno
            const oldReturn = oldBetInfo.potentialReturn || 0;
            valueChangeAdjustment = betInfo.potentialReturn - oldReturn;
          } else if (oldStatus === 'lost') {
            // Estava lost: a perda é o stake; ajustar diferença do valor descontado
            valueChangeAdjustment = oldBetAmount - newBetAmount;
          }
          // Se estava lost, não precisa ajustar (já estava descontado)
        }

        // Calcular diferença na banca
        const bankDifference =
          calculateBankUpdate(oldStatus, newStatus, betAmountForCalc, potentialReturnForCalc) +
          valueChangeAdjustment;

        // Se houve mudança que afeta a banca, atualizar
        if (bankDifference !== 0) {
          // Usar valor mais recente da banca para evitar inconsistência se múltiplas atualizações ocorrerem
          const updatedBank = bankSettings.totalBank + bankDifference;
          const newBankSettings: BankSettingsType = {
            ...bankSettings,
            totalBank: Math.max(0, Number(updatedBank.toFixed(2))), // Garantir 2 casas decimais e não negativa
            updatedAt: Date.now(),
          };
          await saveSettings(newBankSettings);
          showSuccess('Banca atualizada com sucesso!');
        }
      }

      // Atualizar resultAt quando status muda para won/lost
      if ((newStatus === 'won' || newStatus === 'lost') && !betInfo.resultAt) {
        betInfo.resultAt = Date.now();
      }
    }
  };

  const handleSaveBetInfo = async (betInfo: BetInfo) => {
    // Proteção contra múltiplos cliques simultâneos
    if (isUpdatingBetStatus) {
      return;
    }

    setIsUpdatingBetStatus(true);
    try {
      // Atualizar banca usando a nova função dedicada
      await updateBankFromBetChange(betInfo, selectedMatch?.betInfo);

      if (selectedMatch && currentMatchData && analysisResult) {
        const updatedMatch: SavedAnalysis = {
          ...selectedMatch,
          data: currentMatchData,
          result: analysisResult,
          betInfo,
          timestamp: Date.now(),
        };

        // Salvar usando o hook
        const savedMatch = await saveMatch(updatedMatch);
        // Garantir que o betInfo seja preservado no estado local mesmo se o retorno do banco for incompleto
        setSelectedMatch({ ...savedMatch, betInfo });
        showSuccess('Aposta atualizada com sucesso!');
      } else if (currentMatchData && analysisResult) {
        // Se não há partida salva ainda, cria uma nova e salva a aposta para garantir consistência com a banca.
        const newMatch: SavedAnalysis = {
          id: Math.random().toString(36).slice(2, 11),
          timestamp: Date.now(),
          data: currentMatchData,
          result: analysisResult,
          betInfo,
        };

        const saved = await saveMatch(newMatch);
        // Garantir que o betInfo seja preservado no estado local mesmo se o retorno do banco for incompleto
        setSelectedMatch({ ...saved, betInfo });
        showSuccess('Aposta registrada e análise salva!');
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        logger.error('Erro em handleSaveBetInfo:', err);
      }
      showError('Erro ao salvar aposta. Tente novamente.');
    } finally {
      setIsUpdatingBetStatus(false);
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
    
    // Fazer busca web automaticamente quando o modal abrir
    // A busca será feita pelo assistente usando a ferramenta web_search
    const { homeTeam, awayTeam, matchDate } = match.data;
    const searchQuery = `${homeTeam} vs ${awayTeam} ${matchDate || ''} resultado placar`.trim();
    
    try {
      // Fazer busca web usando a ferramenta web_search
      const searchResults = await web_search({ search_term: searchQuery });
      
      // Converter os resultados para o formato esperado pelo modal
      const formattedResults = (searchResults.results || []).map((result: any) => ({
        content: result.content || result.snippet || result.text || '',
        snippet: result.snippet || result.content || result.text || '',
        url: result.url || result.link || '',
      }));
      
      // Armazenar os resultados no estado para que o modal possa usá-los
      setWebSearchResults(formattedResults);
      console.log('[App] Resultados da busca armazenados:', formattedResults);
    } catch (error) {
      console.error('[App] Erro ao buscar informações:', error);
      showError(`Erro ao buscar na web: ${error instanceof Error ? error.message : String(error)}`);
    }
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
    <div className="min-h-screen pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-8">
      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        actions={commandActions}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} /> {/* Renderizar ToastContainer */}

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
              <span className="badge badge-outline badge-sm font-bold">v3.8.2 Elite Edition</span>
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
                bankSettings={bankSettings}
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
            <button onClick={handleCloseAnalysis} className="btn btn-sm btn-ghost gap-2">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <h2 className="text-lg md:text-xl font-black">
              {currentMatchData
                ? `${currentMatchData.homeTeam} vs ${currentMatchData.awayTeam}`
                : 'Nova Análise'}
            </h2>
          </div>
          <button onClick={handleCloseAnalysis} className="btn btn-sm btn-circle btn-ghost">
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
                    onBetSave={handleRequestBetSave}
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

      {/* Modal de Confirmação de Aposta */}
      {currentMatchData && (
        <BetConfirmationModal
          isOpen={showBetConfirmModal}
          onClose={handleCancelBetSave}
          onConfirm={handleConfirmBetSave}
          matchTitle={`${currentMatchData.homeTeam} vs ${currentMatchData.awayTeam}`}
          betAmount={betInfoToConfirm?.betAmount || 0}
          odd={betInfoToConfirm?.odd || 0}
          currency={bankSettings?.currency}
        />
      )}
    </div>
  );
};

export default App;
