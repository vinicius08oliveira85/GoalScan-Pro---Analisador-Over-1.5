-- Adicionar coluna bet_info à tabela saved_analyses
-- Esta coluna armazena informações sobre apostas associadas às análises

-- Adicionar coluna bet_info como JSONB (permite NULL pois é opcional)
ALTER TABLE saved_analyses 
ADD COLUMN IF NOT EXISTS bet_info JSONB;

-- Adicionar comentário descritivo na coluna
COMMENT ON COLUMN saved_analyses.bet_info IS 'Informações da aposta associada à análise (valor da aposta, odd, retorno potencial, lucro, status: pending/won/lost)';

-- Estrutura esperada do JSON bet_info:
-- {
--   "betAmount": number,      -- Valor da aposta
--   "odd": number,            -- Odd da aposta
--   "potentialReturn": number, -- Retorno potencial
--   "profit": number,         -- Lucro potencial
--   "status": "pending" | "won" | "lost"  -- Status da aposta
-- }

