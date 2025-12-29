# Guia de Uso da API do Gemini com Fallback

## Modelos Disponíveis

### Modelos por Versão da API

**⚠️ IMPORTANTE:** Diferentes versões da API têm modelos diferentes disponíveis. O sistema automaticamente usa apenas modelos válidos para cada versão.

#### Versão v1beta ✅
- `gemini-3.0-flash` - Modelo mais recente e rápido (recomendado - padrão)
- `gemini-3.0-pro` - Modelo mais poderoso da versão 3.0
- `gemini-1.5-flash` - Modelo rápido e eficiente (fallback)
- `gemini-1.5-pro` - Modelo mais poderoso para tarefas complexas (fallback)
- `gemini-3-flash-preview` - Modelo preview com recursos avançados (fallback opcional)

#### Versão v1 ✅
- `gemini-3.0-flash` - Modelo mais recente e rápido
- `gemini-3.0-pro` - Modelo mais poderoso da versão 3.0
- `gemini-1.5-flash` - Modelo rápido e eficiente
- ❌ `gemini-1.5-pro` - **NÃO DISPONÍVEL** em v1 (retorna 404)

### Modelos Descontinuados ❌
- `gemini-pro` - **NÃO ESTÁ MAIS DISPONÍVEL** em nenhuma versão (retorna 404)

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
- **Causa:** Nome do modelo incorreto ou modelo não disponível para sua conta/versão da API
- **Solução:** O sistema tenta automaticamente todos os modelos válidos para a versão configurada, e se todos falharem, tenta novamente com a versão alternativa da API, usando apenas modelos válidos para aquela versão específica

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

### Fallback de Modelos e Versões da API (automático)

O sistema implementa um fallback inteligente que respeita os modelos disponíveis em cada versão da API:

**Quando a versão configurada é `v1beta` (padrão):**

1. **Primeiro, tenta modelos válidos em v1beta:**
   - `gemini-3.0-flash` (padrão)
   - `gemini-3.0-pro`
   - `gemini-1.5-flash`
   - `gemini-1.5-pro`
   - `gemini-3-flash-preview` (opcional)

2. **Se todos falharem, tenta modelos válidos em v1:**
   - `gemini-3.0-flash`
   - `gemini-3.0-pro`
   - `gemini-1.5-flash`
   - ⚠️ **NÃO tenta `gemini-1.5-pro`** (não disponível em v1)

**Quando a versão configurada é `v1`:**

1. **Primeiro, tenta modelos válidos em v1:**
   - `gemini-3.0-flash`
   - `gemini-3.0-pro`
   - `gemini-1.5-flash`

2. **Se todos falharem, tenta modelos válidos em v1beta:**
   - `gemini-3.0-flash`
   - `gemini-3.0-pro`
   - `gemini-1.5-flash`
   - `gemini-1.5-pro` (disponível em v1beta)

**Notas importantes:**
- O sistema **automaticamente filtra** modelos que não estão disponíveis em cada versão
- O modelo `gemini-pro` foi descontinuado e não está mais disponível em nenhuma versão
- O modelo `gemini-1.5-pro` **não está disponível** na versão `v1` da API

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

