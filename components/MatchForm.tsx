import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MatchData, Championship, TableRowGeral, TableRowComplement } from '../types';
import { validateMatchData } from '../utils/validation';
import { errorService } from '../services/errorService';
import { animations } from '../utils/animations';
import { useChampionships } from '../hooks/useChampionships';
import { syncTeamStatsFromTable, checkChampionshipTablesAvailability, ChampionshipTablesDiagnostic } from '../services/championshipService';
import { ExternalLink, AlertTriangle, CheckCircle, XCircle, Loader2, Info, Database } from 'lucide-react';
import FbrefExtractionModal from './FbrefExtractionModal';
import InfoIcon from './match-form/InfoIcon';
import { logger } from '../utils/logger';

interface SyncResult {
  homeTableData: TableRowGeral | null;
  awayTableData: TableRowGeral | null;
  competitionAvg?: number;
  homeComplementData?: TableRowComplement | null;
  awayComplementData?: TableRowComplement | null;
  competitionComplementAvg?: unknown;
}

interface SyncFeedback {
  status: 'success' | 'partial' | 'error';
  homeTeamFound: boolean;
  awayTeamFound: boolean;
  hasGeralTable: boolean;
  hasComplementTable: boolean;
  competitionAvg: number | null;
  homeXG: number | null;
  awayXG: number | null;
  homeGoalsPerGame: number | null;
  awayGoalsPerGame: number | null;
  homeConcededPerGame: number | null;
  awayConcededPerGame: number | null;
  homeMP: number | null;
  awayMP: number | null;
  tableFormat: 'completa' | 'basica' | null;
}

const parseNum = (v: unknown): number => {
  if (v == null) return 0;
  const raw = String(v).trim();
  if (!raw) return 0;
  return Number.parseFloat(raw.replace(/,/g, '')) || 0;
};

function extractSyncFeedback(result: SyncResult): SyncFeedback {
  const home = result.homeTableData;
  const away = result.awayTableData;
  const hasGeralTable = !!(home && away);
  const hasComplementTable = !!(result.homeComplementData && result.awayComplementData);

  const homeMP = hasGeralTable ? parseNum(home!['Home MP'] || home!.MP) : null;
  const awayMP = hasGeralTable ? parseNum(away!['Away MP'] || away!.MP) : null;

  const homeGF = hasGeralTable ? parseNum(home!['Home GF'] || home!.GF) : 0;
  const homeGA = hasGeralTable ? parseNum(home!['Home GA'] || home!.GA) : 0;
  const awayGF = hasGeralTable ? parseNum(away!['Away GF'] || away!.GF) : 0;
  const awayGA = hasGeralTable ? parseNum(away!['Away GA'] || away!.GA) : 0;

  const homeGoalsPerGame = homeMP && homeMP > 0 ? homeGF / homeMP : null;
  const awayGoalsPerGame = awayMP && awayMP > 0 ? awayGF / awayMP : null;
  const homeConcededPerGame = homeMP && homeMP > 0 ? homeGA / homeMP : null;
  const awayConcededPerGame = awayMP && awayMP > 0 ? awayGA / awayMP : null;

  let homeXG: number | null = null;
  let awayXG: number | null = null;
  if (hasGeralTable) {
    const hxg = parseNum(home!['Home xG'] || home!.xG);
    const axg = parseNum(away!['Away xG'] || away!.xG);
    homeXG = hxg > 0 ? hxg : null;
    awayXG = axg > 0 ? axg : null;
  }

  let tableFormat: 'completa' | 'basica' | null = null;
  if (hasGeralTable) {
    tableFormat = (homeXG != null && homeXG > 0) || (awayXG != null && awayXG > 0) ? 'completa' : 'basica';
  }

  return {
    status: hasGeralTable ? 'success' : 'error',
    homeTeamFound: !!home,
    awayTeamFound: !!away,
    hasGeralTable,
    hasComplementTable,
    competitionAvg: result.competitionAvg ?? null,
    homeXG,
    awayXG,
    homeGoalsPerGame,
    awayGoalsPerGame,
    homeConcededPerGame,
    awayConcededPerGame,
    homeMP,
    awayMP,
    tableFormat,
  };
}

