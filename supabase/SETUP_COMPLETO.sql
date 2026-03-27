-- =============================================================================
-- GoalScan Pro — Setup completo do Supabase (script único)
-- =============================================================================
-- Projeto (exemplo): https://supabase.com/dashboard/project/abjzfxucwcvumkuqapkr
-- Execute este arquivo inteiro no SQL Editor do Supabase (uma única execução).
-- É idempotente: pode reexecutar em projetos já parcialmente configurados.
--
-- O que NÃO faz: não remove dados de championships / tabelas (sem DROP CASCADE).
-- Exceção: remove linhas de championship_tables com table_type obsoleto (ver secção 3).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. championships
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS championships (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE championships ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;
COMMENT ON COLUMN championships.uploaded_at IS
  'Data e hora do último upload/atualização da tabela de dados do campeonato';

ALTER TABLE championships ADD COLUMN IF NOT EXISTS fbref_url TEXT;
COMMENT ON COLUMN championships.fbref_url IS
  'URL da página do campeonato no fbref.com para extração automática';

ALTER TABLE championships ADD COLUMN IF NOT EXISTS fbref_table_type TEXT DEFAULT 'geral';
UPDATE championships SET fbref_table_type = 'geral' WHERE fbref_table_type IS NULL;
ALTER TABLE championships ALTER COLUMN fbref_table_type SET DEFAULT 'geral';

ALTER TABLE championships ADD COLUMN IF NOT EXISTS table_format TEXT;
COMMENT ON COLUMN championships.table_format IS
  'Formato da planilha: completa (com xG) ou basica (sem xG). NULL = ainda não detectado.';

ALTER TABLE championships DROP CONSTRAINT IF EXISTS championships_table_format_check;
ALTER TABLE championships
  ADD CONSTRAINT championships_table_format_check
  CHECK (table_format IS NULL OR table_format IN ('completa', 'basica'));

ALTER TABLE championships DROP CONSTRAINT IF EXISTS championships_fbref_table_type_check;
ALTER TABLE championships
  ADD CONSTRAINT championships_fbref_table_type_check
  CHECK (fbref_table_type IN ('geral', 'complement'));

-- NOT NULL só após preencher nulos
ALTER TABLE championships ALTER COLUMN fbref_table_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_championships_nome ON championships (nome);

ALTER TABLE championships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access" ON championships;
CREATE POLICY "Allow anonymous access" ON championships
  FOR ALL USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 2. championship_tables (JSON por tipo: geral | complement)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS championship_tables (
  id TEXT PRIMARY KEY,
  championship_id TEXT NOT NULL REFERENCES championships (id) ON DELETE CASCADE,
  table_type TEXT NOT NULL,
  table_name TEXT NOT NULL,
  table_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE championship_tables DROP CONSTRAINT IF EXISTS championship_tables_table_type_check;
DELETE FROM championship_tables
WHERE table_type IS NOT NULL AND table_type NOT IN ('geral', 'complement');
ALTER TABLE championship_tables
  ADD CONSTRAINT championship_tables_table_type_check
  CHECK (table_type IN ('geral', 'complement'));
COMMENT ON CONSTRAINT championship_tables_table_type_check ON championship_tables IS
  'Aceita apenas os tipos de tabela: geral e complement';

ALTER TABLE championship_tables ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE championship_tables ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_championship_tables_championship_id ON championship_tables (championship_id);
CREATE INDEX IF NOT EXISTS idx_championship_tables_table_type ON championship_tables (table_type);

ALTER TABLE championship_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access" ON championship_tables;
CREATE POLICY "Allow anonymous access" ON championship_tables
  FOR ALL USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 3. championship_teams (normalizada: Home / Away + extra_fields)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS championship_teams (
  id TEXT PRIMARY KEY,
  championship_id TEXT NOT NULL REFERENCES championships (id) ON DELETE CASCADE,
  squad TEXT NOT NULL,
  table_name TEXT NOT NULL,
  rk TEXT,
  home_mp TEXT,
  home_w TEXT,
  home_d TEXT,
  home_l TEXT,
  home_gf TEXT,
  home_ga TEXT,
  home_gd TEXT,
  home_pts TEXT,
  home_pts_mp TEXT,
  home_xg TEXT,
  home_xga TEXT,
  home_xgd TEXT,
  home_xgd_90 TEXT,
  away_mp TEXT,
  away_w TEXT,
  away_d TEXT,
  away_l TEXT,
  away_gf TEXT,
  away_ga TEXT,
  away_gd TEXT,
  away_pts TEXT,
  away_pts_mp TEXT,
  away_xg TEXT,
  away_xga TEXT,
  away_xgd TEXT,
  away_xgd_90 TEXT,
  extra_fields JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT championship_teams_championship_squad_unique UNIQUE (championship_id, squad)
);

-- Bancos criados por migrações antigas: garantir colunas e padrões
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS rk TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS home_mp TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS home_w TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS home_d TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS home_l TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS home_gf TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS home_ga TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS home_gd TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS home_pts TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS home_pts_mp TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS home_xg TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS home_xga TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS home_xgd TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS home_xgd_90 TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS away_mp TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS away_w TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS away_d TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS away_l TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS away_gf TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS away_ga TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS away_gd TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS away_pts TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS away_pts_mp TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS away_xg TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS away_xga TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS away_xgd TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS away_xgd_90 TEXT;
ALTER TABLE championship_teams ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}'::JSONB;

ALTER TABLE championship_teams ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE championship_teams ALTER COLUMN updated_at SET DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'championship_teams'
      AND constraint_name = 'championship_teams_championship_squad_unique'
  ) THEN
    ALTER TABLE championship_teams
      ADD CONSTRAINT championship_teams_championship_squad_unique
      UNIQUE (championship_id, squad);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_championship_teams_championship_id ON championship_teams (championship_id);
