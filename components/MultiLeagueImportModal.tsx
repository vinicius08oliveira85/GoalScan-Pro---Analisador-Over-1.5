import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Loader2, CheckCircle, XCircle, AlertCircle, Table2, Swords, Globe, ChevronDown, ChevronUp,
} from 'lucide-react';
import ModalShell from './ui/ModalShell';
import { FOOTBALL_LEAGUES, FootballLeague } from '../config/footballLeagues';
import {
  importMultipleLeagues,
  saveLeagueAsChampionship,
  ImportProgress,
  LeagueData,
} from '../services/multiLeagueImportService';
import { Championship, ChampionshipTable } from '../types';
import { animations } from '../utils/animations';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (championships: Championship[], tables: ChampionshipTable[][]) => void;
  onError?: (message: string) => void;
}

interface LeagueResult {
  league: FootballLeague;
  data: LeagueData | null;
  championship: Championship | null;
  tables: ChampionshipTable[];
  status: 'pending' | 'loading' | 'done' | 'error';
  error?: string;
}

function StandingsPreview({ data }: { data: LeagueData }) {
  const top10 = data.standings.slice(0, 10);
  if (!top10.length) return <p className="text-sm opacity-60 text-center py-4">Sem dados de classificacao</p>;
  return (
    <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-lg border border-base-300">
      <table className="table table-sm table-zebra w-full">
        <thead>
          <tr>
            {['#', 'Time', 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG', 'Pts', 'Forma'].map((h) => (
              <th key={h} className="text-xs uppercase font-bold opacity-70 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {top10.map((s) => (
            <tr key={s.teamId}>
              <td className="text-xs">{s.rank}</td>
              <td className="text-xs font-medium">{s.teamName}</td>
              <td className="text-xs">{s.all.played}</td>
              <td className="text-xs">{s.all.win}</td>
              <td className="text-xs">{s.all.draw}</td>
              <td className="text-xs">{s.all.lose}</td>
              <td className="text-xs">{s.all.goals.for}</td>
              <td className="text-xs">{s.all.goals.against}</td>
              <td className="text-xs">{s.all.goals.for - s.all.goals.against}</td>
              <td className="text-xs font-bold">{s.points}</td>
              <td className="text-xs">{s.form || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.standings.length > 10 && (
        <p className="text-xs text-center opacity-50 py-1">+{data.standings.length - 10} times</p>
      )}
    </div>
  );
}

function FixturesPreview({ data }: { data: LeagueData }) {
  const recent = data.fixtures
    .filter((f) => f.status === 'FT')
    .slice(-10);
  if (!recent.length) return <p className="text-sm opacity-60 text-center py-4">Sem jogos finalizados</p>;
  return (
    <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-lg border border-base-300">
      <table className="table table-sm table-zebra w-full">
        <thead>
          <tr>
            {['Data', 'Casa', 'Placar', 'Fora'].map((h) => (
              <th key={h} className="text-xs uppercase font-bold opacity-70 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {recent.map((f) => (
            <tr key={f.fixtureId}>
              <td className="text-xs">{new Date(f.date).toLocaleDateString('pt-BR')}</td>
              <td className="text-xs">{f.homeTeam.name}</td>
              <td className="text-xs font-bold">{f.goals.home}-{f.goals.away}</td>
              <td className="text-xs">{f.awayTeam.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MultiLeagueImportModal({ isOpen, onClose, onSuccess, onError }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(FOOTBALL_LEAGUES.map((l) => l.id))
  );
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [results, setResults] = useState<LeagueResult[]>([]);
  const [expandedLeague, setExpandedLeague] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'geral' | 'jogos'>('geral');

  const toggleLeague = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;
    setImporting(true);
    setProgress({ step: 'extraindo', league: '', message: 'Iniciando importacao...', progress: 0 });
    setResults([]);

    const leagueResults: LeagueResult[] = FOOTBALL_LEAGUES
      .filter((l) => selectedIds.has(l.id))
      .map((l) => ({ league: l, data: null, championship: null, tables: [], status: 'loading' as const }));

    setResults(leagueResults);

    const dataMap = await importMultipleLeagues(
      Array.from(selectedIds),
      (p) => setProgress(p),
    );

    for (let i = 0; i < leagueResults.length; i++) {
      const lr = leagueResults[i];
      const data = dataMap.get(lr.league.id);
      if (data) {
        lr.data = data;
        lr.status = 'done';

        setProgress({ step: 'salvando', league: lr.league.name, message: `Salvando ${lr.league.name}...`, progress: 0 });

        try {
          const saved = await saveLeagueAsChampionship(lr.league, data);
          lr.championship = saved.championship;
          lr.tables = saved.tables;
        } catch (err) {
          lr.status = 'error';
          lr.error = err instanceof Error ? err.message : 'Erro ao salvar';
        }
      } else {
        lr.status = 'error';
        lr.error = 'Falha ao extrair dados';
      }

      setResults([...leagueResults]);
    }

    setProgress({ step: 'concluido', league: '', message: 'Importacao concluida!', progress: 100 });
    setImporting(false);
  };

  const handleViewTables = () => {
    const championships = results.filter((r) => r.championship).map((r) => r.championship!);
    const tables = results.filter((r) => r.tables.length > 0).map((r) => r.tables);
    onSuccess?.(championships, tables);
    onClose();
  };

  const isConcluded = progress?.step === 'concluido';
  const isError = progress?.step === 'erro';
  const doneCount = results.filter((r) => r.status === 'done').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick={!importing}
      closeOnEscape={!importing}
      showCloseButton={!importing}
      title="Importar Campeonatos"
      panelClassName="max-w-2xl"
    >
      <div className="p-6 space-y-5">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div className="text-sm">
            <p className="font-bold">Campeonatos Disponiveis</p>
            <p className="opacity-70 mt-1">
              Dados da API-Football: classificacao + jogos da temporada.
              H2H e buscado on-demand ao analisar partidas.
            </p>
          </div>
        </div>

        {!importing && !isConcluded && (
          <div className="space-y-2">
            {FOOTBALL_LEAGUES.map((league) => {
              const isSelected = selectedIds.has(league.id);
              return (
                <label
                  key={league.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-base-300/40 bg-base-200/30 opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm checkbox-primary"
                    checked={isSelected}
                    onChange={() => toggleLeague(league.id)}
                  />
                  <span className="text-lg">{league.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{league.name}</span>
                    <span className="text-xs opacity-50 ml-2">{league.country} &middot; {league.season}</span>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {progress && (
          <motion.div
            initial="initial"
            animate="animate"
            variants={animations.fadeInUp}
            className={`rounded-xl border p-4 ${
              isError
                ? 'border-l-error/60 border-base-300/40 bg-error/8'
                : isConcluded
                ? 'border-l-success/60 border-base-300/40 bg-success/8'
                : 'border-l-info/60 border-base-300/40 bg-info/8'
            }`}
          >
            <div className="flex items-start gap-3">
              {importing ? (
                <Loader2 className="w-5 h-5 text-info animate-spin mt-0.5 shrink-0" />
              ) : isError ? (
                <XCircle className="w-5 h-5 text-error mt-0.5 shrink-0" />
              ) : isConcluded ? (
                <CheckCircle className="w-5 h-5 text-success mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-info mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm">{progress.message}</p>
                {importing && (
                  <div className="mt-3 w-full bg-base-300 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress.progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((lr) => (
              <div
                key={lr.league.id}
                className="rounded-lg border border-base-300/40 overflow-hidden"
              >
                <button
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-base-200/30 transition-colors"
                  onClick={() => setExpandedLeague(expandedLeague === lr.league.id ? null : lr.league.id)}
                >
                  {lr.status === 'loading' ? (
                    <Loader2 className="w-4 h-4 text-info animate-spin shrink-0" />
                  ) : lr.status === 'done' ? (
                    <CheckCircle className="w-4 h-4 text-success shrink-0" />
                  ) : lr.status === 'error' ? (
                    <XCircle className="w-4 h-4 text-error shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-base-300 shrink-0" />
                  )}
                  <span className="text-lg">{lr.league.icon}</span>
                  <span className="text-sm font-medium flex-1">{lr.league.name}</span>
                  <span className="text-xs opacity-50">
                    {lr.status === 'loading' ? 'Carregando...' : lr.status === 'done' ? `${lr.tables.length} tabelas` : lr.error || 'Erro'}
                  </span>
                  {expandedLeague === lr.league.id ? (
                    <ChevronUp className="w-4 h-4 opacity-50" />
                  ) : (
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  )}
                </button>

                {expandedLeague === lr.league.id && lr.data && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="px-3 pb-3 space-y-3"
                  >
                    <div className="tabs tabs-boxed gap-1">
                      <button
                        onClick={() => setActiveTab('geral')}
                        className={`tab gap-1.5 text-xs ${activeTab === 'geral' ? 'tab-active' : ''}`}
                      >
                        <Table2 className="w-3 h-3" />
                        Classificacao
                        <span className="badge badge-xs">{lr.data.standings.length}</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('jogos')}
                        className={`tab gap-1.5 text-xs ${activeTab === 'jogos' ? 'tab-active' : ''}`}
                      >
                        <Swords className="w-3 h-3" />
                        Jogos
                        <span className="badge badge-xs">{lr.data.fixtures.length}</span>
                      </button>
                    </div>
                    {activeTab === 'geral' ? (
                      <StandingsPreview data={lr.data} />
                    ) : (
                      <FixturesPreview data={lr.data} />
                    )}
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        )}

        {isConcluded && (
          <div className="text-xs text-center opacity-60">
            {doneCount} campeonato(s) importado(s)
            {errorCount > 0 && <span className="text-error"> &middot; {errorCount} com erro</span>}
            &middot; Fonte: API-Football
          </div>
        )}

        <div className="flex gap-3">
          {!importing && !isConcluded && (
            <button
              onClick={handleImport}
              disabled={selectedIds.size === 0}
              className="btn btn-primary flex-1 gap-2"
            >
              <Trophy className="w-4 h-4" />
              Importar {selectedIds.size} Campeonato{selectedIds.size !== 1 ? 's' : ''}
            </button>
          )}
          {isConcluded && (
            <button onClick={handleViewTables} className="btn btn-primary flex-1 gap-2">
              <CheckCircle className="w-4 h-4" />
              Visualizar Tabelas
            </button>
          )}
          {(isError || isConcluded) && (
            <button onClick={onClose} className="btn btn-ghost flex-1">
              Fechar
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
