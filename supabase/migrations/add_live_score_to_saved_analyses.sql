-- Adiciona coluna live_score à tabela saved_analyses
-- Esta coluna armazena o placar e tempo sincronizado do Google

-- Verificar se a coluna já existe antes de adicionar
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'saved_analyses' 
        AND column_name = 'live_score'
    ) THEN
        ALTER TABLE saved_analyses 
        ADD COLUMN live_score JSONB;
        
        COMMENT ON COLUMN saved_analyses.live_score IS 
        'Placar e tempo sincronizado do Google: {homeScore, awayScore, minute, status, lastSynced}';
    END IF;
END $$;

