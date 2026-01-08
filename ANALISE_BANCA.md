# Análise do Sistema de Salvamento da Banca

## Resumo Executivo

Este documento analisa como a banca está sendo salva quando:
- Uma aposta é criada
- Uma aposta ganha
- Uma aposta perde
- O valor da aposta é alterado
- Uma aposta é cancelada

## Fluxo de Salvamento

### 1. Quando uma Aposta é Criada (undefined → pending)

**Arquivo:** `App.tsx` - função `handleSaveBetInfo`

**Fluxo:**
1. Usuário cria uma aposta com valor e odd
2. `handleSaveBetInfo` é chamado com o novo `betInfo`
3. Sistema identifica que é uma nova aposta (`isNewBet = true`)
4. Calcula diferença na banca:
   ```typescript
   calculateBankUpdate(undefined, 'pending', betAmount, potentialReturn)
   // Retorna: -betAmount (desconta o valor apostado)
   ```
5. Atualiza a banca:
   ```typescript
   updatedBank = bankSettings.totalBank + bankDifference
   ```
6. Salva no Supabase via `saveSettings` → `saveBankSettings`
7. Salva no localStorage como backup
8. Salva a aposta no banco via `saveMatch` → `saveOrUpdateAnalysis`

**Onde é salvo:**
- **Banca:** Tabela `bank_settings` no Supabase (campo `total_bank`)
- **Aposta:** Tabela `saved_analyses` no Supabase (campo `bet_info` como JSONB)
- **Backup local:** localStorage (`goalscan_bank_settings` e `goalscan_saved`)

### 2. Quando uma Aposta Ganha (pending → won)

**Arquivo:** `App.tsx` - função `handleUpdateBetStatus` → `handleSaveBetInfo`

**Fluxo:**
1. Usuário marca aposta como ganha
2. `handleUpdateBetStatus` é chamado com status 'won'
3. Cria `updatedBetInfo` com novo status e `resultAt`
4. Chama `handleSaveBetInfo(updatedBetInfo, oldBetInfo)`
5. Calcula diferença na banca:
   ```typescript
   calculateBankUpdate('pending', 'won', betAmount, potentialReturn)
   // Retorna: potentialReturn (adiciona o retorno total)
   // Lógica: (potentialReturn - betAmount) - (-betAmount) = potentialReturn
   ```
6. Atualiza a banca:
   ```typescript
   updatedBank = bankSettings.totalBank + potentialReturn
   ```
7. Salva no Supabase e localStorage
8. Salva a aposta atualizada

**Cálculo detalhado:**
- Impacto quando pending: `-betAmount`
- Impacto quando won: `potentialReturn - betAmount`
- Diferença: `(potentialReturn - betAmount) - (-betAmount) = potentialReturn`

### 3. Quando uma Aposta Perde (pending → lost)

**Arquivo:** `App.tsx` - função `handleUpdateBetStatus` → `handleSaveBetInfo`

**Fluxo:**
1. Usuário marca aposta como perdida
2. `handleUpdateBetStatus` é chamado com status 'lost'
3. Calcula diferença na banca:
   ```typescript
   calculateBankUpdate('pending', 'lost', betAmount, potentialReturn)
   // Retorna: 0 (não altera, já estava descontado)
   // Lógica: (-betAmount) - (-betAmount) = 0
   ```
4. Como `bankDifference === 0`, não atualiza a banca
5. Apenas atualiza o status da aposta no banco

**Observação:** A banca já foi descontada quando a aposta foi criada, então não precisa descontar novamente.

### 4. Quando o Valor da Aposta é Alterado

**Arquivo:** `App.tsx` - função `handleSaveBetInfo` (linhas 317-330)

**Fluxo:**
1. Usuário altera o valor de uma aposta existente
2. Sistema detecta mudança: `oldBetAmount !== newBetAmount`
3. Calcula ajuste adicional:
   - Se estava `pending`: `valueChangeAdjustment = oldBetAmount - newBetAmount`
   - Se estava `won`: `valueChangeAdjustment = newPotentialReturn - oldPotentialReturn`
   - Se estava `lost`: não ajusta (já estava descontado)
4. Aplica ajuste junto com a diferença de status

### 5. Quando uma Aposta é Cancelada

**Arquivo:** `App.tsx` - função `handleSaveBetInfo`

**Fluxo:**
1. Usuário cancela uma aposta
2. Calcula diferença na banca:
   ```typescript
   calculateBankUpdate('pending', 'cancelled', betAmount, potentialReturn)
   // Retorna: betAmount (devolve o valor apostado)
   // Lógica: 0 - (-betAmount) = betAmount
   ```
3. Atualiza a banca devolvendo o valor

## Estrutura de Dados

### BetInfo (Armazenado em `saved_analyses.bet_info`)
```typescript
{
  betAmount: number,        // Valor apostado
  odd: number,             // Odd da aposta
  potentialReturn: number, // Retorno potencial (betAmount * odd)
  potentialProfit: number,  // Lucro potencial (potentialReturn - betAmount)
  bankPercentage: number,  // % da banca usado
  status: 'pending' | 'won' | 'lost' | 'cancelled',
  placedAt?: number,       // Timestamp quando apostou
  resultAt?: number        // Timestamp quando resultado saiu
}
```

### BankSettings (Armazenado em `bank_settings`)
```typescript
{
  totalBank: number,       // Banca total atual
  currency: string,        // Moeda (BRL, USD, EUR)
  updatedAt: number        // Última atualização
}
```

## Lógica de Cálculo

### Função `calculateBankUpdate` (utils/bankCalculator.ts)

