-- ============================================================================
-- GoalScan Pro — schema completo em um único script (Supabase / PostgreSQL)
-- ============================================================================
-- Uso: Supabase Dashboard → SQL Editor → colar e executar (projeto novo).
-- Remove tabelas existentes com CASCADE (apaga dados). Faça backup se precisar.
--
-- Inclui: campeonatos, tabelas JSON, times normalizados (Home/Away + standing_*),
--         complemento legado, análises salvas, banca.
-- Não inclui: bank_transactions / RPC com auth.users (fluxo multi-usuário opcional).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Limpeza (ordem: dependentes primeiro)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.championship_complement CASCADE;
DROP TABLE IF EXISTS public.championship_teams CASCADE;
DROP TABLE IF EXISTS public.championship_tables CASCADE;
DROP TABLE IF EXISTS public.championships CASCADE;
DROP TABLE IF EXISTS public.saved_analyses CASCADE;
DROP TABLE IF EXISTS public.bank_settings CASCADE;

-- ---------------------------------------------------------------------------
-- championships
-- ---------------------------------------------------------------------------
CREATE TABLE public.championships (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_at TIMESTAMPTZ,
  table_format TEXT,
  fbref_url TEXT,
  CONSTRAINT championships_table_format_check
    CHECK (table_format IS NULL OR table_format IN ('completa', 'basica'))
);

CREATE INDEX IF NOT EXISTS idx_championships_nome ON public.championships (nome);

COMMENT ON COLUMN public.championships.table_format IS 'completa (xG) ou basica';
COMMENT ON COLUMN public.championships.fbref_url IS 'Legado opcional; app atual usa null';
COMMENT ON COLUMN public.championships.uploaded_at IS 'Último upload da classificação';

-- ---------------------------------------------------------------------------
-- championship_tables (snapshot JSONB: geral e opcionalmente complement)
-- ---------------------------------------------------------------------------
CREATE TABLE public.championship_tables (
  id TEXT PRIMARY KEY,
  championship_id TEXT NOT NULL REFERENCES public.championships (id) ON DELETE CASCADE,
  table_type TEXT NOT NULL,
  table_name TEXT NOT NULL,
  table_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT championship_tables_table_type_check
    CHECK (table_type IN ('geral', 'complement'))
);

CREATE INDEX IF NOT EXISTS idx_championship_tables_championship_id
  ON public.championship_tables (championship_id);
CREATE INDEX IF NOT EXISTS idx_championship_tables_table_type
  ON public.championship_tables (table_type);

-- ---------------------------------------------------------------------------
-- championship_teams (legado Home/Away + classificação agregada standing_*)
-- ---------------------------------------------------------------------------
CREATE TABLE public.championship_teams (
  id TEXT PRIMARY KEY,
  championship_id TEXT NOT NULL REFERENCES public.championships (id) ON DELETE CASCADE,
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

  standing_mp TEXT,
  standing_w TEXT,
  standing_d TEXT,
  standing_l TEXT,
  standing_gf TEXT,
  standing_ga TEXT,
  standing_gd TEXT,
  standing_pts TEXT,
  standing_pts_per_mp TEXT,
  standing_last_5 TEXT,
  standing_attendance TEXT,

  top_team_scorer TEXT,
  goalkeeper TEXT,
  notes TEXT,
  status_b TEXT,

  extra_fields JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT championship_teams_championship_squad_unique UNIQUE (championship_id, squad)
);

CREATE INDEX IF NOT EXISTS idx_championship_teams_championship_id
  ON public.championship_teams (championship_id);
CREATE INDEX IF NOT EXISTS idx_championship_teams_squad
  ON public.championship_teams (squad);
CREATE INDEX IF NOT EXISTS idx_championship_teams_table_name
  ON public.championship_teams (table_name);

COMMENT ON TABLE public.championship_teams IS 'Um registro por time; JSON agregado grava standing_* e Lookup_* em extra_fields';
COMMENT ON COLUMN public.championship_teams.extra_fields IS 'Metadados extras (ex.: chaves Lookup_* do JSON de importação)';

-- ---------------------------------------------------------------------------
-- championship_complement (legado; app pode não escrever mais)
-- ---------------------------------------------------------------------------
CREATE TABLE public.championship_complement (
  championship_id TEXT NOT NULL REFERENCES public.championships (id) ON DELETE CASCADE,
  squad TEXT NOT NULL,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (championship_id, squad)
);

CREATE INDEX IF NOT EXISTS idx_championship_complement_championship_id
  ON public.championship_complement (championship_id);

-- ---------------------------------------------------------------------------
-- saved_analyses
-- ---------------------------------------------------------------------------
CREATE TABLE public.saved_analyses (
  id TEXT PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  match_data JSONB NOT NULL,
  analysis_result JSONB NOT NULL,
  bet_info JSONB,
  selected_bets JSONB,
  ai_analysis TEXT,
  live_score JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_analyses_timestamp ON public.saved_analyses (timestamp DESC);

COMMENT ON COLUMN public.saved_analyses.match_data IS 'MatchData (times, tabelas, stats)';
COMMENT ON COLUMN public.saved_analyses.analysis_result IS 'AnalysisResult (Poisson, EV, etc.)';

-- ---------------------------------------------------------------------------
-- bank_settings (registro único id = default; valores como no app: total_bank decimal)
-- ---------------------------------------------------------------------------
CREATE TABLE public.bank_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  total_bank NUMERIC(15, 2) NOT NULL DEFAULT 0,
  base_bank NUMERIC(15, 2),
  leverage NUMERIC(5, 2) NOT NULL DEFAULT 1.0,
  currency TEXT NOT NULL DEFAULT 'R$',
  updated_at BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_leverage_range CHECK (leverage >= 0.1 AND leverage <= 10.0)
);

CREATE INDEX IF NOT EXISTS idx_bank_settings_id ON public.bank_settings (id);

INSERT INTO public.bank_settings (id, total_bank, base_bank, leverage, currency, updated_at)
VALUES (
  'default',
  0,
  NULL,
  1.0,
  'R$',
  (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS (app usa anon key; políticas permissivas — ajuste se tiver auth)
-- ---------------------------------------------------------------------------
ALTER TABLE public.championships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championship_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championship_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championship_complement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous access" ON public.championships;
DROP POLICY IF EXISTS "Allow anonymous access" ON public.championship_tables;
DROP POLICY IF EXISTS "Allow anonymous access" ON public.championship_teams;
DROP POLICY IF EXISTS "Allow anonymous access" ON public.championship_complement;
DROP POLICY IF EXISTS "Allow anonymous access" ON public.saved_analyses;
DROP POLICY IF EXISTS "Allow anonymous access" ON public.bank_settings;

CREATE POLICY "Allow anonymous access" ON public.championships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous access" ON public.championship_tables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous access" ON public.championship_teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous access" ON public.championship_complement FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous access" ON public.saved_analyses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous access" ON public.bank_settings FOR ALL USING (true) WITH CHECK (true);

COMMIT;

-- ============================================================================
-- Fim. Verifique no Table Editor se as 6 tabelas aparecerem.
-- ============================================================================
