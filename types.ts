export interface RecentMatch {
  date: string;
  homeScore: number;
  awayScore: number;
}

export interface H2HMatch {
  date: string;
  homeScore: number;
  awayScore: number;
  totalGoals: number;
}

// Estatísticas de Percurso (Sequências)
export interface PercursoStats {
  winStreak: number; // Sequência de Vitórias corrente
  drawStreak: number; // Sequência de Empates corrente
  lossStreak: number; // Sequência de Derrotas corrente
  withoutWin: number; // Não ganha há... (0 se não aplicável)
  withoutDraw: number; // Não empata há... (0 se não aplicável)
  withoutLoss: number; // Não perde há... (0 se não aplicável)
}

// Estatísticas de Gols
export interface GolsStats {
  avgScored: number; // Média de gols marcados por jogo
  avgConceded: number; // Média de gols sofridos por jogo
  avgTotal: number; // Média de gols marcados+sofridos
  cleanSheetPct: number; // Jogos sem sofrer (%)
  noGoalsPct: number; // Jogos sem marcar gols (%)
  over25Pct: number; // Jogos com Mais de 2,5 Gols (%)
  under25Pct: number; // Jogos com menos de 2,5 Gols (%)
}

// Estatísticas de Abre Marcador
export interface FirstGoalStats {
  opensScorePct: number; // Abre marcador (qualquer altura) - %
  opensScoreCount: number; // Abre marcador - quantidade
  winningAtHT: number; // E está a vencer ao intervalo - %
  winningAtHTCount: number; // E está a vencer ao intervalo - quantidade
  winsFinal: number; // E vence no final - %
  winsFinalCount: number; // E vence no final - quantidade
  comebacks?: number; // Reviravoltas (opcional, apenas para time visitante)
}

// Estatísticas completas de um time (últimos 10 jogos)
export interface TeamStatistics {
  percurso: {
    home: PercursoStats;
    away: PercursoStats;
    global: PercursoStats;
  };
  gols: {
    home: GolsStats;
    away: GolsStats;
    global: GolsStats;
  };
  firstGoal?: {
    home: FirstGoalStats;
    away: FirstGoalStats;
    global: FirstGoalStats;
  };
}

export interface MatchData {
  homeTeam: string;
  awayTeam: string;
  matchDate?: string; // Data da partida (YYYY-MM-DD)
  matchTime?: string; // Hora da partida (HH:mm)
  competitionAvg?: number; // Média da competição
  oddOver15?: number; // Nova: Odd do mercado
  championshipId?: string; // ID do campeonato selecionado
  // Médias Reais
  homeGoalsScoredAvg: number;
  homeGoalsConcededAvg: number;
  awayGoalsScoredAvg: number;
  awayGoalsConcededAvg: number;

  // FASE 1: Desempenho Casa vs Fora Separado
  homeGoalsScoredAtHome?: number; // Média de gols marcados em casa
  homeGoalsConcededAtHome?: number; // Média de gols sofridos em casa
  awayGoalsScoredAway?: number; // Média de gols marcados fora
  awayGoalsConcededAway?: number; // Média de gols sofridos fora

  // Métricas Avançadas
  homeXG: number;
  awayXG: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;

  // FASE 1: xA (Expected Assists)
  homeXA?: number; // Expected Assists do time da casa
  awayXA?: number; // Expected Assists do time de fora

  // FASE 1: Passes Progressivos e Chave
  homeProgressivePasses?: number; // Passes progressivos por 90min
  awayProgressivePasses?: number;
  homeKeyPasses?: number; // Passes chave por 90min
  awayKeyPasses?: number;

  // Frequências
  homeOver15Freq?: number; // Deprecated: removido do formulário, mantido para compatibilidade
  awayOver15Freq?: number; // Deprecated: removido do formulário, mantido para compatibilidade
  homeBTTSFreq: number;
  awayBTTSFreq: number;
  homeCleanSheetFreq: number;
  awayCleanSheetFreq: number;

  // FASE 1: H2H Detalhado
  h2hOver15Freq: number;
  h2hAvgGoals?: number; // Média de gols nos confrontos diretos
  h2hMatches?: H2HMatch[]; // Últimos 5 confrontos com placares

  matchImportance: number;
  keyAbsences: 'none' | 'low' | 'medium' | 'high';

  // Histórico Recente
  homeHistory: RecentMatch[];
  awayHistory: RecentMatch[];

  // Estatísticas Detalhadas (Últimos 10 Jogos) - Novo modelo
  homeTeamStats?: TeamStatistics;
  awayTeamStats?: TeamStatistics;

