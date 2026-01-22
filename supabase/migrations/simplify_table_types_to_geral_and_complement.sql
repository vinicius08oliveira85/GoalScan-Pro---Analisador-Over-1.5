-- ============================================================================
-- MIGRAÇÃO: Simplificar tipos de tabela para apenas 'geral' e 'complement'
-- ============================================================================
-- Esta migração remove suporte para tabelas home_away e standard_for,
-- mantendo apenas 'geral' e 'complement' para evitar confusão.
-- ============================================================================

-- 1. Remover constraint antiga se existir
ALTER TABLE championship_tables
  DROP CONSTRAINT IF EXISTS championship_tables_table_type_check;

-- 2. Remover registros com tipos não permitidos (home_away, standard_for, passing_for, gca_for)
-- Isso é necessário porque esses tipos não são mais suportados
DELETE FROM championship_tables
WHERE table_type NOT IN ('geral', 'complement');

-- 3. Adicionar nova constraint que aceita apenas 'geral' e 'complement'
ALTER TABLE championship_tables
  ADD CONSTRAINT championship_tables_table_type_check
  CHECK (table_type IN ('geral', 'complement'));

-- 4. Comentário explicativo
COMMENT ON CONSTRAINT championship_tables_table_type_check ON championship_tables IS
  'Aceita apenas os tipos de tabela: geral e complement';

-- ============================================================================

