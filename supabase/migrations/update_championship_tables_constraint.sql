-- Atualizar constraint de table_type para aceitar apenas as 3 tabelas especificadas
-- Esta migração atualiza a constraint CHECK para permitir: geral, home_away e standard_for
-- IMPORTANTE: Remove tabelas com tipos não permitidos (passing_for, gca_for) antes de aplicar a constraint

-- Passo 1: Remover constraint antiga
ALTER TABLE championship_tables 
  DROP CONSTRAINT IF EXISTS championship_tables_table_type_check;

-- Passo 2: Remover registros com tipos não permitidos (passing_for e gca_for)
-- Isso é necessário porque esses tipos não são mais suportados
DELETE FROM championship_tables 
WHERE table_type NOT IN ('geral', 'home_away', 'standard_for');

-- Passo 3: Adicionar nova constraint que aceita apenas as 3 tabelas: geral, home_away e standard_for
ALTER TABLE championship_tables 
  ADD CONSTRAINT championship_tables_table_type_check 
  CHECK (table_type IN ('geral', 'home_away', 'standard_for'));

