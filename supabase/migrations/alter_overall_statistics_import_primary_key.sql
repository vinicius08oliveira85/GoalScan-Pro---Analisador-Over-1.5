-- Alterar chave primária da tabela overall_statistics_import para usar squad como chave primária
-- A chave primária será uma combinação de championship_id + squad para garantir unicidade

-- Remover chave primária existente
ALTER TABLE overall_statistics_import DROP CONSTRAINT IF EXISTS overall_statistics_import_pkey;

-- Remover coluna id se não for mais necessária (opcional - manteremos por compatibilidade)
-- ALTER TABLE overall_statistics_import DROP COLUMN IF EXISTS id;

-- Adicionar constraint UNIQUE para championship_id + squad
ALTER TABLE overall_statistics_import 
  ADD CONSTRAINT overall_statistics_import_championship_squad_unique 
  UNIQUE (championship_id, squad);

-- Criar índice único composto para usar como chave primária lógica
CREATE UNIQUE INDEX IF NOT EXISTS idx_overall_statistics_championship_squad 
  ON overall_statistics_import(championship_id, squad);

-- Comentário explicativo
COMMENT ON CONSTRAINT overall_statistics_import_championship_squad_unique ON overall_statistics_import IS 
  'Chave primária lógica: combinação de championship_id + squad garante unicidade de cada equipe por campeonato';

