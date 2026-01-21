-- ============================================================================
-- MIGRAÇÃO: Corrigir Estrutura da Tabela championships
-- ============================================================================
-- Esta migração verifica e adiciona campos faltantes na tabela championships
-- Garante que todos os campos necessários existem e são opcionais
-- ============================================================================

-- 1. Adicionar campo table_format se não existir
ALTER TABLE championships
  ADD COLUMN IF NOT EXISTS table_format TEXT CHECK (table_format IN ('completa', 'basica'));

-- Adicionar comentário descritivo
COMMENT ON COLUMN championships.table_format IS
  'Formato da planilha de dados do campeonato: "completa" (com xG) ou "basica" (sem xG). NULL é permitido para compatibilidade.';

-- 2. Adicionar campo fbref_url se não existir
ALTER TABLE championships
  ADD COLUMN IF NOT EXISTS fbref_url TEXT;

COMMENT ON COLUMN championships.fbref_url IS
  'URL base do campeonato no fbref.com (ex: https://fbref.com/en/comps/11/Serie-A-Stats)';

-- 3. Adicionar campo uploaded_at se não existir
ALTER TABLE championships
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN championships.uploaded_at IS
  'Data e hora do último upload/atualização da tabela de dados do campeonato';

-- 4. Verificar e ajustar constraint de table_format para permitir NULL
-- Remover constraint antiga se existir
ALTER TABLE championships
  DROP CONSTRAINT IF EXISTS championships_table_format_check;

-- Adicionar nova constraint que permite NULL
ALTER TABLE championships
  ADD CONSTRAINT championships_table_format_check
  CHECK (table_format IS NULL OR table_format IN ('completa', 'basica'));

-- ============================================================================
-- VERIFICAÇÃO: Confirmar estrutura da tabela championships
-- ============================================================================

-- Verificar colunas da tabela championships
SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'championships'
ORDER BY ordinal_position;

-- ============================================================================
-- MIGRAÇÃO CONCLUÍDA
-- ============================================================================