**Impacto de cada status:**
- `undefined/null`: 0 (sem impacto)
- `pending`: -betAmount (desconta)
- `lost`: -betAmount (já descontado)
- `won`: potentialReturn - betAmount (lucro líquido)
- `cancelled`: 0 (sem impacto)

**Cálculo da diferença:**
```typescript
bankDifference = newImpact - oldImpact
```

**Exemplos:**
1. Nova aposta (undefined → pending, R$ 100):
   - Diferença: -100 - 0 = -100 ✓

2. Aposta ganha (pending → won, R$ 100, odd 2.0):
   - Diferença: (200 - 100) - (-100) = 200 ✓

3. Aposta perde (pending → lost, R$ 100):
   - Diferença: -100 - (-100) = 0 ✓

4. Aposta cancelada (pending → cancelled, R$ 100):
   - Diferença: 0 - (-100) = 100 ✓

## Pontos de Salvamento

### 1. Supabase (Persistência Principal)
- **Tabela:** `bank_settings`
- **Campo:** `total_bank` (NUMERIC)
- **Função:** `saveBankSettings` em `services/supabaseService.ts`
- **Método:** UPSERT (atualiza se existe, cria se não existe)

### 2. localStorage (Backup Local)
- **Chave:** `goalscan_bank_settings`
- **Formato:** JSON stringificado
- **Quando:** Sempre que a banca é atualizada
- **Fallback:** Se Supabase falhar, usa localStorage

### 3. Sincronização com Widgets
- **Função:** `syncBankToWidgets` em `services/widgetSyncService.ts`
- **Quando:** Após salvar no Supabase
- **Propósito:** Atualizar widgets externos (se houver)

## Problemas Identificados e Corrigidos

### 1. ✅ CORRIGIDO: Bug na Atualização de Banca quando Valor Muda
**Localização:** `App.tsx:306-310` (corrigido)

**Problema:** Quando o status da aposta não mudava, mas o valor da aposta mudava, a banca não era atualizada. Por exemplo:
- Aposta pending de R$ 100
- Usuário muda para R$ 150 (ainda pending)
- A banca não era ajustada, causando inconsistência

**Correção:** A lógica agora verifica se há mudança no status OU no valor antes de processar a atualização da banca.

**Status:** ✅ Corrigido

### 2. ⚠️ Race Condition em Múltiplas Atualizações
**Localização:** `App.tsx:340`
```typescript
const updatedBank = bankSettings.totalBank + bankDifference;
```

**Problema:** Se duas atualizações ocorrerem simultaneamente, ambas usam o mesmo `bankSettings.totalBank` como base, causando inconsistência.

**Solução atual:** Há proteção com `isUpdatingBetStatus`, mas não é 100% garantida em cenários de concorrência.

### 2. ⚠️ Falta de Transação Atômica
**Problema:** A atualização da banca e o salvamento da aposta não são atômicos. Se um falhar, o outro pode ter sido executado, causando inconsistência.

**Impacto:** Se `saveSettings` falhar mas `saveMatch` suceder, a aposta será salva mas a banca não será atualizada.

### 3. ✅ Validação de Banca Negativa
**Localização:** `App.tsx:343`
```typescript
totalBank: Math.max(0, Number(updatedBank.toFixed(2)))
```

**Status:** Implementado corretamente - garante que a banca nunca fique negativa.

### 4. ⚠️ Precisão Decimal
**Localização:** `App.tsx:343`
```typescript
Number(updatedBank.toFixed(2))
```

**Problema:** Usa `toFixed(2)` que pode causar problemas de arredondamento em operações múltiplas.

**Sugestão:** Usar biblioteca de precisão decimal (ex: `decimal.js`) para cálculos financeiros.

### 5. ✅ Tratamento de Erros
**Status:** Implementado com fallback para localStorage se Supabase falhar.

## Recomendações

### 1. Implementar Lock/Optimistic Locking
Para evitar race conditions, implementar um sistema de lock ou usar versionamento (optimistic locking) na tabela `bank_settings`.

### 2. Adicionar Logs de Auditoria
Criar uma tabela de histórico de transações da banca para rastreabilidade:
```sql
CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id TEXT REFERENCES saved_analyses(id),
  old_status TEXT,
  new_status TEXT,
  bet_amount NUMERIC,
  potential_return NUMERIC,
  bank_difference NUMERIC,
  old_bank NUMERIC,
  new_bank NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Melhorar Precisão Decimal
Usar `decimal.js` ou similar para cálculos financeiros precisos.

### 4. Adicionar Validações Adicionais
- Validar que `betAmount > 0` antes de processar
- Validar que `potentialReturn >= betAmount`
- Validar que a banca tem saldo suficiente antes de criar aposta

### 5. Implementar Testes de Integração
Criar testes que simulem o fluxo completo:
- Criar aposta → verificar banca descontada
- Marcar como ganha → verificar banca atualizada
- Marcar como perdida → verificar banca não alterada
- Cancelar aposta → verificar banca devolvida

## Conclusão

O sistema de salvamento da banca está **funcionalmente correto**, mas possui algumas áreas que podem ser melhoradas:

1. ✅ **Lógica de cálculo:** Correta e bem testada
2. ✅ **Persistência:** Implementada com fallback
3. ⚠️ **Concorrência:** Pode ter problemas em cenários de múltiplas atualizações simultâneas
4. ⚠️ **Precisão:** Pode ter problemas de arredondamento em operações múltiplas
5. ✅ **Validação:** Implementada para evitar banca negativa

**Status Geral:** ✅ Funcional, mas com melhorias recomendadas para produção em escala.

