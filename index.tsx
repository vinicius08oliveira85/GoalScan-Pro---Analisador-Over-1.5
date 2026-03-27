export interface MatchData {
  homeTeam: string;
  awayTeam: string;
  homeStats: {
    avgGols: number;
    last5: number[];
  };
  awayStats: {
    avgGols: number;
    last5: number[];
  };
  h2h: {
    results: string[];
  };
}

export interface AnalysisResult {
  probabilities: {
    over05HT: number;
    over15: number;
    over25: number;
    under35: number; // Novo mercado
    btts: number;
  };
  justification: string;
  confidenceScore: number;
  expectedValue?: number; // Para gestão de banca
}