function createMatchDataFromTables(
  data: MatchData,
  result: SyncResult
): Partial<MatchData> {
  const home = result.homeTableData;
  const away = result.awayTableData;
  if (!home || !away) return {};

  const homeMP = parseNum(home['Home MP'] || home.MP);
  const awayMP = parseNum(away['Away MP'] || away.MP);
  const homeGF = parseNum(home['Home GF'] || home.GF);
  const homeGA = parseNum(home['Home GA'] || home.GA);
  const awayGF = parseNum(away['Away GF'] || away.GF);
  const awayGA = parseNum(away['Away GA'] || away.GA);

  const homeXG = parseNum(home['Home xG'] || home.xG);
  const awayXG = parseNum(away['Away xG'] || away.xG);

  const updates: Partial<MatchData> = {};

  if (homeMP > 0) {
    updates.homeGoalsScoredAvg = homeGF / homeMP;
    updates.homeGoalsConcededAvg = homeGA / homeMP;
  }
  if (awayMP > 0) {
    updates.awayGoalsScoredAvg = awayGF / awayMP;
    updates.awayGoalsConcededAvg = awayGA / awayMP;
  }
  if (homeXG > 0) updates.homeXG = homeXG;
  if (awayXG > 0) updates.awayXG = awayXG;

  if (result.homeComplementData) {
    const hComp = result.homeComplementData;
    const poss = parseNum(hComp.Poss);
    if (poss > 0) updates.homeBTTSFreq = poss;
  }

  return updates;
}

interface MatchFormProps {
  onAnalyze: (data: MatchData) => void | Promise<void>;
  initialData?: MatchData | null;
  onError?: (message: string) => void;
}

// Função para criar MatchData vazio
const createEmptyMatchData = (): MatchData => ({
  homeTeam: '',
  awayTeam: '',
  homeGoalsScoredAvg: 0,
  homeGoalsConcededAvg: 0,
  awayGoalsScoredAvg: 0,
  awayGoalsConcededAvg: 0,
  homeXG: 0,
  awayXG: 0,
  homeShotsOnTarget: 0,
  awayShotsOnTarget: 0,
  homeBTTSFreq: 0,
  awayBTTSFreq: 0,
  homeCleanSheetFreq: 0,
  awayCleanSheetFreq: 0,
  h2hOver15Freq: 0,
  matchImportance: 0,
  keyAbsences: 'none',
  homeHistory: [],
  awayHistory: [],
});

