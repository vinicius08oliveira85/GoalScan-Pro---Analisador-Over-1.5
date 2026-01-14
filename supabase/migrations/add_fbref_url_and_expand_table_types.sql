-- Adiciona URL do FBref no campeonato e expande os tipos de tabela suportados
-- - championships.fbref_url: URL base do campeonato no fbref.com
-- - championship_tables.table_type: inclui passing_for e gca_for

ALTER TABLE championships
  ADD COLUMN IF NOT EXISTS fbref_url TEXT;

-- Atualizar constraint de table_type para aceitar os novos tipos
ALTER TABLE championship_tables
  DROP CONSTRAINT IF EXISTS championship_tables_table_type_check;

ALTER TABLE championship_tables
  ADD CONSTRAINT championship_tables_table_type_check
  CHECK (table_type IN ('geral', 'standard_for', 'passing_for', 'gca_for'));


