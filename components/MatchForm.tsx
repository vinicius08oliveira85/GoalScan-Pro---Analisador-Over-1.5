import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MatchData, TeamStatistics, GolsStats, Championship, TableRowGeral } from '../types';
import { validateMatchData } from '../utils/validation';
import { errorService } from '../services/errorService';
import { animations } from '../utils/animations';
import { useChampionships } from '../hooks/useChampionships';
import { syncTeamStatsFromTable, checkChampionshipTablesAvailability, ChampionshipTablesDiagnostic } from '../services/championshipService';
import { AlertTriangle, CheckCircle, XCircle, Upload, FileSpreadsheet, Clipboard, Copy } from 'lucide-react';
import { parseGlobalStatsExcel, isGlobalStatsFile } from '../utils/globalStatsParser';
import InfoIcon from './match-form/InfoIcon';
import TeamStatsSection from './match-form/TeamStatsSection';

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
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

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
        homeComplementData,
        awayComplementData,
        competitionComplementAvg,
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
          homeComplementData: !!homeComplementData,
          awayComplementData: !!awayComplementData,
          competitionComplementAvg: !!competitionComplementAvg,
          hasPreviousHomeStats: !!previousHomeStats,
          hasPreviousAwayStats: !!previousAwayStats,
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
          homeComplementData: homeComplementData || undefined,
          awayComplementData: awayComplementData || undefined,
          competitionComplementAvg: competitionComplementAvg || undefined,
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

      // Verificar se a tabela geral foi carregada
      const hasGeralTable = !!(homeTableData && awayTableData);

      // Detectar formato da tabela (básica vs completa)
      let tableFormat: 'completa' | 'basica' | null = null;
      if (hasGeralTable && homeTableData && awayTableData) {
        const hasXg = !!(
          homeTableData['Home xG'] ||
          homeTableData['Away xG'] ||
          homeTableData.xG ||
          awayTableData['Home xG'] ||
          awayTableData['Away xG'] ||
          awayTableData.xG
        );
        tableFormat = hasXg ? 'completa' : 'basica';
      }

      // Log detalhado para diagnóstico
      if (import.meta.env.DEV) {
        console.log('[MatchForm] Resultado da sincronização:', {
          geral: {
            home: !!homeTableData,
            away: !!awayTableData,
            loaded: hasGeralTable,
          },
          tableFormat,
          competitionAvg,
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

      // Mostrar feedback sobre tabela carregada
      if (hasGeralTable) {
        // Tabela geral carregada - sucesso silencioso
        if (import.meta.env.DEV) {
          console.log('[MatchForm] ✅ Tabela geral carregada com sucesso!');
        }
      } else {
        // Tabela geral não carregada
        if (import.meta.env.DEV) {
          console.warn('[MatchForm] ⚠️ Tabela geral não foi carregada.');
        }
        // Nenhuma tabela carregada
        if (onError) {
          onError(
            'Nenhuma tabela foi encontrada. Verifique se os times existem no campeonato e se a classificação JSON foi importada em Campeonatos.'
          );
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

  // Função para atualizar estatísticas de gols
  // team: 'home' = time da casa, 'away' = time visitante
  // context: 'home' = jogando em casa, 'away' = jogando fora, 'global' = global
  const updateTeamStats = (
    team: 'home' | 'away',
    context: 'home' | 'away' | 'global',
    field: keyof GolsStats,
    value: number | undefined
  ) => {
    setFormData((prev) => {
      const teamKey = team === 'home' ? 'homeTeamStats' : 'awayTeamStats';
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
          [context]: {
            ...currentStats.gols[context],
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

  const processPastedStats = (text: string, team: 'home' | 'away') => {
    const lines = text.trim().split('\n');
    if (lines.length < 1) return;

    const newStats = {
      home: createEmptyGols(),
      away: createEmptyGols(),
      global: createEmptyGols()
    };
    
    let found = false;

    const parseVal = (v: string) => {
      if (!v) return 0;
      return parseFloat(v.replace('%', '').replace(',', '.').trim()) || 0;
    };

    lines.forEach(line => {
      // Tenta dividir por tabulação primeiro
      let cols = line.trim().split(/\t/);
      // Se não tiver colunas suficientes, tenta por múltiplos espaços
      if (cols.length < 4) {
        cols = line.trim().split(/\s{2,}/);
      }
      
      if (cols.length >= 4) {
        const label = cols[0].toLowerCase();
        let field: keyof GolsStats | null = null;

        if (label.includes('marcados por jogo')) field = 'avgScored';
        else if (label.includes('sofridos por jogo')) field = 'avgConceded';
        else if (label.includes('marcados+sofridos') || label.includes('marcados + sofridos')) field = 'avgTotal';
        else if (label.includes('sem sofrer')) field = 'cleanSheetPct';
        else if (label.includes('sem marcar')) field = 'noGoalsPct';
        else if (label.includes('mais de 2,5')) field = 'over25Pct';
        else if (label.includes('menos de 2,5')) field = 'under25Pct';

        if (field) {
          found = true;
          // Index 1: Casa, Index 2: Fora, Index 3: Global
          newStats.home[field] = parseVal(cols[1]);
          newStats.away[field] = parseVal(cols[2]);
          newStats.global[field] = parseVal(cols[3]);
        }
      }
    });

    if (found) {
      setFormData(prev => {
        const teamKey = team === 'home' ? 'homeTeamStats' : 'awayTeamStats';
        const emptyPercurso = {
          winStreak: 0, drawStreak: 0, lossStreak: 0,
          withoutWin: 0, withoutDraw: 0, withoutLoss: 0,
        };
        const currentStats = prev[teamKey] || { 
          percurso: { home: emptyPercurso, away: emptyPercurso, global: emptyPercurso }, 
          gols: { home: createEmptyGols(), away: createEmptyGols(), global: createEmptyGols() } 
        };
        
        return { ...prev, [teamKey]: { ...currentStats, gols: newStats } };
      });
    } else {
      alert('Nenhum dado reconhecido. Verifique o formato.');
    }
  };

  // Handler para importar Estatísticas Globais do Excel
  const handleGlobalStatsImport = async (file: File) => {
    setIsImporting(true);
    setImportFeedback(null);

    try {
      // Validar tipo de arquivo
      if (!isGlobalStatsFile(file)) {
        throw new Error('Arquivo inválido. Use arquivos .xlsx, .xls, .csv ou .json');
      }

      const isJson = file.name.toLowerCase().endsWith('.json');
      const { homeTeamStats, awayTeamStats } = isJson
        ? await new Promise<{
            homeTeamStats: TeamStatistics;
            awayTeamStats: TeamStatistics;
          }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const text = String(reader.result ?? '');
                const parsed: unknown = JSON.parse(text);
                resolve(parseDualGlobalStatsJson(parsed));
              } catch (e) {
                reject(e instanceof Error ? e : new Error('Erro ao ler JSON'));
              }
            };
            reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
            reader.readAsText(file, 'UTF-8');
          })
        : await parseGlobalStatsExcel(file);

      // Atualizar formData com as estatísticas importadas
      setFormData((prev) => ({
        ...prev,
        homeTeamStats,
        awayTeamStats,
      }));

      // Feedback de sucesso
      setImportFeedback({
        type: 'success',
        message: 'Estatísticas Globais importadas com sucesso!',
      });

      // Limpar feedback após 5 segundos
      setTimeout(() => {
        setImportFeedback(null);
      }, 5000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido ao importar arquivo';
      
      setImportFeedback({
        type: 'error',
        message: errorMessage,
      });

      if (onError) {
        onError(`Erro ao importar Estatísticas Globais: ${errorMessage}`);
      }

      // Limpar feedback após 8 segundos em caso de erro
      setTimeout(() => {
        setImportFeedback(null);
      }, 8000);
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleGlobalStatsImport(file);
    }
    // Limpar input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    try {
      // Validar dados antes de enviar
      const validatedData = validateMatchData(formData);
      
      // Log: verificar se a tabela geral foi preservada após validação
      if (import.meta.env.DEV) {
        console.log('[MatchForm] Dados após validação (validateMatchData):', {
          tabela: {
            geral: !!(validatedData.homeTableData && validatedData.awayTableData),
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
                    Importe o arquivo JSON da classificação em Campeonatos (criar ou atualizar tabela).
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

          {/* Status da Tabela Sincronizada: Mostrar após sincronização */}
          {formData.homeTableData && formData.awayTableData ? (
            <div className="mt-4 p-4 bg-base-300/50 rounded-lg border border-base-content/10 space-y-3">
              <div className="font-semibold text-sm mb-3">Classificação sincronizada</div>

              <div className="flex items-start gap-2 text-xs">
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">Dados do campeonato carregados</div>
                  <div className="opacity-70 text-xs mt-0.5">
                    A análise usa a tabela agregada (GF/GA por jogo) e vantagem de casa calibrada.
                  </div>
                  {(() => {
                    const tableInfo = tablesDiagnostic?.tables.geral;
                    const squadIssue =
                      tableInfo?.squadFound && (!tableInfo.squadFound.home || !tableInfo.squadFound.away);
                    if (squadIssue) {
                      return (
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
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-base-content/10">
                {(() => {
                  const h = formData.homeTableData;
                  const a = formData.awayTableData;
                  const hasXg = !!(
                    h?.['Home xG'] ||
                    h?.['Away xG'] ||
                    h?.xG ||
                    a?.['Home xG'] ||
                    a?.['Away xG'] ||
                    a?.xG
                  );
                  if (hasXg) {
                    return (
                      <div className="p-2 bg-info/10 border border-info/30 rounded text-info text-xs font-medium">
                        Dados com xG detectados (formato legado Home/Away). A análise pode combinar xG com GF/GA.
                      </div>
                    );
                  }
                  return (
                    <div className="p-2 bg-success/10 border border-success/30 rounded text-success text-xs font-medium">
                      Classificação agregada (JSON): análise com gols reais (GF/GA) e modelo Poisson.
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : null}
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
            className={`input w-full min-h-[44px] text-base focus:outline-none focus:ring-2 focus:ring-primary ${attemptedSubmit && !formData.homeTeam ? 'border-error' : ''}`}
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
            className={`input w-full min-h-[44px] text-base focus:outline-none focus:ring-2 focus:ring-primary ${attemptedSubmit && !formData.awayTeam ? 'border-error' : ''}`}
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
          <InfoIcon text="Odd atual do mercado Over 1.5. Com ela o app calcula o EV (retorno médio esperado por unidade apostada). O modelo de probabilidade usa Poisson e os dados que você preencheu abaixo." />
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

      {/* Importação de Estatísticas Globais */}
      <div className="bg-teal-500/5 p-4 rounded-3xl border border-teal-500/10 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-teal-500" />
            <span className="text-sm font-bold">Importar Estatísticas Globais</span>
            <InfoIcon text="Excel/CSV: seções Time Casa e Time Fora. JSON: objeto com chaves home e away (ou timeCasa/timeFora), ou array [casa, fora], cada um no formato title/headers/rows (Casa, Fora, Global)." />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <label className="btn btn-outline btn-sm btn-teal cursor-pointer">
            <Upload className="w-4 h-4 mr-2" />
            {isImporting ? 'Importando...' : 'Selecionar Arquivo'}
            <input
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv,.json,application/json"
              onChange={handleFileInputChange}
              disabled={isImporting}
              className="hidden"
              aria-label="Importar Estatísticas Globais"
            />
          </label>
          
          {importFeedback && (
            <div
              className={`flex items-center gap-2 text-sm ${
                importFeedback.type === 'success' ? 'text-success' : 'text-error'
              }`}
            >
              {importFeedback.type === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <span>{importFeedback.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Estatísticas Globais - Time Casa */}
      <TeamStatsSection
        teamLabel={formData.homeTeam || 'Time Casa'}
        teamStats={formData.homeTeamStats || { percurso: { home: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 }, away: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 }, global: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 } }, gols: { home: createEmptyGols(), away: createEmptyGols(), global: createEmptyGols() } }}
        context="home"
        onStatChange={(statCtx, field, value) => updateTeamStats('home', statCtx, field, value)}
        onProcessPaste={processPastedStats}
      />

      {/* Estatísticas Globais - Time Visitante */}
      <TeamStatsSection
        teamLabel={formData.awayTeam || 'Time Visitante'}
        teamStats={formData.awayTeamStats || { percurso: { home: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 }, away: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 }, global: { winStreak: 0, drawStreak: 0, lossStreak: 0, withoutWin: 0, withoutDraw: 0, withoutLoss: 0 } }, gols: { home: createEmptyGols(), away: createEmptyGols(), global: createEmptyGols() } }}
        context="away"
        onStatChange={(statCtx, field, value) => updateTeamStats('away', statCtx, field, value)}
        onProcessPaste={processPastedStats}
      />

      <button
        type="submit"
        className="btn btn-primary btn-lg mt-4 uppercase font-black tracking-widest shadow-2xl hover:scale-[1.01] active:scale-95 transition-all min-h-[44px] text-base md:text-lg w-full sm:w-auto"
      >
        Processar
      </button>
    </motion.form>

    </>
  );
};

export default MatchForm;