  // Dados completos da tabela do campeonato (para análise da IA)
  homeTableData?: TableRowGeral;
  awayTableData?: TableRowGeral;
}

export interface AnalysisResult {
  probabilityOver15: number; // Probabilidade estatística pura (baseada em últimos 10 jogos)
  tableProbability?: number | null; // Probabilidade baseada apenas em dados da tabela (temporada completa)
  aiProbability?: number | null; // @deprecated Probabilidade da IA (não mais usada)
  combinedProbability?: number; // Probabilidade final combinada (estatísticas + tabela)
  bttsProbability?: number; // Probabilidade de Ambas Marcam (BTTS) estimada via Poisson (λ_home, λ_away) da análise combinada
  confidenceScore: number;
  poissonHome: number[];
  poissonAway: number[];
  riskLevel: 'Baixo' | 'Moderado' | 'Alto' | 'Muito Alto';
  verdict: string;
  recommendation: string;
  ev: number; // Novo: Valor Esperado (Expected Value)
  advancedMetrics: {
    offensiveVolume: number;
    defensiveLeaking: number;
    bttsCorrelation: number;
    formTrend: number;
  };
  // Probabilidades Over/Under para diferentes linhas (calculadas estatisticamente usando Poisson)
  overUnderProbabilities?: {
    [line: string]: {
      over: number;
      under: number;
    };
  };
  // Probabilidades Over/Under baseadas apenas na tabela
  tableOverUnderProbabilities?: {
    [line: string]: {
      over: number;
      under: number;
    };
  };
  // Probabilidades Over/Under baseadas apenas nas estatísticas
  statsOverUnderProbabilities?: {
    [line: string]: {
      over: number;
      under: number;
    };
  };
  // Combinações recomendadas de apostas (Over E Under >= 75%)
  recommendedCombinations?: Array<{
    overLine: number;
    underLine: number;
    overProb: number;
    underProb: number;
    combinedProb: number;
  }>;
}

// Aposta selecionada para combinação
export interface SelectedBet {
  line: string; // '0.5', '1.5', etc.
  type: 'over' | 'under';
  probability: number;
}

// Informações de Aposta
export interface BetInfo {
  betAmount: number; // Valor apostado
  odd: number; // Odd da aposta
  potentialReturn: number; // Retorno potencial (calculado)
  potentialProfit: number; // Lucro potencial (calculado)
  bankPercentage: number; // % da banca usado
  status: 'pending' | 'won' | 'lost' | 'cancelled';
  placedAt?: number; // Timestamp quando apostou
  resultAt?: number; // Timestamp quando resultado saiu
}

// Configurações de Banca
export interface BankSettings {
  totalBank: number; // Banca total
  currency: string; // Moeda (R$, $, €)
  updatedAt: number; // Última atualização
}

export interface SavedAnalysis {
  id: string;
  timestamp: number;
  data: MatchData;
  result: AnalysisResult;
  aiAnalysis?: string; // @deprecated Markdown completo da análise da IA (não mais usado)
  betInfo?: BetInfo; // Informações da aposta (opcional)
  selectedBets?: SelectedBet[]; // Apostas selecionadas quando a partida foi salva (opcional)
}

// Tipos de tabela de campeonato
export type TableType = 'geral';

// Interface para linha da tabela "Geral" (traduzida para PT-BR)
export interface TableRowGeral {
  Rk: string; // Classificação
  Squad: string; // Equipe
  MP: string; // Partidas Jogadas
  W: string; // Vitórias
  D: string; // Empates
  L: string; // Derrotas
  GF: string; // Gols a Favor
  GA: string; // Gols Contra
  GD: string; // Saldo de Gols
  Pts: string; // Pontos
  'Pts/MP': string; // Pontos por Partida
  xG: string; // Gols Esperados
  xGA: string; // Gols Esperados Permitidos
  xGD: string; // Diferença de Gols Esperados
  'xGD/90': string; // Diferença de xG por 90 Minutos
  'Last 5': string; // Últimos 5 Jogos
  Attendance: string; // Público por Jogo
  'Top Team Scorer_link'?: string;
  'Top Team Scorer': string; // Artilheiro da Equipe
  'Goalkeeper_link'?: string;
  Goalkeeper: string; // Goleiro
  Notes: string; // Observações
}

// Dados do campeonato
export interface Championship {
  id: string;
  nome: string;
  created_at?: string;
  updated_at?: string;
}

// Dados de uma tabela de campeonato
export interface ChampionshipTable {
  id: string;
  championship_id: string;
  table_type: TableType;
  table_name: string;
  table_data: unknown; // JSON genérico (pode ser TableRowGeral[] ou outras estruturas)
  created_at?: string;
  updated_at?: string;
}