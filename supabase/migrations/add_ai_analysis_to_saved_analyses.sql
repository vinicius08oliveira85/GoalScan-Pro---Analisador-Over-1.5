-- Adicionar coluna ai_analysis à tabela saved_analyses
-- Esta coluna armazena o markdown completo da análise gerada pela IA

-- Adicionar coluna ai_analysis como TEXT (permite NULL pois é opcional)
ALTER TABLE saved_analyses 
ADD COLUMN IF NOT EXISTS ai_analysis TEXT;

-- Adicionar comentário descritivo na coluna
COMMENT ON COLUMN saved_analyses.ai_analysis IS 'Markdown completo da análise gerada pela IA (Gemini) para a partida';

-- Nota: Esta coluna armazena o texto completo da análise da IA em formato Markdown,
-- incluindo todas as seções: Painel de Resultados e EV, Análise Quantitativa, Sinais a Favor, etc.