const MatchForm: React.FC<MatchFormProps> = ({
  onAnalyze,
  initialData,
  onError,
}) => {
  const [formData, setFormData] = useState<MatchData>(initialData || createEmptyMatchData());
  const { championships, getSquads } = useChampionships();
  const [selectedChampionshipId, setSelectedChampionshipId] = useState<string>('');
  const [availableSquads, setAvailableSquads] = useState<string[]>([]);
  const [selectedHomeSquad, setSelectedHomeSquad] = useState<string>('');
  const [selectedAwaySquad, setSelectedAwaySquad] = useState<string>('');
  const [tablesDiagnostic, setTablesDiagnostic] = useState<ChampionshipTablesDiagnostic | null>(null);
  const [showFbrefModal, setShowFbrefModal] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<SyncFeedback | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData(createEmptyMatchData());
    }
  }, [initialData]);

  // Carregar Squads e verificar disponibilidade de tabelas quando campeonato for selecionado
  useEffect(() => {
    const loadSquads = async () => {
      if (selectedChampionshipId) {
        const squads = await getSquads(selectedChampionshipId, 'geral');
        setAvailableSquads(squads);
        
        // Verificar disponibilidade das tabelas
        const diagnostic = await checkChampionshipTablesAvailability(selectedChampionshipId);
        setTablesDiagnostic(diagnostic);
      } else {
        setAvailableSquads([]);
        setTablesDiagnostic(null);
      }
      setSyncFeedback(null);
    };
    loadSquads();
  }, [selectedChampionshipId, getSquads]);

  // Atualizar diagnóstico quando Squads são selecionados
  useEffect(() => {
    const updateDiagnostic = async () => {
      if (selectedChampionshipId && selectedHomeSquad && selectedAwaySquad) {
        const diagnostic = await checkChampionshipTablesAvailability(
          selectedChampionshipId,
          selectedHomeSquad,
          selectedAwaySquad
        );
        setTablesDiagnostic(diagnostic);
      }
    };
    updateDiagnostic();
  }, [selectedChampionshipId, selectedHomeSquad, selectedAwaySquad]);

  // Preencher nomes dos times e championshipId quando Squad for selecionado
  useEffect(() => {
    if (selectedHomeSquad) {
      setFormData((prev) => ({
        ...prev,
        homeTeam: selectedHomeSquad,
        championshipId: selectedChampionshipId || prev.championshipId,
      }));
    }
  }, [selectedHomeSquad, selectedChampionshipId]);

  useEffect(() => {
    if (selectedAwaySquad) {
      setFormData((prev) => ({
        ...prev,
        awayTeam: selectedAwaySquad,
        championshipId: selectedChampionshipId || prev.championshipId,
      }));
    }
  }, [selectedAwaySquad, selectedChampionshipId]);

  // Função para sincronizar dados da tabela (geral + complemento)
  const handleSyncWithTable = async () => {
    if (!selectedChampionshipId || !selectedHomeSquad || !selectedAwaySquad) {
      if (onError) {
        onError('Selecione o campeonato e ambas as equipes antes de sincronizar.');
      }
      return;
    }

    setSyncing(true);
    setSyncFeedback(null);

    try {
      const syncResult = await syncTeamStatsFromTable(
        selectedChampionshipId,
        selectedHomeSquad,
        selectedAwaySquad
      );

      const feedback = extractSyncFeedback(syncResult);
      setSyncFeedback(feedback);

      // Auto-preencher campos do MatchData a partir dos dados da tabela
      const tableUpdates = createMatchDataFromTables(formData, syncResult);

      setFormData((prev) => ({
        ...prev,
        ...tableUpdates,
        championshipId: selectedChampionshipId,
        homeTableData: syncResult.homeTableData || undefined,
        awayTableData: syncResult.awayTableData || undefined,
        homeComplementData: syncResult.homeComplementData || undefined,
        awayComplementData: syncResult.awayComplementData || undefined,
        competitionComplementAvg: syncResult.competitionComplementAvg || undefined,
        competitionAvg: syncResult.competitionAvg !== undefined ? syncResult.competitionAvg : prev.competitionAvg,
      }));

      logger.log('[MatchForm] Sincronização concluída:', {
        geral: feedback.hasGeralTable,
        complement: feedback.hasComplementTable,
        format: feedback.tableFormat,
        competitionAvg: feedback.competitionAvg,
        homeXG: feedback.homeXG,
        awayXG: feedback.awayXG,
      });

      // Atualizar diagnóstico após sincronização
      if (selectedChampionshipId) {
        const updatedDiagnostic = await checkChampionshipTablesAvailability(
          selectedChampionshipId,
          selectedHomeSquad,
          selectedAwaySquad
        );
        setTablesDiagnostic(updatedDiagnostic);
      }

      if (!feedback.hasGeralTable) {
        if (onError) {
          onError('Nenhuma tabela foi encontrada. Verifique se as equipes existem no campeonato e se as tabelas foram extraídas do fbref.com.');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao sincronizar';
      setSyncFeedback({
        status: 'error',
        homeTeamFound: false,
        awayTeamFound: false,
        hasGeralTable: false,
        hasComplementTable: false,
        competitionAvg: null,
        homeXG: null,
        awayXG: null,
        homeGoalsPerGame: null,
        awayGoalsPerGame: null,
        homeConcededPerGame: null,
        awayConcededPerGame: null,
        homeMP: null,
        awayMP: null,
        tableFormat: null,
      });
      if (onError) {
        onError(`Erro ao sincronizar com tabela: ${errorMessage}`);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'matchDate' || name === 'matchTime'
          ? value === ''
            ? undefined
            : value
          : isNaN(Number(value)) || name === 'homeTeam' || name === 'awayTeam'
            ? value
            : value === ''
              ? undefined
              : Number(value),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    try {
      // Validar dados antes de enviar
      const validatedData = validateMatchData(formData);
      
      // Log: verificar se a tabela geral foi preservada após validação
      logger.log('[MatchForm] Dados após validação (validateMatchData):', {
        tabela: {
          geral: !!(validatedData.homeTableData && validatedData.awayTableData),
        },
      });
      
      // onAnalyze agora é assíncrono e executa análise estatística + IA automaticamente
      await onAnalyze(validatedData);
    } catch (error) {
      // Mostrar erro de validação de forma amigável
      const errorMessage =
        error instanceof Error ? error.message : 'Erro de validação desconhecido';
      // Registrar erro no serviço centralizado
      errorService.logValidationError('MatchForm', formData, errorMessage);

      if (onError) {
        onError(`Erro ao validar dados: ${errorMessage}`);
      } else {
        logger.error(`Erro ao validar dados: ${errorMessage}`);
      }
    }
  };

  return (
    <>
    <motion.form
      onSubmit={handleSubmit}
      className="relative overflow-hidden rounded-2xl border border-base-300/50 bg-base-200/80 p-4 md:p-6 lg:p-8 flex flex-col gap-4 md:gap-6 border-l-4 border-l-primary/60"
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
    >
      <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-secondary/5 blur-3xl pointer-events-none" />
      {/* Seleção de Campeonato e Squad */}
      <div className="relative overflow-hidden rounded-xl border border-l-4 border-l-accent/40 border-base-300/30 bg-base-300/20 p-4">
        <div className="absolute -top-12 -right-12 h-28 w-28 rounded-full bg-accent/6 blur-3xl pointer-events-none" />
        <h3 className="text-xs font-black uppercase tracking-wider text-accent mb-4 relative z-10">
          <span className="text-gradient">Campeonato e Equipes</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-bold">Campeonato</span>
            </label>
            <select
              value={selectedChampionshipId}
              onChange={(e) => {
                setSelectedChampionshipId(e.target.value);
                setSelectedHomeSquad('');
                setSelectedAwaySquad('');
              }}
              className="select select-bordered w-full"
            >
              <option value="">Selecione um campeonato</option>
              {championships.map((championship) => (
                <option key={championship.id} value={championship.id}>
                  {championship.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-bold">Time Casa (Squad)</span>
            </label>
            <select
              value={selectedHomeSquad}
              onChange={(e) => setSelectedHomeSquad(e.target.value)}
              className="select select-bordered w-full"
              disabled={!selectedChampionshipId || availableSquads.length === 0}
            >
              <option value="">Selecione o Squad</option>
              {availableSquads.map((squad) => (
                <option key={squad} value={squad}>
                  {squad}
                </option>
              ))}
            </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-bold">Time Visitante (Squad)</span>
            </label>
            <select
              value={selectedAwaySquad}
              onChange={(e) => setSelectedAwaySquad(e.target.value)}
              className="select select-bordered w-full"
              disabled={!selectedChampionshipId || availableSquads.length === 0}
            >
              <option value="">Selecione o Squad</option>
              {availableSquads.map((squad) => (
                <option key={squad} value={squad}>
                  {squad}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSyncWithTable}
              disabled={!selectedChampionshipId || !selectedHomeSquad || !selectedAwaySquad || syncing}
              className="btn btn-primary w-full md:w-auto gap-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <><Database className="w-4 h-4" /> Sincronizar com Tabela</>
              )}
            </button>
            {selectedChampionshipId && tablesDiagnostic && !tablesDiagnostic.tables.geral?.exists && (
              <button
                type="button"
                onClick={() => setShowFbrefModal(true)}
                className="btn btn-outline btn-warning w-full md:w-auto gap-2 hover:scale-105 transition-transform"
              >
                <ExternalLink className="w-4 h-4" />
                Extrair Tabelas do FBref.com
              </button>
            )}
          </div>

          {/* Aviso Preventivo: Mostrar antes de sincronizar se tabela geral não existe */}
          {selectedChampionshipId && tablesDiagnostic && !tablesDiagnostic.tables.geral?.exists && (
            <div className="mt-4 surface overflow-hidden border-l-warning/60" style={{ borderLeftWidth: 4 }}>
              <div className="flex items-start gap-3 p-3">
                <AlertTriangle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-warning font-semibold text-sm mb-1">
                    Tabela geral não extraída
                  </p>
                  <p className="text-warning/70 text-xs mb-2 leading-relaxed">
                    Extraia a tabela geral do fbref.com primeiro para uma análise completa.
                  </p>
                  {tablesDiagnostic.missingTables.includes('geral') && (
                    <div className="flex items-center gap-2 text-xs text-base-content/60">
                      <XCircle className="w-3 h-3" />
                      <span><strong>geral</strong>: Não foi extraída ainda</span>
                    </div>
                  )}
                  {tablesDiagnostic.emptyTables.includes('geral') && (
                    <div className="flex items-center gap-2 text-xs text-base-content/60">
                      <AlertTriangle className="w-3 h-3" />
                      <span><strong>geral</strong>: Está vazia (extraia novamente)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Feedback detalhado da sincronização */}
          {syncFeedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`relative overflow-hidden rounded-xl border border-l-4 ${
                syncFeedback.status === 'success'
                  ? 'border-l-success/60 border-base-300/40 bg-base-300/20'
                  : syncFeedback.status === 'partial'
                    ? 'border-l-warning/60 border-base-300/40 bg-base-300/20'
                    : 'border-l-error/60 border-base-300/40 bg-base-300/20'
              }`}
            >
              <div className="absolute -top-12 -right-12 h-28 w-28 rounded-full bg-success/6 blur-3xl pointer-events-none" />
              <div className="font-semibold text-sm px-4 pt-3 pb-2 flex items-center gap-2 border-b border-base-content/5">
                {syncFeedback.status === 'success' && <CheckCircle className="w-4 h-4 text-success" />}
                {syncFeedback.status === 'partial' && <AlertTriangle className="w-4 h-4 text-warning" />}
                {syncFeedback.status === 'error' && <XCircle className="w-4 h-4 text-error" />}
                <span>Resultado da Sincronização</span>
                {/* Contador compacto */}
                <span className="ml-auto text-[10px] text-base-content/40 font-normal">
                  {[syncFeedback.hasGeralTable, syncFeedback.hasComplementTable, !!syncFeedback.competitionAvg, syncFeedback.hasGeralTable].filter(Boolean).length}/4
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 text-xs">
                {/* Tabela Geral */}
                <div className={`flex items-start gap-2 p-2 rounded-lg ${syncFeedback.hasGeralTable ? 'bg-success/8' : 'bg-error/8'}`}>
                  {syncFeedback.hasGeralTable ? (
                    <CheckCircle className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-error mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-medium">Tabela Geral</span>
                      {syncFeedback.tableFormat && (
                        <span className={`badge badge-xs ${syncFeedback.tableFormat === 'completa' ? 'badge-success' : 'badge-warning'}`}>
                          {syncFeedback.tableFormat}
                        </span>
                      )}
                    </div>
                    {syncFeedback.hasGeralTable && (
                      <div className="text-base-content/60 leading-snug">
                        <div>{selectedHomeSquad}: {syncFeedback.homeMP} jogos</div>
                        <div>{selectedAwaySquad}: {syncFeedback.awayMP} jogos</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabela Complemento */}
                <div className={`flex items-start gap-2 p-2 rounded-lg ${syncFeedback.hasComplementTable ? 'bg-success/8' : 'bg-base-300/40'}`}>
                  {syncFeedback.hasComplementTable ? (
                    <CheckCircle className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                  ) : (
                    <Info className="w-3.5 h-3.5 text-base-content/30 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">Tabela Complemento</span>
                    <div className="text-base-content/60 mt-0.5">
                      {syncFeedback.hasComplementTable ? 'Posse, Performance, Per 90' : 'Não disponível'}
                    </div>
                  </div>
                </div>

                {/* Média da Competição */}
                <div className={`flex items-start gap-2 p-2 rounded-lg ${syncFeedback.competitionAvg ? 'bg-primary/8' : 'bg-base-300/40'}`}>
                  {syncFeedback.competitionAvg ? (
                    <CheckCircle className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  ) : (
                    <Info className="w-3.5 h-3.5 text-base-content/30 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">Média da Competição</span>
                    <div className="text-base font-bold mt-0.5">
                      {syncFeedback.competitionAvg ? `${syncFeedback.competitionAvg.toFixed(2)} gols/jogo` : '—'}
                    </div>
                  </div>
                </div>

                {/* Métricas Extraídas */}
                {syncFeedback.hasGeralTable && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-base-300/40">
                    <div className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">Métricas Extraídas</span>
                      <div className="text-base-content/60 mt-0.5 space-y-0.5">
                        <div className="flex justify-between">
                          <span>xG:</span>
                          <span className="font-medium tabular-nums">
                            {syncFeedback.homeXG != null ? syncFeedback.homeXG.toFixed(2) : '—'} /{' '}
                            {syncFeedback.awayXG != null ? syncFeedback.awayXG.toFixed(2) : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Gols/jogo:</span>
                          <span className="font-medium tabular-nums">
                            {syncFeedback.homeGoalsPerGame != null ? syncFeedback.homeGoalsPerGame.toFixed(2) : '—'} /{' '}
                            {syncFeedback.awayGoalsPerGame != null ? syncFeedback.awayGoalsPerGame.toFixed(2) : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Sofridos/jogo:</span>
                          <span className="font-medium tabular-nums">
                            {syncFeedback.homeConcededPerGame != null ? syncFeedback.homeConcededPerGame.toFixed(2) : '—'} /{' '}
                            {syncFeedback.awayConcededPerGame != null ? syncFeedback.awayConcededPerGame.toFixed(2) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Resumo de impacto na análise */}
              <div className="mx-3 mb-3">
                {syncFeedback.hasGeralTable && syncFeedback.hasComplementTable && (
                  <div className="flex items-center gap-2 p-2 bg-success/8 border border-success/15 rounded-lg text-success text-xs font-medium">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Máxima precisão disponível (tabela geral + complemento + xG).</span>
                  </div>
                )}
                {syncFeedback.hasGeralTable && !syncFeedback.hasComplementTable && syncFeedback.tableFormat === 'completa' && (
                  <div className="flex items-center gap-2 p-2 bg-success/8 border border-success/15 rounded-lg text-success text-xs font-medium">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Tabela geral com xG carregada. Análise precisa.</span>
                  </div>
                )}
                {syncFeedback.hasGeralTable && !syncFeedback.hasComplementTable && syncFeedback.tableFormat === 'basica' && (
                  <div className="flex items-center gap-2 p-2 bg-warning/8 border border-warning/15 rounded-lg text-warning text-xs font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Formato básico (sem xG). A análise usará gols reais (GF/GA). Adicione a tabela de complemento para maior precisão.</span>
                  </div>
                )}
                {!syncFeedback.hasGeralTable && (
                  <div className="flex items-center gap-2 p-2 bg-error/8 border border-error/15 rounded-lg text-error text-xs font-medium">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>Tabela geral não encontrada. Extraia as tabelas do fbref.com primeiro.</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control">
          <label className="label ml-2 flex items-center">
            <span className="label-text font-bold">Data da Partida</span>
            <InfoIcon text="Data em que a partida será realizada." />
          </label>
        <input
          type="date"
          name="matchDate"
          value={formData.matchDate || ''}
          onChange={handleChange}
          className="input w-full min-h-[44px] text-base"
          aria-label="Data da partida"
        />
        </div>
        <div className="form-control">
          <label className="label ml-2 flex items-center">
            <span className="label-text font-bold">Hora da Partida</span>
            <InfoIcon text="Horário de início da partida (formato 24h)." />
          </label>
          <input
            type="time"
            name="matchTime"
            value={formData.matchTime || ''}
            onChange={handleChange}
            className="input w-full min-h-[44px] text-base"
            aria-label="Hora da partida"
          />
        </div>
      </div>

      {/* Competição (Média) - Auto-preenchida pelo sync */}
      <div className="form-control">
        <label className="label ml-2 flex items-center">
          <span className="label-text font-bold">
            Competição (Média)
            {formData.competitionAvg && formData.competitionAvg > 0 && (
              <span className="badge badge-success badge-sm ml-2">auto</span>
            )}
          </span>
          <InfoIcon text="Média de gols por jogo da competição. Calculada automaticamente ao sincronizar com a tabela." />
        </label>
        <input
          type="number"
          step="0.01"
          name="competitionAvg"
          value={formData.competitionAvg || ''}
          onChange={handleChange}
          className="input w-full"
          placeholder="Calculada ao sincronizar (ex: 2.65)"
          aria-label="Média de gols por jogo da competição"
        />
        {formData.competitionAvg && formData.competitionAvg > 0 && (
          <label className="label">
            <span className="label-text-alt text-success text-xs">
              {formData.competitionAvg.toFixed(2)} gols por jogo
            </span>
          </label>
        )}
      </div>

      {/* Odd Over 1.5 */}
      <div className="form-control">
        <label className="label ml-2 flex items-center">
          <span className="label-text font-bold">Odd</span>
          <InfoIcon text="Insira a odd atual do mercado Over 1.5 para calcular o EV (Valor Esperado)." />
        </label>
        <input
          type="number"
          step="0.01"
          name="oddOver15"
          value={formData.oddOver15 || ''}
          onChange={handleChange}
          className="input w-full"
          placeholder="Ex: 1.50"
          aria-label="Odd do mercado Over 1.5"
        />
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-lg mt-2 uppercase font-black tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all min-h-[44px] text-base md:text-lg w-full sm:w-auto"
      >
        Processar
      </button>
    </motion.form>

    {/* Modal de Extração do FBref.com */}
    {showFbrefModal && selectedChampionshipId && (() => {
      const championship = championships.find(c => c.id === selectedChampionshipId);
      if (!championship) return null;
      
      return (
        <FbrefExtractionModal
          championship={championship}
          onClose={() => {
            setShowFbrefModal(false);
            // Atualizar diagnóstico após fechar o modal (caso tabelas tenham sido salvas)
            if (selectedChampionshipId) {
              checkChampionshipTablesAvailability(
                selectedChampionshipId,
                selectedHomeSquad,
                selectedAwaySquad
              ).then(setTablesDiagnostic);
            }
          }}
          onTableSaved={async () => {
            // Atualizar diagnóstico após salvar tabelas
            if (selectedChampionshipId) {
              const updatedDiagnostic = await checkChampionshipTablesAvailability(
                selectedChampionshipId,
                selectedHomeSquad,
                selectedAwaySquad
              );
              setTablesDiagnostic(updatedDiagnostic);
              
              // Tentar sincronizar automaticamente se times já estiverem selecionados
              if (selectedHomeSquad && selectedAwaySquad) {
                setTimeout(() => {
                  handleSyncWithTable();
                }, 500);
              }
            }
          }}
          onError={(message) => {
            if (onError) {
              onError(message);
            }
          }}
        />
      );
    })()}
    </>
  );
};

export default MatchForm;
