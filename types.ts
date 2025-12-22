
export interface RecentMatch {
  date: string;
  homeScore: number;
  awayScore: number;
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
  // Métricas Avançadas
  homeXG: number;
  awayXG: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  // Frequências
  homeOver15Freq: number;
  awayOver15Freq: number;
  homeBTTSFreq: number;
  awayBTTSFreq: number;
  homeCleanSheetFreq: number;
  awayCleanSheetFreq: number;
  
  h2hOver15Freq: number;
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
