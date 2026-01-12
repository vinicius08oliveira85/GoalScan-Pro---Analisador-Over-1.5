# Corrigir Salvamento de selectedBets

## Problema Identificado
O campo `selectedBets` não está sendo salvo no Supabase porque:
1. `saveOrUpdateAnalysis` não inclui `selected_bets` no upsert
2. `loadSavedAnalyses` não retorna `selected_bets` ao carregar
3. A tabela `saved_analyses` pode não ter a coluna `selected_bets`
4. A interface `SavedAnalysisRow` não inclui `selected_bets`

## Arquivos a Modificar

### 1. `services/supabaseService.ts`
- Adicionar `selected_bets?: SelectedBet[]` em `SavedAnalysisRow`
- Incluir `selected_bets: analysis.selectedBets` no upsert de `saveOrUpdateAnalysis`
- Incluir `selectedBets: data.selected_bets` no retorno de `saveOrUpdateAnalysis`
- Incluir `selectedBets: row.selected_bets` no retorno de `loadSavedAnalyses`

### 2. `supabase/migrations/add_selected_bets_to_saved_analyses.sql` (NOVO)
- Criar migração para adicionar coluna `selected_bets` como JSONB na tabela `saved_analyses`
- Coluna deve permitir NULL (opcional)

## Estrutura do JSON selected_bets

```json
[
  {
    "line": "0.5",
    "type": "over",
    "probability": 94.0
  },
  {
    "line": "3.5",
    "type": "under",
    "probability": 76.0
  }
]
```

## Considerações

- Manter compatibilidade: partidas antigas sem `selected_bets` devem funcionar normalmente
- O campo é opcional, então não quebra dados existentes
- Usar JSONB no Supabase para armazenar o array de apostas selecionadas

