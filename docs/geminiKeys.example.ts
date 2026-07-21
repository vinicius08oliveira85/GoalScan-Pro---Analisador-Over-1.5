/**
 * EXEMPLO DE USO DO UTILITÁRIO DE FALLBACK DO GEMINI
 *
 * Este arquivo mostra como usar o utilitário geminiKeys.ts
 * para fazer chamadas à API do Gemini com fallback automático.
 */

import { callWithFallback, isQuotaExceededError } from './geminiKeys';

/**
 * Exemplo 1: Chamada simples à API do Gemini com fallback automático
 */
export async function exemploChamadaGemini(prompt: string) {
  try {
    const resultado = await callWithFallback(
      async (apiKey: string) => {
        // Sua chamada à API do Gemini aqui
        // Modelos disponíveis: gemini-3.0-flash, gemini-3.0-pro, gemini-1.5-flash, gemini-1.5-pro
        // NÃO use: gemini-1.5-flash-latest (não existe), gemini-2.0-flash (não existe) ou gemini-pro (descontinuado)
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: prompt,
                    },
                  ],
                },
              ],
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || `HTTP ${response.status}`);
        }

        return await response.json();
      },
      {
        onKeySwitch: (fromKey, toKey) => {
          console.log(
            `[Gemini] Trocando de chave: ${fromKey.substring(0, 10)}... -> ${toKey.substring(0, 10)}...`
          );
        },
        onError: (error, keyIndex) => {
          console.warn(`[Gemini] Erro na chave ${keyIndex + 1}:`, error.message);
        },
      }
    );

    return resultado;
  } catch (error: unknown) {
    if (isQuotaExceededError(error)) {
      console.error('[Gemini] Todas as chaves atingiram quota. Usando fallback local.');
      // Retornar análise local ou null
      return null;
    }
    throw error;
  }
}

/**
 * Exemplo 2: Verificar se há chaves configuradas antes de fazer chamada
 */
import { hasGeminiKeys, getGeminiApiKeys } from './geminiKeys';

export async function exemploComVerificacao(prompt: string) {
  if (!hasGeminiKeys()) {
    console.warn('[Gemini] Nenhuma chave configurada. Usando análise local.');
    return null;
  }

  const keys = getGeminiApiKeys();
  console.log(`[Gemini] ${keys.length} chave(s) disponível(is)`);

  return await exemploChamadaGemini(prompt);
}
