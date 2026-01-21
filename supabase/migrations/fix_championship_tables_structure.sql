-- ============================================================================
-- MIGRAÇÃO: Corrigir Estrutura da Tabela championship_tables
-- ============================================================================
-- Esta migração verifica e corrige constraints da tabela championship_tables
-- Garante que table_type aceita apenas os valores permitidos
-- ============================================================================

-- 1. Remover constraint antiga se existir
ALTER TABLE championship_tables
  DROP CONSTRAINT IF EXISTS championship_tables_table_type_check;

-- 2. Remover registros com tipos não permitidos (se houver)
-- Isso é necessário porque esses tipos não são mais suportados
DELETE FROM championship_tables
WHERE table_type NOT IN ('geral', 'home_away', 'standard_for');

-- 3. Adicionar nova constraint que aceita apenas os 3 tipos permitidos
ALTER TABLE championship_tables
  ADD CONSTRAINT championship_tables_table_type_check
  CHECK (table_type IN ('geral', 'home_away', 'standard_for'));

-- 4. Garantir que table_data é JSONB e pode ser NULL (para compatibilidade)
-- Se a coluna não existir, criar (mas geralmente já existe)
-- Se for NOT NULL, alterar para permitir NULL temporariamente
DO $$
BEGIN
  -- Verificar se table_data existe e é NOT NULL
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'championship_tables' 
      AND column_name = 'table_data'
      AND is_nullable = 'NO'
  ) THEN
    -- Permitir NULL temporariamente (mas manter NOT NULL como padrão)
    ALTER TABLE championship_tables
      ALTER COLUMN table_data DROP NOT NULL;
  END IF;
END $$;

-- 5. Garantir que created_at e updated_at têm valores padrão
ALTER TABLE championship_tables
  ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE championship_tables
  ALTER COLUMN updated_at SET DEFAULT NOW();

-- ============================================================================
-- VERIFICAÇÃO: Confirmar estrutura da tabela championship_tables
-- ============================================================================

-- Verificar colunas da tabela championship_tables
SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'championship_tables'
ORDER BY ordinal_position;

-- Verificar constraints
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'championship_tables';

-- ============================================================================
-- MIGRAÇÃO CONCLUÍDA
-- ============================================================================

