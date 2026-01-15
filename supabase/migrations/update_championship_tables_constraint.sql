-- Atualizar constraint de table_type para aceitar apenas as 3 tabelas especificadas
-- Esta migração atualiza a constraint CHECK para permitir: geral, home_away e standard_for

-- Remover constraint antiga
ALTER TABLE championship_tables 
  DROP CONSTRAINT IF EXISTS championship_tables_table_type_check;

-- Adicionar nova constraint que aceita apenas as 3 tabelas: geral, home_away e standard_for
ALTER TABLE championship_tables 
  ADD CONSTRAINT championship_tables_table_type_check 
  CHECK (table_type IN ('geral', 'home_away', 'standard_for'));

