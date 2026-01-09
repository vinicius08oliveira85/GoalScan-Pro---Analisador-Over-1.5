-- Adicionar coluna selected_bets à tabela saved_analyses
-- Esta coluna armazena as apostas Over/Under selecionadas quando a partida foi salva

-- Adicionar coluna selected_bets como JSONB (permite NULL pois é opcional)
ALTER TABLE saved_analyses 
ADD COLUMN IF NOT EXISTS selected_bets JSONB;

-- Adicionar comentário descritivo na coluna
COMMENT ON COLUMN saved_analyses.selected_bets IS 'Array de apostas Over/Under selecionadas quando a partida foi salva. Permite combinar uma aposta Over e uma Under de linhas diferentes.';

-- Estrutura esperada do JSON selected_bets:
-- [
--   {
--     "line": "0.5",           -- Linha da aposta (0.5, 1.5, 2.5, 3.5, 4.5, 5.5)
--     "type": "over",          -- Tipo: "over" ou "under"
--     "probability": 94.0      -- Probabilidade em percentual (0-100)
--   },
--   {
--     "line": "3.5",
--     "type": "under",
--     "probability": 76.0
--   }
-- ]
-- 
-- Nota: O array pode conter até 2 elementos (uma aposta Over e uma Under de linhas diferentes)
-- A probabilidade combinada é calculada multiplicando as probabilidades individuais

