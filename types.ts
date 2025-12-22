
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

export interface MatchData {
  homeTeam: string;
  awayTeam: string;
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
