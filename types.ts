
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
  oddOver15?: number; // Nova: Odd do mercado
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
  homeOver15Freq: number;
  awayOver15Freq: number;
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
}

export interface AnalysisResult {
  probabilityOver15: number;
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
}

export interface SavedAnalysis {
  id: string;
  timestamp: number;
  data: MatchData;
  result: AnalysisResult;
}
