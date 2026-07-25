import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MatchData, Championship, TableRowGeral, TableRowComplement } from '../types';
import { validateMatchData } from '../utils/validation';
import { errorService } from '../services/errorService';
import { animations } from '../utils/animations';
import { useChampionships } from '../hooks/useChampionships';
import { syncTeamStatsFromTable, checkChampionshipTablesAvailability, ChampionshipTablesDiagnostic } from '../services/championshipService';
import { ExternalLink, AlertTriangle, CheckCircle, XCircle, Loader2, Info } from 'lucide-react';
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
      className="custom-card p-4 md:p-6 lg:p-8 flex flex-col gap-4 md:gap-6"
      variants={animations.fadeInUp}
      initial="initial"
      animate="animate"
    >
      {/* Seleção de Campeonato e Squad */}
      <div className="bg-primary/5 p-4 rounded-3xl border border-primary/10">
        <h3 className="text-lg font-bold mb-4">Campeonato e Equipes</h3>
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
              className="btn btn-primary w-full md:w-auto gap-2"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                'Sincronizar com Tabela'
              )}
            </button>
            {selectedChampionshipId && tablesDiagnostic && !tablesDiagnostic.tables.geral?.exists && (
              <button
                type="button"
                onClick={() => setShowFbrefModal(true)}
                className="btn btn-outline btn-warning w-full md:w-auto gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Extrair Tabelas do FBref.com
              </button>
            )}
          </div>

          {/* Aviso Preventivo: Mostrar antes de sincronizar se tabela geral não existe */}
          {selectedChampionshipId && tablesDiagnostic && !tablesDiagnostic.tables.geral?.exists && (
            <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-warning font-semibold text-sm mb-1">
                    A tabela geral não foi extraída ainda
                  </p>
                  <p className="text-warning text-xs mb-2">
                    Para análise completa, extraia a tabela geral do fbref.com primeiro.
                  </p>
                  {tablesDiagnostic.missingTables.includes('geral') && (
                    <div className="text-xs opacity-80">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-3 h-3" />
                        <span>
                          <strong>geral</strong>: Não foi extraída ainda
                        </span>
                      </div>
                    </div>
                  )}
                  {tablesDiagnostic.emptyTables.includes('geral') && (
                    <div className="text-xs opacity-80">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3" />
                        <span>
                          <strong>geral</strong>: Está vazia (extraia novamente)
                        </span>
                      </div>
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
              className={`mt-4 p-4 rounded-xl border ${
                syncFeedback.status === 'success'
                  ? 'bg-success/5 border-success/20'
                  : syncFeedback.status === 'partial'
                    ? 'bg-warning/5 border-warning/20'
                    : 'bg-error/5 border-error/20'
              }`}
            >
              <div className="font-semibold text-sm mb-3 flex items-center gap-2">
                {syncFeedback.status === 'success' && <CheckCircle className="w-4 h-4 text-success" />}
                {syncFeedback.status === 'partial' && <AlertTriangle className="w-4 h-4 text-warning" />}
                {syncFeedback.status === 'error' && <XCircle className="w-4 h-4 text-error" />}
                <span>Resultado da Sincronização</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Tabela Geral */}
                <div className={`p-2 rounded-lg ${syncFeedback.hasGeralTable ? 'bg-success/10' : 'bg-error/10'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {syncFeedback.hasGeralTable ? (
                      <CheckCircle className="w-3 h-3 text-success" />
                    ) : (
                      <XCircle className="w-3 h-3 text-error" />
                    )}
                    <span className="font-medium">Tabela Geral</span>
                    {syncFeedback.tableFormat && (
                      <span className={`badge badge-xs ${syncFeedback.tableFormat === 'completa' ? 'badge-success' : 'badge-warning'}`}>
                        {syncFeedback.tableFormat}
                      </span>
                    )}
                  </div>
                  {syncFeedback.hasGeralTable && (
                    <div className="ml-5 space-y-0.5 opacity-80">
                      <div>{selectedHomeSquad}: {syncFeedback.homeMP} jogos</div>
                      <div>{selectedAwaySquad}: {syncFeedback.awayMP} jogos</div>
                    </div>
                  )}
                </div>

                {/* Tabela Complemento */}
                <div className={`p-2 rounded-lg ${syncFeedback.hasComplementTable ? 'bg-success/10' : 'bg-base-300/50'}`}>
                  <div className="flex items-center gap-2">
                    {syncFeedback.hasComplementTable ? (
                      <CheckCircle className="w-3 h-3 text-success" />
                    ) : (
                      <Info className="w-3 h-3 opacity-40" />
                    )}
                    <span className="font-medium">Tabela Complemento</span>
                  </div>
                  <div className="ml-5 mt-1 opacity-70">
                    {syncFeedback.hasComplementTable ? 'Posse, Performance, Per 90' : 'Não disponível'}
                  </div>
                </div>

                {/* Média da Competição */}
                <div className={`p-2 rounded-lg ${syncFeedback.competitionAvg ? 'bg-primary/10' : 'bg-base-300/50'}`}>
                  <div className="font-medium mb-1">Média da Competição</div>
                  <div className="ml-1 text-lg font-bold">
                    {syncFeedback.competitionAvg ? `${syncFeedback.competitionAvg.toFixed(2)} gols/jogo` : '—'}
                  </div>
                </div>

                {/* Métricas Extraídas */}
                {syncFeedback.hasGeralTable && (
                  <div className="p-2 rounded-lg bg-base-300/50">
                    <div className="font-medium mb-1">Métricas Extraídas</div>
                    <div className="ml-1 space-y-0.5">
                      <div>
                        <span className="opacity-70">xG:</span>{' '}
                        {syncFeedback.homeXG != null ? syncFeedback.homeXG.toFixed(2) : '—'} /{' '}
                        {syncFeedback.awayXG != null ? syncFeedback.awayXG.toFixed(2) : '—'}
                      </div>
                      <div>
                        <span className="opacity-70">Gols/jogo:</span>{' '}
                        {syncFeedback.homeGoalsPerGame != null ? syncFeedback.homeGoalsPerGame.toFixed(2) : '—'} /{' '}
                        {syncFeedback.awayGoalsPerGame != null ? syncFeedback.awayGoalsPerGame.toFixed(2) : '—'}
                      </div>
                      <div>
                        <span className="opacity-70">Sofridos/jogo:</span>{' '}
                        {syncFeedback.homeConcededPerGame != null ? syncFeedback.homeConcededPerGame.toFixed(2) : '—'} /{' '}
                        {syncFeedback.awayConcededPerGame != null ? syncFeedback.awayConcededPerGame.toFixed(2) : '—'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Resumo de impacto na análise */}
              <div className="mt-3 pt-3 border-t border-base-content/10">
                {syncFeedback.hasGeralTable && syncFeedback.hasComplementTable && (
                  <div className="p-2 bg-success/10 border border-success/20 rounded text-success text-xs font-medium">
                    ✅ Análise com máxima precisão disponível (tabela geral + complemento + xG).
                  </div>
                )}
                {syncFeedback.hasGeralTable && !syncFeedback.hasComplementTable && syncFeedback.tableFormat === 'completa' && (
                  <div className="p-2 bg-success/10 border border-success/20 rounded text-success text-xs font-medium">
                    ✅ Tabela geral com xG carregada. Análise precisa.
                  </div>
                )}
                {syncFeedback.hasGeralTable && !syncFeedback.hasComplementTable && syncFeedback.tableFormat === 'basica' && (
                  <div className="p-2 bg-warning/10 border border-warning/20 rounded text-warning text-xs font-medium">
                    ⚠️ Formato básico (sem xG). A análise usará gols reais (GF/GA). Adicione a tabela de complemento para maior precisão.
                  </div>
                )}
                {!syncFeedback.hasGeralTable && (
                  <div className="p-2 bg-error/10 border border-error/20 rounded text-error text-xs font-medium">
                    ❌ Tabela geral não encontrada. Extraia as tabelas do fbref.com primeiro.
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
        className="btn btn-primary btn-lg mt-4 uppercase font-black tracking-widest shadow-2xl hover:scale-[1.01] active:scale-95 transition-all min-h-[44px] text-base md:text-lg w-full sm:w-auto"
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