CREATE INDEX IF NOT EXISTS idx_championship_teams_squad ON championship_teams (squad);
CREATE INDEX IF NOT EXISTS idx_championship_teams_table_name ON championship_teams (table_name);

ALTER TABLE championship_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access" ON championship_teams;
CREATE POLICY "Allow anonymous access" ON championship_teams
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE championship_teams IS
  'Dados normalizados por time (casa/fora); usado pela análise e pelo FBref.';


-- -----------------------------------------------------------------------------
-- 4. championship_complement
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS championship_complement (
  squad TEXT NOT NULL,
  championship_id TEXT NOT NULL REFERENCES championships (id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  pl TEXT,
  age TEXT,
  poss TEXT,
  playing_time_mp TEXT,
  playing_time_starts TEXT,
  playing_time_min TEXT,
  playing_time_90s TEXT,
  performance_gls TEXT,
  performance_ast TEXT,
  performance_g_a TEXT,
  performance_g_pk TEXT,
  performance_pk TEXT,
  performance_pkatt TEXT,
  performance_crdy TEXT,
  performance_crdr TEXT,
  per_90_gls TEXT,
  per_90_ast TEXT,
  per_90_g_a TEXT,
  per_90_g_pk TEXT,
  per_90_g_a_pk TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (championship_id, squad)
);

CREATE INDEX IF NOT EXISTS idx_championship_complement_championship_id ON championship_complement (championship_id);
CREATE INDEX IF NOT EXISTS idx_championship_complement_squad ON championship_complement (squad);

ALTER TABLE championship_complement ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access" ON championship_complement;
CREATE POLICY "Allow anonymous access" ON championship_complement
  FOR ALL USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 5. bank_settings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  total_bank NUMERIC(15, 2) NOT NULL DEFAULT 0,
  base_bank NUMERIC(15, 2),
  currency TEXT NOT NULL DEFAULT 'R$',
  updated_at BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bank_settings ADD COLUMN IF NOT EXISTS base_bank NUMERIC(15, 2);
ALTER TABLE bank_settings ADD COLUMN IF NOT EXISTS leverage NUMERIC(5, 2) DEFAULT 1.0;
UPDATE bank_settings SET leverage = 1.0 WHERE leverage IS NULL;
ALTER TABLE bank_settings ALTER COLUMN leverage SET DEFAULT 1.0;
ALTER TABLE bank_settings ALTER COLUMN leverage SET NOT NULL;

ALTER TABLE bank_settings DROP CONSTRAINT IF EXISTS check_leverage_range;
ALTER TABLE bank_settings
  ADD CONSTRAINT check_leverage_range CHECK (leverage >= 0.1 AND leverage <= 10.0);

CREATE INDEX IF NOT EXISTS idx_bank_settings_id ON bank_settings (id);

ALTER TABLE bank_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access" ON bank_settings;
CREATE POLICY "Allow anonymous access" ON bank_settings
  FOR ALL USING (true) WITH CHECK (true);

INSERT INTO bank_settings (id, total_bank, base_bank, currency, updated_at, leverage)
VALUES (
  'default',
  0,
  NULL,
  'R$',
  (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  1.0
)
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 6. saved_analyses
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_analyses (
  id TEXT PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  match_data JSONB NOT NULL,
  analysis_result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE saved_analyses ADD COLUMN IF NOT EXISTS bet_info JSONB;
COMMENT ON COLUMN saved_analyses.bet_info IS
  'Informações da aposta (valor, odd, retorno, lucro, status pending/won/lost).';

ALTER TABLE saved_analyses ADD COLUMN IF NOT EXISTS selected_bets JSONB;
COMMENT ON COLUMN saved_analyses.selected_bets IS
  'Apostas Over/Under selecionadas ao salvar a partida.';

ALTER TABLE saved_analyses ADD COLUMN IF NOT EXISTS ai_analysis TEXT;
COMMENT ON COLUMN saved_analyses.ai_analysis IS
  'Markdown completo da análise gerada pela IA (Gemini).';

ALTER TABLE saved_analyses ADD COLUMN IF NOT EXISTS live_score JSONB;
COMMENT ON COLUMN saved_analyses.live_score IS
  'Placar e tempo sincronizado: homeScore, awayScore, minute, status, lastSynced.';

CREATE INDEX IF NOT EXISTS idx_saved_analyses_timestamp ON saved_analyses (timestamp DESC);

ALTER TABLE saved_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access" ON saved_analyses;
CREATE POLICY "Allow anonymous access" ON saved_analyses
  FOR ALL USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 7. Função: detectar formato da planilha (completa vs basica)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION detect_championship_table_format (champ_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  has_xg BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM championship_teams
    WHERE championship_id = champ_id
      AND (
        (home_xg IS NOT NULL AND home_xg NOT IN ('', '0'))
        OR (home_xga IS NOT NULL AND home_xga NOT IN ('', '0'))
        OR (away_xg IS NOT NULL AND away_xg NOT IN ('', '0'))
        OR (away_xga IS NOT NULL AND away_xga NOT IN ('', '0'))
      )
    LIMIT 1
  )
  INTO has_xg;

  IF has_xg THEN
    RETURN 'completa';
  ELSE
    RETURN 'basica';
  END IF;
END;
$$;

COMMENT ON FUNCTION detect_championship_table_format (TEXT) IS
  'Detecta completa (há xG/xGA nos times) ou basica, com base em championship_teams.';


-- -----------------------------------------------------------------------------
-- 8. (Opcional) Preencher table_format em campeonatos que já têm times
-- -----------------------------------------------------------------------------
UPDATE championships c
SET table_format = detect_championship_table_format (c.id)
WHERE c.table_format IS NULL
  AND EXISTS (
    SELECT 1 FROM championship_teams t WHERE t.championship_id = c.id LIMIT 1
  );


-- =============================================================================
-- Fim do setup. (Opcional) Descomente para inspecionar:
-- =============================================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'championships', 'championship_tables', 'championship_teams',
--     'championship_complement', 'bank_settings', 'saved_analyses'
--   )
-- ORDER BY table_name;
