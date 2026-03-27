-- Idempotente: garante colunas de sincronização FBref em championships
-- (útil se migrações anteriores não foram aplicadas na ordem esperada)

ALTER TABLE championships ADD COLUMN IF NOT EXISTS fbref_url TEXT;
COMMENT ON COLUMN championships.fbref_url IS
  'URL da página do campeonato no fbref.com para extração automática';

ALTER TABLE championships ADD COLUMN IF NOT EXISTS fbref_table_type TEXT DEFAULT 'geral';
UPDATE championships SET fbref_table_type = 'geral' WHERE fbref_table_type IS NULL;
ALTER TABLE championships ALTER COLUMN fbref_table_type SET DEFAULT 'geral';

ALTER TABLE championships DROP CONSTRAINT IF EXISTS championships_fbref_table_type_check;
ALTER TABLE championships
  ADD CONSTRAINT championships_fbref_table_type_check
  CHECK (fbref_table_type IN ('geral', 'complement'));

ALTER TABLE championships ALTER COLUMN fbref_table_type SET NOT NULL;

COMMENT ON COLUMN championships.fbref_table_type IS
  'Tipo de tabela FBref na sincronização: geral (classificação) ou complement (standard_for)';
