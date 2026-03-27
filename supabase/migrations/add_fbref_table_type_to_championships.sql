-- URL fixa do FBref por campeonato (se ainda não existir) e tipo de tabela a sincronizar
ALTER TABLE championships
  ADD COLUMN IF NOT EXISTS fbref_url TEXT;

ALTER TABLE championships
  ADD COLUMN IF NOT EXISTS fbref_table_type TEXT DEFAULT 'geral';

UPDATE championships
SET fbref_table_type = 'geral'
WHERE fbref_table_type IS NULL;

ALTER TABLE championships
  ALTER COLUMN fbref_table_type SET DEFAULT 'geral';

ALTER TABLE championships
  ALTER COLUMN fbref_table_type SET NOT NULL;

COMMENT ON COLUMN championships.fbref_url IS 'URL da página do campeonato no fbref.com para extração automática';
COMMENT ON COLUMN championships.fbref_table_type IS 'Tipo de tabela FBref a usar na sincronização: geral (padrão) ou complement';

ALTER TABLE championships
  DROP CONSTRAINT IF EXISTS championships_fbref_table_type_check;

ALTER TABLE championships
  ADD CONSTRAINT championships_fbref_table_type_check
  CHECK (fbref_table_type IN ('geral', 'complement'));
