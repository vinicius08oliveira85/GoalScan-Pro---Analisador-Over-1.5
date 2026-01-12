-- Atualizar constraint de table_type para aceitar 'geral' e 'standard_for'
-- Esta migração atualiza a constraint CHECK para permitir ambos os tipos de tabela

-- Remover constraint antiga
ALTER TABLE championship_tables 
  DROP CONSTRAINT IF EXISTS championship_tables_table_type_check;

-- Adicionar nova constraint que aceita 'geral' e 'standard_for'
ALTER TABLE championship_tables 
  ADD CONSTRAINT championship_tables_table_type_check 
  CHECK (table_type IN ('geral', 'standard_for'));

