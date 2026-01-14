import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MatchData, TeamStatistics, GolsStats, Championship, TableRowGeral } from '../types';
import { validateMatchData } from '../utils/validation';
import { errorService } from '../services/errorService';
import { animations } from '../utils/animations';
import { useChampionships } from '../hooks/useChampionships';
import { syncTeamStatsFromTable, checkChampionshipTablesAvailability, ChampionshipTablesDiagnostic } from '../services/championshipService';
import { ExternalLink, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import FbrefExtractionModal from './FbrefExtractionModal';

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

const createEmptyGols = (): GolsStats => ({
  avgScored: 0,
  avgConceded: 0,
  avgTotal: 0,
  cleanSheetPct: 0,
  noGoalsPct: 0,
  over25Pct: 0,
  under25Pct: 0,
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

  // Função para sincronizar dados da tabela
  // IMPORTANTE: Esta função apenas preenche dados da tabela (homeTableData/awayTableData) para análise da IA.
  // NÃO afeta as Estatísticas Globais (homeTeamStats/awayTeamStats), que são inseridas manualmente.
  const handleSyncWithTable = async () => {
    if (!selectedChampionshipId || !selectedHomeSquad || !selectedAwaySquad) {
      if (onError) {
        onError('Selecione o campeonato e ambas as equipes antes de sincronizar.');
      }
      return;
    }

    try {
      const {
        homeTableData,
        awayTableData,
        competitionAvg,
        homeStandardForData,
        awayStandardForData,
        competitionStandardForAvg,
        homePassingForData,
        awayPassingForData,
        competitionPassingForAvg,
        homeGcaForData,
        awayGcaForData,
        competitionGcaForAvg,
      } = await syncTeamStatsFromTable(
        selectedChampionshipId,
        selectedHomeSquad,
        selectedAwaySquad
      );

      // Validação: Verificar que Estatísticas Globais não serão afetadas
      const previousHomeStats = formData.homeTeamStats;
      const previousAwayStats = formData.awayTeamStats;

      if (import.meta.env.DEV) {
        console.log('[MatchForm] Sincronização concluída:', {
          homeTableData: !!homeTableData,
          awayTableData: !!awayTableData,
          competitionAvg,
          homeStandardForData: !!homeStandardForData,
          awayStandardForData: !!awayStandardForData,
          competitionStandardForAvg: !!competitionStandardForAvg,
          homePassingForData: !!homePassingForData,
          awayPassingForData: !!awayPassingForData,
          competitionPassingForAvg: !!competitionPassingForAvg,
          homeGcaForData: !!homeGcaForData,
          awayGcaForData: !!awayGcaForData,
          competitionGcaForAvg: !!competitionGcaForAvg,
          hasPreviousHomeStats: !!previousHomeStats,
          hasPreviousAwayStats: !!previousAwayStats,
          // Nota: homeTeamStats/awayTeamStats não são afetados pela sincronização
        });
      }

      // Apenas preencher dados da tabela e média da competição
      // NÃO modificar homeTeamStats/awayTeamStats (Estatísticas Globais são manuais)
      setFormData((prev) => {
        const updated = {
          ...prev,
          championshipId: selectedChampionshipId,
          homeTableData: homeTableData || undefined,
          awayTableData: awayTableData || undefined,
          homeStandardForData: homeStandardForData || undefined,
          awayStandardForData: awayStandardForData || undefined,
          competitionStandardForAvg: competitionStandardForAvg || undefined,
          homePassingForData: homePassingForData || undefined,
          awayPassingForData: awayPassingForData || undefined,
          competitionPassingForAvg: competitionPassingForAvg || undefined,
          homeGcaForData: homeGcaForData || undefined,
          awayGcaForData: awayGcaForData || undefined,
          competitionGcaForAvg: competitionGcaForAvg || undefined,
          // Preencher automaticamente a média da competição calculada da tabela
          competitionAvg: competitionAvg !== undefined ? competitionAvg : prev.competitionAvg,
          // homeTeamStats e awayTeamStats permanecem inalterados (inseridos manualmente)
        };

        // Validação: Garantir que Estatísticas Globais não foram alteradas
        if (import.meta.env.DEV) {
          if (updated.homeTeamStats !== previousHomeStats || updated.awayTeamStats !== previousAwayStats) {
            console.warn('[MatchForm] ATENÇÃO: Estatísticas Globais foram alteradas durante sincronização!', {
              homeStatsChanged: updated.homeTeamStats !== previousHomeStats,
              awayStatsChanged: updated.awayTeamStats !== previousAwayStats,
            });
          }
        }

        return updated;
      });

      // Verificar quais tabelas foram carregadas
      const loadedTables = {
        geral: !!(homeTableData && awayTableData),
        standard_for: !!(homeStandardForData && awayStandardForData && competitionStandardForAvg),
        passing_for: !!(homePassingForData && awayPassingForData && competitionPassingForAvg),
        gca_for: !!(homeGcaForData && awayGcaForData && competitionGcaForAvg),
      };

      const loadedCount = Object.values(loadedTables).filter(Boolean).length;
      const missingTables = Object.entries(loadedTables)
        .filter(([, loaded]) => !loaded)
        .map(([name]) => name);

      // Log detalhado para diagnóstico
      if (import.meta.env.DEV) {
        console.log('[MatchForm] Resultado da sincronização:', {
          loadedTables,
          loadedCount,
          missingTables,
          detalhes: {
            geral: {
              home: !!homeTableData,
              away: !!awayTableData,
            },
            standard_for: {
              home: !!homeStandardForData,
              away: !!awayStandardForData,
              competitionAvg: !!competitionStandardForAvg,
            },
            passing_for: {
              home: !!homePassingForData,
              away: !!awayPassingForData,
              competitionAvg: !!competitionPassingForAvg,
            },
            gca_for: {
              home: !!homeGcaForData,
              away: !!awayGcaForData,
              competitionAvg: !!competitionGcaForAvg,
            },
          },
        });
      }

      // Atualizar diagnóstico após sincronização
      if (selectedChampionshipId) {
        const updatedDiagnostic = await checkChampionshipTablesAvailability(
          selectedChampionshipId,
          selectedHomeSquad,
          selectedAwaySquad
        );
        setTablesDiagnostic(updatedDiagnostic);
      }

      // Mostrar feedback sobre tabelas carregadas
      if (loadedCount === 4) {
        // Todas as tabelas carregadas - sucesso silencioso
        if (import.meta.env.DEV) {
          console.log('[MatchForm] ✅ Todas as 4 tabelas carregadas com sucesso!');
        }
      } else if (loadedCount > 0) {
        // Algumas tabelas carregadas - avisar sobre as faltantes
        // NÃO mostrar erro, apenas aviso informativo (não é um erro crítico)
        if (import.meta.env.DEV) {
          console.warn('[MatchForm] ⚠️ Apenas', loadedCount, 'de 4 tabelas foram carregadas. Faltando:', missingTables.join(', '));
        }
      } else {
        // Nenhuma tabela carregada
        if (onError) {
          onError('Nenhuma tabela foi encontrada. Verifique se as equipes existem no campeonato e se as tabelas foram extraídas do fbref.com.');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao sincronizar';
      if (onError) {
        onError(`Erro ao sincronizar com tabela: ${errorMessage}`);
      }
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

  // Função para atualizar estatísticas de gols (home para time da casa, away para visitante)
  const updateTeamStats = (
    team: 'home' | 'away',
    field: keyof GolsStats,
    value: number | undefined
  ) => {
    setFormData((prev) => {
      const teamKey = team === 'home' ? 'homeTeamStats' : 'awayTeamStats';
      const statsKey = team === 'home' ? 'home' : 'away'; // Usar 'home' para time da casa, 'away' para visitante
      const currentStats = prev[teamKey] || {
        percurso: {
          home: {
            winStreak: 0,
            drawStreak: 0,
            lossStreak: 0,
            withoutWin: 0,
            withoutDraw: 0,
            withoutLoss: 0,
          },
          away: {
            winStreak: 0,
            drawStreak: 0,
            lossStreak: 0,
            withoutWin: 0,
            withoutDraw: 0,
            withoutLoss: 0,
          },
          global: {
            winStreak: 0,
            drawStreak: 0,
            lossStreak: 0,
            withoutWin: 0,
            withoutDraw: 0,
            withoutLoss: 0,
          },
        },
        gols: { home: createEmptyGols(), away: createEmptyGols(), global: createEmptyGols() },
      };

      const newStats: TeamStatistics = {
        ...currentStats,
        gols: {
          ...currentStats.gols,
          [statsKey]: {
            ...currentStats.gols[statsKey],
            [field]: value === '' ? 0 : (value ?? 0),
          },
        },
      };

      return {
        ...prev,
        [teamKey]: newStats,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validar dados antes de enviar
      const validatedData = validateMatchData(formData);
      
      // Log: verificar se todas as 4 tabelas foram preservadas após validação
      if (import.meta.env.DEV) {
        console.log('[MatchForm] Dados após validação (validateMatchData):', {
          tabelas: {
            geral: !!(validatedData.homeTableData && validatedData.awayTableData),
            standard_for: !!(validatedData.homeStandardForData && validatedData.awayStandardForData && validatedData.competitionStandardForAvg),
            passing_for: !!(validatedData.homePassingForData && validatedData.awayPassingForData && validatedData.competitionPassingForAvg),
            gca_for: !!(validatedData.homeGcaForData && validatedData.awayGcaForData && validatedData.competitionGcaForAvg),
          },
        });
      }
      
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
        alert(`Erro ao validar dados: ${errorMessage}`);
      }
    }
  };

  const InfoIcon = ({ text }: { text: string }) => (
    <div className="tooltip tooltip-top cursor-help ml-1" data-tip={text} role="tooltip">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-4 h-4 opacity-50 hover:opacity-100 transition-opacity"
        aria-label={text}
        role="img"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
        />
      </svg>
    </div>
  );

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
              disabled={!selectedChampionshipId || !selectedHomeSquad || !selectedAwaySquad}
              className="btn btn-primary w-full md:w-auto"
            >
              Sincronizar com Tabela
            </button>
            {selectedChampionshipId && tablesDiagnostic && !tablesDiagnostic.allTablesExist && (
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

          {/* Aviso Preventivo: Mostrar antes de sincronizar se tabelas não existem */}
          {selectedChampionshipId && tablesDiagnostic && !tablesDiagnostic.allTablesExist && (
            <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-warning font-semibold text-sm mb-1">
                    Algumas tabelas não foram extraídas ainda
                  </p>
                  <p className="text-warning text-xs mb-2">
                    Para análise completa, extraia todas as 4 tabelas do fbref.com primeiro.
                  </p>
                  <div className="text-xs opacity-80 space-y-1">
                    {tablesDiagnostic.missingTables.map((tableType) => {
                      const info = tablesDiagnostic.tables[tableType];
                      return (
                        <div key={tableType} className="flex items-center gap-2">
                          <XCircle className="w-3 h-3" />
                          <span>
                            <strong>{tableType}</strong>: Não foi extraída ainda
                          </span>
                        </div>
                      );
                    })}
                    {tablesDiagnostic.emptyTables.map((tableType) => {
                      const info = tablesDiagnostic.tables[tableType];
                      return (
                        <div key={tableType} className="flex items-center gap-2">
                          <AlertTriangle className="w-3 h-3" />
                          <span>
                            <strong>{tableType}</strong>: Está vazia (extraia novamente)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status das Tabelas Sincronizadas: Mostrar após sincronização */}
          {formData.homeTableData && formData.awayTableData && (
            <div className="mt-4 p-4 bg-base-300/50 rounded-lg border border-base-content/10 space-y-3">
              <div className="font-semibold text-sm mb-2">Status das Tabelas Sincronizadas:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {(['geral', 'standard_for', 'passing_for', 'gca_for'] as const).map((tableType) => {
                  const hasTable = (() => {
                    switch (tableType) {
                      case 'geral':
                        return !!(formData.homeTableData && formData.awayTableData);
                      case 'standard_for':
                        return !!(formData.homeStandardForData && formData.awayStandardForData && formData.competitionStandardForAvg);
                      case 'passing_for':
                        return !!(formData.homePassingForData && formData.awayPassingForData && formData.competitionPassingForAvg);
                      case 'gca_for':
                        return !!(formData.homeGcaForData && formData.awayGcaForData && formData.competitionGcaForAvg);
                    }
                  })();

                  const tableInfo = tablesDiagnostic?.tables[tableType];
                  const squadIssue = tableInfo?.squadFound && (!tableInfo.squadFound.home || !tableInfo.squadFound.away);

                  const getTableLabel = () => {
                    switch (tableType) {
                      case 'geral':
                        return { name: 'Geral', impact: '(Alto impacto - base para cálculo)' };
                      case 'standard_for':
                        return { name: 'Standard For', impact: '(Médio-Alto - ajuste ataque/ritmo ±8%)' };
                      case 'passing_for':
                        return { name: 'Passing For', impact: '(Médio - criação via passe ±8%)' };
                      case 'gca_for':
                        return { name: 'GCA For', impact: '(Médio-Alto - ações de criação ±10%)' };
                    }
                  };

                  const label = getTableLabel();

                  return (
                    <div key={tableType} className="flex items-center gap-2">
                      {hasTable ? (
                        <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-warning flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{label.name}</span>
                        <span className="opacity-60 ml-1">{label.impact}</span>
                        {squadIssue && (
                          <div className="text-warning text-xs mt-1">
                            {!tableInfo.squadFound?.home && `Time da casa não encontrado`}
                            {!tableInfo.squadFound?.home && !tableInfo.squadFound?.away && ' e '}
                            {!tableInfo.squadFound?.away && `Time visitante não encontrado`}
                            {tableInfo.availableSquads && tableInfo.availableSquads.length > 0 && (
                              <div className="opacity-70 mt-1">
                                Squads disponíveis: {tableInfo.availableSquads.slice(0, 3).join(', ')}
                                {tableInfo.availableSquads.length > 3 && '...'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const hasGeral = !!(formData.homeTableData && formData.awayTableData);
                const hasStandardFor = !!(formData.homeStandardForData && formData.awayStandardForData && formData.competitionStandardForAvg);
                const hasPassingFor = !!(formData.homePassingForData && formData.awayPassingForData && formData.competitionPassingForAvg);
                const hasGcaFor = !!(formData.homeGcaForData && formData.awayGcaForData && formData.competitionGcaForAvg);
                const allTablesPresent = hasGeral && hasStandardFor && hasPassingFor && hasGcaFor;
                
                if (allTablesPresent) {
                  return (
                    <div className="mt-2 p-2 bg-success/10 border border-success/30 rounded text-success text-xs font-medium">
                      ✅ Todas as 4 tabelas carregadas! Análise com máxima precisão.
                    </div>
                  );
                }

                const missingTables = [
                  !hasGeral && 'geral',
                  !hasStandardFor && 'standard_for',
                  !hasPassingFor && 'passing_for',
                  !hasGcaFor && 'gca_for',
                ].filter(Boolean) as string[];

                // Verificar se tabelas não existem no banco ou se Squads não foram encontrados
                const diagnostic = tablesDiagnostic;
                const missingInDb = diagnostic?.missingTables || [];
                const emptyInDb = diagnostic?.emptyTables || [];
                const squadIssues = diagnostic?.tables && Object.entries(diagnostic.tables).some(
                  ([type, info]) => {
                    if (!info.exists || !info.hasData) return false;
                    return info.squadFound && (!info.squadFound.home || !info.squadFound.away);
                  }
                );

                let message = '';
                let suggestion = '';

                if (missingInDb.length > 0 && missingInDb.some(t => missingTables.includes(t))) {
                  message = `As tabelas ${missingInDb.filter(t => missingTables.includes(t)).join(', ')} não foram extraídas ainda.`;
                  suggestion = 'Clique em "Extrair Tabelas do FBref.com" para extrair todas as tabelas.';
                } else if (emptyInDb.length > 0 && emptyInDb.some(t => missingTables.includes(t))) {
                  message = `As tabelas ${emptyInDb.filter(t => missingTables.includes(t)).join(', ')} estão vazias.`;
                  suggestion = 'Extraia novamente do fbref.com.';
                } else if (squadIssues) {
                  message = 'Alguns times não foram encontrados nas tabelas.';
                  suggestion = 'Verifique se os nomes dos times (Squads) estão corretos e correspondem aos nomes nas tabelas.';
                } else {
                  message = 'Algumas tabelas estão faltando.';
                  suggestion = 'Para análise completa com todas as 4 tabelas, extraia todas do fbref.com.';
                }

                return (
                  <div className="mt-2 p-2 bg-warning/10 border border-warning/30 rounded text-warning text-xs">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold mb-1">{message}</p>
                        <p className="opacity-80 mb-1">{suggestion}</p>
                        <p className="opacity-70">
                          Tabelas faltando: {missingTables.join(', ') || 'Nenhuma'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Informações Básicas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control">
          <label htmlFor="homeTeam" className="label ml-2">
            <span className="label-text font-bold">Time Casa</span>
          </label>
          <input
            id="homeTeam"
            name="homeTeam"
            value={formData.homeTeam}
            onChange={handleChange}
            className="input w-full min-h-[44px] text-base focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Ex: Man City"
            required
            aria-required="true"
            aria-label="Nome do time da casa"
          />
        </div>
        <div className="form-control">
          <label htmlFor="awayTeam" className="label ml-2">
            <span className="label-text font-bold">Time Visitante</span>
          </label>
          <input
            id="awayTeam"
            name="awayTeam"
            value={formData.awayTeam}
            onChange={handleChange}
            className="input w-full min-h-[44px] text-base focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Ex: Real Madrid"
            required
            aria-required="true"
            aria-label="Nome do time visitante"
          />
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

      {/* Competição (Média) */}
      <div className="form-control">
        <label className="label ml-2 flex items-center">
          <span className="label-text font-bold">Competição (Média)</span>
          <InfoIcon text="Média da competição." />
        </label>
        <input
          type="number"
          step="0.01"
          name="competitionAvg"
          value={formData.competitionAvg || ''}
          onChange={handleChange}
          className="input w-full"
          placeholder="Ex: 76.87"
          aria-label="Média da competição"
        />
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

      {/* Estatísticas Globais - Time Casa */}
      <div className="bg-teal-500/5 p-4 rounded-3xl border border-teal-500/10">
        <div className="flex items-center mb-4">
          <div className="flex items-center">
            <span className="text-[10px] uppercase font-black opacity-40 tracking-widest">
              Estatísticas Globais - {formData.homeTeam || 'Time Casa'}
            </span>
            <InfoIcon text="Estatísticas dos 10 últimos jogos do time jogando em Casa. Insira manualmente os dados baseados nos últimos 10 jogos em casa." />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-[10px] font-bold">Média Marcados</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.homeTeamStats?.gols.home.avgScored || ''}
              onChange={(e) =>
                updateTeamStats(
                  'home',
                  'avgScored',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="input input-sm text-center min-h-[44px]"
              placeholder="0.00"
            />
          </div>
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-[10px] font-bold">Média Sofridos</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.homeTeamStats?.gols.home.avgConceded || ''}
              onChange={(e) =>
                updateTeamStats(
                  'home',
                  'avgConceded',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="input input-sm text-center min-h-[44px]"
              placeholder="0.00"
            />
          </div>
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-[10px] font-bold">Média Total</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.homeTeamStats?.gols.home.avgTotal || ''}
              onChange={(e) =>
                updateTeamStats(
                  'home',
                  'avgTotal',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="input input-sm text-center min-h-[44px]"
              placeholder="0.00"
            />
          </div>
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-[10px] font-bold">Sem Sofrer %</span>
            </label>
            <input
              type="number"
              step="1"
              value={formData.homeTeamStats?.gols.home.cleanSheetPct || ''}
              onChange={(e) =>
                updateTeamStats(
                  'home',
                  'cleanSheetPct',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="input input-sm text-center min-h-[44px]"
              placeholder="0"
            />
          </div>
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-[10px] font-bold">Sem Marcar %</span>
            </label>
            <input
              type="number"
              step="1"
              value={formData.homeTeamStats?.gols.home.noGoalsPct || ''}
              onChange={(e) =>
                updateTeamStats(
                  'home',
                  'noGoalsPct',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="input input-sm text-center min-h-[44px]"
              placeholder="0"
            />
          </div>
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-[10px] font-bold">Over 2.5 %</span>
            </label>
            <input
              type="number"
              step="1"
              value={formData.homeTeamStats?.gols.home.over25Pct || ''}
              onChange={(e) =>
                updateTeamStats(
                  'home',
                  'over25Pct',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="input input-sm text-center min-h-[44px]"
              placeholder="0"
            />
          </div>
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-[10px] font-bold">Under 2.5 %</span>
            </label>
            <input
              type="number"
              step="1"
              value={formData.homeTeamStats?.gols.home.under25Pct || ''}
              onChange={(e) =>
                updateTeamStats(
                  'home',
                  'under25Pct',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="input input-sm text-center min-h-[44px]"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Estatísticas Globais - Time Visitante */}
      <div className="bg-teal-500/5 p-4 rounded-3xl border border-teal-500/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <span className="text-[10px] uppercase font-black opacity-40 tracking-widest">
              Estatísticas Globais - {formData.awayTeam || 'Time Visitante'}
            </span>
            <InfoIcon text="Estatísticas dos 10 últimos jogos do time jogando Fora. Insira manualmente os dados baseados nos últimos 10 jogos fora de casa." />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-[10px] font-bold">Média Marcados</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.awayTeamStats?.gols.away.avgScored || ''}
              onChange={(e) =>
                updateTeamStats(
                  'away',
                  'avgScored',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="input input-sm text-center min-h-[44px]"
              placeholder="0.00"
            />
          </div>
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-[10px] font-bold">Média Sofridos</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.awayTeamStats?.gols.away.avgConceded || ''}
              onChange={(e) =>
                updateTeamStats(
                  'away',
                  'avgConceded',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="input input-sm text-center min-h-[44px]"
              placeholder="0.00"
            />
          </div>
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-[10px] font-bold">Média Total</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.awayTeamStats?.gols.away.avgTotal || ''}
              onChange={(e) =>
                updateTeamStats(
                  'away',
                  'avgTotal',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="input input-sm text-center min-h-[44px]"
              placeholder="0.00"
            />
          </div>
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-[10px] font-bold">Sem Sofrer %</span>
            </label>
            <input
              type="number"
              step="1"
              value={formData.awayTeamStats?.gols.away.cleanSheetPct || ''}
              onChange={(e) =>
                updateTeamStats(
                  'away',
                  'cleanSheetPct',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="input input-sm text-center min-h-[44px]"
              placeholder="0"
            />
          </div>
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-[10px] font-bold">Sem Marcar %</span>
            </label>
            <input
              type="number"
              step="1"
              value={formData.awayTeamStats?.gols.away.noGoalsPct || ''}
              onChange={(e) =>
                updateTeamStats(
                  'away',
                  'noGoalsPct',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="input input-sm text-center min-h-[44px]"
              placeholder="0"
            />
          </div>
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-[10px] font-bold">Over 2.5 %</span>
            </label>
            <input
              type="number"
              step="1"
              value={formData.awayTeamStats?.gols.away.over25Pct || ''}
              onChange={(e) =>
                updateTeamStats(
                  'away',
                  'over25Pct',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="input input-sm text-center min-h-[44px]"
              placeholder="0"
            />
          </div>
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-[10px] font-bold">Under 2.5 %</span>
            </label>
            <input
              type="number"
              step="1"
              value={formData.awayTeamStats?.gols.away.under25Pct || ''}
              onChange={(e) =>
                updateTeamStats(
                  'away',
                  'under25Pct',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="input input-sm text-center min-h-[44px]"
              placeholder="0"
            />
          </div>
        </div>
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
