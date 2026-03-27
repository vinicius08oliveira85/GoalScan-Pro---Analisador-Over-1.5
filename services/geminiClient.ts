import { GoogleGenerativeAI } from "@google/generative-ai";
import { MatchData, AnalysisResult } from "../types";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export const analyzeMatchWithGemini = async (match: MatchData): Promise<AnalysisResult> => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Analise tecnicamente o confronto: ${match.homeTeam} vs ${match.awayTeam}.
    DADOS:
    - Médias de Gols: Casa (${match.homeStats.avgGols}), Fora (${match.awayStats.avgGols})
    - Histórico Recente (Gols): Casa [${match.homeStats.last5.join(', ')}], Fora [${match.awayStats.last5.join(', ')}]
    - H2H: ${match.h2h.results.join(', ')}

    Retorne APENAS um objeto JSON com estas chaves:
    {
      "probabilities": { "over05HT": number, "over15": number, "over25": number, "under35": number, "btts": number },
      "justification": "string",
      "confidenceScore": number
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extração segura de JSON para evitar quebras por texto extra da IA
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("A IA não retornou um formato válido.");
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Erro no Gemini Client:", error);
    throw error;
  }
};