-- Adicionar campo uploaded_at na tabela championships
-- Este campo rastreia quando a tabela de dados foi enviada/atualizada pela última vez

ALTER TABLE championships 
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE;

-- Adicionar comentário descritivo
COMMENT ON COLUMN championships.uploaded_at IS 
  'Data e hora do último upload/atualização da tabela de dados do campeonato';

