# Guia de Uso da API do Gemini com Fallback

## Modelos Disponíveis

### Modelos Válidos ✅
- `gemini-3.0-flash` - Modelo mais recente e rápido (recomendado - padrão)
- `gemini-3.0-pro` - Modelo mais poderoso da versão 3.0
- `gemini-1.5-flash` - Modelo rápido e eficiente (fallback)
- `gemini-1.5-pro` - Modelo mais poderoso para tarefas complexas (fallback)
- `gemini-pro` - Modelo padrão (legado - último fallback)

### Modelos Inválidos ❌
- `gemini-1.5-flash-latest` - **NÃO EXISTE** (retorna 404)
- `gemini-2.0-flash` - **NÃO EXISTE** (retorna 404)
- Modelos com sufixo `-latest` - Não são suportados

## Como Usar o Sistema de Fallback

### Exemplo Básico

```typescript
import { callWithFallback, isQuotaExceededError } from '../utils/geminiKeys';

async function analisarPartida(dados: MatchData) {
  try {
    const resultado = await callWithFallback(async (apiKey: string) => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Analise esta partida: ${JSON.stringify(dados)}`
              }]
            }]
          })
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }

      return await response.json();
    }, {
      onKeySwitch: (fromKey, toKey) => {
        console.log(`[Gemini] Trocando de chave principal para fallback`);
      },
      onError: (error, keyIndex) => {
        console.warn(`[Gemini] Erro na chave ${keyIndex + 1}:`, error.message);
      }
    });

    return resultado;
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      console.error('[Gemini] Todas as chaves atingiram quota. Usando fallback local.');
      // Retornar análise local ou null
      return null;
    }
    throw error;
  }
}
```

## Erros Comuns e Soluções

### 404 - Modelo não encontrado
- **Causa:** Nome do modelo incorreto ou modelo não disponível para sua conta
- **Solução:** O sistema tenta automaticamente: `gemini-3.0-flash` → `gemini-3.0-pro` → `gemini-1.5-flash` → `gemini-1.5-pro` → `gemini-pro`

### 429 - Quota excedida
- **Causa:** Limite de requisições atingido
- **Solução:** O sistema tentará automaticamente a chave fallback

### 403 - Acesso negado
- **Causa:** Chave inválida ou sem permissões
- **Solução:** Verifique a chave no Google AI Studio

## Configuração

### Variáveis de Ambiente

```env
# Chave principal
GEMINI_API_KEY=sua_chave_principal_aqui

# Chave fallback (opcional mas recomendado)
GEMINI_API_KEY_FALLBACK=sua_chave_fallback_aqui
```

### No Vercel

Configure ambas as variáveis em:
- Settings > Environment Variables
- Adicione `GEMINI_API_KEY` e `GEMINI_API_KEY_FALLBACK`
- Selecione todos os ambientes (Production, Preview, Development)

## Como Funciona o Fallback

### Fallback de Modelos (automático)
1. Sistema tenta `gemini-3.0-flash` primeiro (padrão)
2. Se falhar com 404, tenta `gemini-3.0-pro`
3. Se falhar, tenta `gemini-1.5-flash`
4. Se falhar, tenta `gemini-1.5-pro`
5. Se falhar, tenta `gemini-pro` (último recurso)

### Fallback de Chaves API
1. Sistema tenta usar `GEMINI_API_KEY` primeiro
2. Se falhar com erro 404, 429, ou 403, tenta `GEMINI_API_KEY_FALLBACK`
3. Se ambas falharem, retorna erro ou usa análise local (dependendo da implementação)

## Verificação de Erros

O utilitário detecta automaticamente:
- ✅ Erros 429 (quota excedida)
- ✅ Erros 403 (acesso negado)
- ✅ Erros 404 (modelo não encontrado - pode indicar problema de acesso)
- ✅ Mensagens de erro contendo "quota", "rate limit", etc.

