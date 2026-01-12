# Atualizar Cards e Salvar Apostas Selecionadas

## Objetivo
Atualizar os cards de partidas salvas para refletir a probabilidade selecionada/combinada e salvar as apostas selecionadas quando uma partida for salva.

## Arquivos a Modificar

### 1. `types.ts`
- Adicionar campo `selectedBets?: SelectedBet[]` em `SavedAnalysis`
- Isso permite armazenar quais apostas estavam selecionadas quando a partida foi salva

### 2. `components/AnalysisDashboard.tsx`
- Modificar `handleSaveMatch` ou passar `selectedBets` quando salvar
- Incluir `selectedBets` no objeto `SavedAnalysis` ao salvar

### 3. `App.tsx`
- Modificar `handleSaveMatch` para incluir `selectedBets` do `AnalysisDashboard`
- Passar `selectedBets` como prop para `AnalysisDashboard` ou capturar no momento do save

### 4. `components/MatchCardList.tsx`
- Criar função para calcular probabilidade exibida baseada em `selectedBets` salvos
- Se `match.selectedBets` existir e tiver 1 aposta: usar probabilidade da aposta
- Se `match.selectedBets` existir e tiver 2 apostas: calcular probabilidade combinada
- Caso contrário: usar `getPrimaryProbability(match.result)` (comportamento atual)

### 5. `components/MatchCardCompact.tsx`
- Mesma lógica do MatchCardList: calcular probabilidade baseada em `selectedBets` salvos

### 6. `components/MainScreen.tsx` (se usar probabilidade)
- Mesma lógica: calcular probabilidade baseada em `selectedBets` salvos

## Lógica de Cálculo

### Função auxiliar para calcular probabilidade exibida
```typescript
function getDisplayProbability(match: SavedAnalysis): number {
  if (match.selectedBets && match.selectedBets.length > 0) {
    if (match.selectedBets.length === 1) {
      return match.selectedBets[0].probability;
    } else if (match.selectedBets.length === 2) {
      // Calcular probabilidade combinada
      return (match.selectedBets[0].probability / 100) * (match.selectedBets[1].probability / 100) * 100;
    }
  }
  // Fallback para probabilidade padrão
  return getPrimaryProbability(match.result);
}
```

## Fluxo de Salvamento

1. Usuário seleciona apostas no `AnalysisDashboard`
2. Usuário clica em "Salvar Partida"
3. `handleSaveMatch` captura `selectedBets` atual
4. Inclui `selectedBets` no objeto `SavedAnalysis`
5. Salva no banco/localStorage com as apostas selecionadas

## Fluxo de Exibição

1. Ao carregar partida salva, verifica se há `selectedBets`
2. Se houver, calcula probabilidade baseada nas apostas salvas
3. Exibe probabilidade correta no card
4. Calcula EV com a probabilidade correta (se odd disponível)

## Considerações

- Manter compatibilidade: partidas antigas sem `selectedBets` devem usar probabilidade padrão
- EV nos cards também deve ser recalculado se houver `selectedBets` e odd disponível
- Labels podem ser opcionais nos cards (mostrar apenas probabilidade numérica)

