import { SavedAnalysis, MatchResultAnalysis } from '../types';

/**
 * Busca informações sobre o resultado de uma partida na web
 * e gera uma análise resumida sobre por que a aposta ganhou ou perdeu
 */
export async function analyzeMatchResult(
  match: SavedAnalysis
): Promise<MatchResultAnalysis> {
  if (!match.betInfo || (match.betInfo.status !== 'won' && match.betInfo.status !== 'lost')) {
    throw new Error('A partida deve ter uma aposta finalizada (ganha ou perdida) para análise');
  }

  const { homeTeam, awayTeam, matchDate } = match.data;
  const betStatus = match.betInfo.status;

  // Construir query de busca
  const searchQuery = `${homeTeam} vs ${awayTeam} ${matchDate || ''} resultado placar`.trim();

  // Buscar informações na web
  // Nota: Esta função será chamada pelo sistema, que usará a ferramenta web_search
  // Por enquanto, retornamos uma estrutura que será preenchida pela busca web
  
  // Esta função será chamada pelo App.tsx que terá acesso à ferramenta web_search
  // Por isso, vamos retornar uma estrutura que será preenchida externamente
  
  return {
    matchResult: {
      homeScore: 0, // Será preenchido pela busca web
      awayScore: 0, // Será preenchido pela busca web
      totalGoals: 0, // Será preenchido pela busca web
    },
    betOutcome: betStatus,
    analysis: '', // Será gerado pela busca web
    sources: [],
    generatedAt: Date.now(),
  };
}

/**
 * Gera análise textual baseada no resultado da partida e na aposta
 */
export function generateAnalysisText(
  match: SavedAnalysis,
  matchResult: { homeScore: number; awayScore: number; totalGoals: number },
  webSearchResults: string
): string {
  const { homeTeam, awayTeam } = match.data;
  const { totalGoals } = matchResult;
  const betStatus = match.betInfo?.status || 'pending';
  const originalProbability = match.result.combinedProbability || match.result.probabilityOver15;

  // Determinar se a aposta foi ganha ou perdida baseado no total de gols
  const over15Won = totalGoals > 1;
  const betWon = betStatus === 'won';

  let analysis = `## Análise do Resultado\n\n`;
  
  analysis += `**Placar Final:** ${homeTeam} ${matchResult.homeScore} x ${matchResult.awayScore} ${awayTeam}\n\n`;
  analysis += `**Total de Gols:** ${totalGoals}\n\n`;

  // Verificar consistência
  if (over15Won === betWon) {
    analysis += `✅ **Aposta ${betWon ? 'Ganhou' : 'Perdeu'} Corretamente**\n\n`;
    
    if (betWon) {
      analysis += `A aposta em Over 1.5 gols foi bem-sucedida. O jogo teve ${totalGoals} gol(s), confirmando a previsão de que haveria mais de 1.5 gols na partida.\n\n`;
    } else {
      analysis += `A aposta em Over 1.5 gols não foi bem-sucedida. O jogo teve apenas ${totalGoals} gol(s), ficando abaixo do limite de 1.5 gols.\n\n`;
    }
  } else {
    analysis += `⚠️ **Inconsistência Detectada**\n\n`;
    analysis += `O resultado do jogo (${totalGoals} gol(s)) ${over15Won ? 'deveria ter' : 'não deveria ter'} resultado em uma aposta ganha, mas o status está marcado como ${betWon ? 'ganha' : 'perdida'}.\n\n`;
  }

  // Comparar com probabilidade original
  if (originalProbability) {
    analysis += `**Probabilidade Original:** ${originalProbability.toFixed(1)}%\n\n`;
    
    if (betWon && originalProbability >= 70) {
      analysis += `A análise original indicava uma probabilidade alta (${originalProbability.toFixed(1)}%) de Over 1.5 gols, o que se confirmou no resultado.\n\n`;
    } else if (!betWon && originalProbability >= 70) {
      analysis += `Apesar da probabilidade alta (${originalProbability.toFixed(1)}%) de Over 1.5 gols na análise original, o resultado foi diferente do esperado.\n\n`;
    } else if (betWon && originalProbability < 70) {
      analysis += `A análise original indicava uma probabilidade moderada (${originalProbability.toFixed(1)}%) de Over 1.5 gols, mas o resultado foi positivo.\n\n`;
    } else {
      analysis += `A análise original indicava uma probabilidade moderada (${originalProbability.toFixed(1)}%) de Over 1.5 gols, o que se confirmou no resultado.\n\n`;
    }
  }

  // Adicionar informações da busca web se disponível
  if (webSearchResults && webSearchResults.trim().length > 0) {
    analysis += `## Contexto do Jogo\n\n`;
    analysis += `${webSearchResults}\n\n`;
  }

  return analysis;
}

/**
 * Extrai placar e informações de resultados da busca web
 */
export function parseWebSearchResults(searchResults: string): {
  homeScore: number;
  awayScore: number;
  totalGoals: number;
  context: string;
} {
  // Tentar extrair placar de diferentes formatos
  const scorePatterns = [
    /(\d+)\s*[-x×]\s*(\d+)/i, // "2-1", "2 x 1", "2×1"
    /(\d+)\s+(\d+)/, // "2 1"
    /(\d+):(\d+)/, // "2:1"
    /placar[:\s]+(\d+)[\s-]+(\d+)/i, // "placar: 2-1"
    /resultado[:\s]+(\d+)[\s-]+(\d+)/i, // "resultado: 2-1"
  ];

  let homeScore = 0;
  let awayScore = 0;
  let context = searchResults;

  for (const pattern of scorePatterns) {
    const match = searchResults.match(pattern);
    if (match && match[1] && match[2]) {
      const home = parseInt(match[1], 10);
      const away = parseInt(match[2], 10);
      if (!isNaN(home) && !isNaN(away) && home >= 0 && away >= 0 && home <= 20 && away <= 20) {
        homeScore = home;
        awayScore = away;
        break;
      }
    }
  }

  const totalGoals = homeScore + awayScore;

  return {
    homeScore,
    awayScore,
    totalGoals,
    context: searchResults,
  };
}

