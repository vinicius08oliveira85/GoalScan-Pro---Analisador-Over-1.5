import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MatchData, TeamStatistics, GolsStats, Championship, TableRowGeral } from '../types';
import { validateMatchData } from '../utils/validation';
import { errorService } from '../services/errorService';
import { animations } from '../utils/animations';
import { useChampionships } from '../hooks/useChampionships';
import { syncTeamStatsFromTable } from '../services/championshipService';

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

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData(createEmptyMatchData());
    }
  }, [initialData]);

  // Carregar Squads quando campeonato for selecionado
  useEffect(() => {
    const loadSquads = async () => {
      if (selectedChampionshipId) {
        const squads = await getSquads(selectedChampionshipId, 'geral');
        setAvailableSquads(squads);
      } else {
        setAvailableSquads([]);
      }
    };
    loadSquads();
  }, [selectedChampionshipId, getSquads]);

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

      // Mostrar mensagem de sucesso se dados foram encontrados
      if (homeTableData && awayTableData) {
        // Silencioso - dados sincronizados com sucesso
      } else {
        if (onError) {
          onError('Alguns dados da tabela não foram encontrados. Verifique se as equipes existem no campeonato.');
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
        <div className="mt-4">
          <button
            type="button"
            onClick={handleSyncWithTable}
            disabled={!selectedChampionshipId || !selectedHomeSquad || !selectedAwaySquad}
            className="btn btn-primary w-full md:w-auto"
          >
            Sincronizar com Tabela
          </button>
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
  );
};

export default MatchForm;
