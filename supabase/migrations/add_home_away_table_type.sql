-- Adiciona suporte para tabela home_away no constraint de table_type
-- Esta migration expande os tipos de tabela suportados para incluir 'home_away'

ALTER TABLE championship_tables
  DROP CONSTRAINT IF EXISTS championship_tables_table_type_check;

ALTER TABLE championship_tables
  ADD CONSTRAINT championship_tables_table_type_check
  CHECK (table_type IN ('geral', 'home_away', 'standard_for', 'passing_for', 'gca_for'));
