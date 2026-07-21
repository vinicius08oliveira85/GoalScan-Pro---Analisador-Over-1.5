-- ============================================================================
-- GoalScan Pro — Migração completa: estrutura do banco de dados
-- ============================================================================
-- Data: 2026-07-21
-- Uso: Supabase Dashboard → SQL Editor → colar e executar
-- Princípio: IDEMPOTENTE — seguro executar múltiplas vezes (não apaga dados)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. championships
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.championships (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_at TIMESTAMPTZ,
  table_format TEXT,
  fbref_url TEXT
);

-- Constraints idempotentes
DO $$ BEGIN
  ALTER TABLE public.championships
    ADD CONSTRAINT championships_table_format_check
    CHECK (table_format IS NULL OR table_format IN ('completa', 'basica'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Colunas que podem faltar em DBs antigos
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS table_format TEXT;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS fbref_url TEXT;

CREATE INDEX IF NOT EXISTS idx_championships_nome ON public.championships (nome);

COMMENT ON TABLE public.championships IS 'Campeonatos cadastrados pelo usuário';
COMMENT ON COLUMN public.championships.table_format IS 'completa (com xG) ou basica (sem xG)';
COMMENT ON COLUMN public.championships.fbref_url IS 'URL da página do campeonato no FBref';

-- ============================================================================
-- 2. championship_tables (JSONB snapshot: geral + complement)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.championship_tables (
  id TEXT PRIMARY KEY,
  championship_id TEXT NOT NULL REFERENCES public.championships (id) ON DELETE CASCADE,
  table_type TEXT NOT NULL,
  table_name TEXT NOT NULL,
  table_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.championship_tables
    ADD CONSTRAINT championship_tables_table_type_check
    CHECK (table_type IN ('geral', 'complement'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_championship_tables_championship_id
  ON public.championship_tables (championship_id);
CREATE INDEX IF NOT EXISTS idx_championship_tables_table_type
  ON public.championship_tables (table_type);
CREATE INDEX IF NOT EXISTS idx_championship_tables_champ_type
  ON public.championship_tables (championship_id, table_type);

COMMENT ON TABLE public.championship_tables IS 'Dados extraídos do FBref em JSONB (tabela geral e complemento)';
COMMENT ON COLUMN public.championship_tables.table_type IS 'geral = classificação, complement = Playing Time/Performance/Per 90';
COMMENT ON COLUMN public.championship_tables.table_data IS 'Array de objetos JSON (TableRowGeral[] ou TableRowComplement[])';

-- ============================================================================
-- 3. championship_teams (times normalizados Home/Away + standing_*)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.championship_teams (
  id TEXT PRIMARY KEY,
  championship_id TEXT NOT NULL REFERENCES public.championships (id) ON DELETE CASCADE,
  squad TEXT NOT NULL,
  table_name TEXT NOT NULL,
  rk TEXT,

  home_mp TEXT, home_w TEXT, home_d TEXT, home_l TEXT,
  home_gf TEXT, home_ga TEXT, home_gd TEXT,
  home_pts TEXT, home_pts_mp TEXT,
  home_xg TEXT, home_xga TEXT, home_xgd TEXT, home_xgd_90 TEXT,

  away_mp TEXT, away_w TEXT, away_d TEXT, away_l TEXT,
  away_gf TEXT, away_ga TEXT, away_gd TEXT,
  away_pts TEXT, away_pts_mp TEXT,
  away_xg TEXT, away_xga TEXT, away_xgd TEXT, away_xgd_90 TEXT,

  standing_mp TEXT, standing_w TEXT, standing_d TEXT, standing_l TEXT,
  standing_gf TEXT, standing_ga TEXT, standing_gd TEXT,
  standing_pts TEXT, standing_pts_per_mp TEXT, standing_last_5 TEXT,
  standing_attendance TEXT,

  top_team_scorer TEXT, goalkeeper TEXT, notes TEXT, status_b TEXT,

  extra_fields JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT championship_teams_championship_squad_unique UNIQUE (championship_id, squad)
);

-- Colunas que podem faltar
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS home_xg TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS home_xga TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS home_xgd TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS home_xgd_90 TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS away_xg TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS away_xga TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS away_xgd TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS away_xgd_90 TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS standing_mp TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS standing_w TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS standing_d TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS standing_l TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS standing_gf TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS standing_ga TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS standing_gd TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS standing_pts TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS standing_pts_per_mp TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS standing_last_5 TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS standing_attendance TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS top_team_scorer TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS goalkeeper TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS status_b TEXT;
ALTER TABLE public.championship_teams ADD COLUMN IF NOT EXISTS extra_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_championship_teams_championship_id
  ON public.championship_teams (championship_id);
CREATE INDEX IF NOT EXISTS idx_championship_teams_squad
  ON public.championship_teams (squad);
CREATE INDEX IF NOT EXISTS idx_championship_teams_champ_squad
  ON public.championship_teams (championship_id, squad);

COMMENT ON TABLE public.championship_teams IS 'Times normalizados: um registro por time com stats Home/Away e standing_* agregadas';
COMMENT ON COLUMN public.championship_teams.extra_fields IS 'Metadados extras dinâmicos (JSONB)';

-- ============================================================================
-- 4. championship_complement (Posse, Performance, Per 90 Minutes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.championship_complement (
  championship_id TEXT NOT NULL REFERENCES public.championships (id) ON DELETE CASCADE,
  squad TEXT NOT NULL,
  table_name TEXT NOT NULL,
  pl TEXT, age TEXT, poss TEXT,
  playing_time_mp TEXT, playing_time_starts TEXT, playing_time_min TEXT, playing_time_90s TEXT,
  performance_gls TEXT, performance_ast TEXT, performance_g_a TEXT, performance_g_pk TEXT,
  performance_pk TEXT, performance_pkatt TEXT, performance_crdy TEXT, performance_crdr TEXT,
  per_90_gls TEXT, per_90_ast TEXT, per_90_g_a TEXT, per_90_g_pk TEXT, per_90_g_a_pk TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (championship_id, squad)
);

CREATE INDEX IF NOT EXISTS idx_championship_complement_championship_id
  ON public.championship_complement (championship_id);

COMMENT ON TABLE public.championship_complement IS 'Dados complementares do FBref: Playing Time, Performance, Per 90 Minutes';

-- ============================================================================
-- 5. saved_analyses (análises salvas com aposta)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.saved_analyses (
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

-- Colunas que podem faltar
ALTER TABLE public.saved_analyses ADD COLUMN IF NOT EXISTS bet_info JSONB;
ALTER TABLE public.saved_analyses ADD COLUMN IF NOT EXISTS selected_bets JSONB;
ALTER TABLE public.saved_analyses ADD COLUMN IF NOT EXISTS ai_analysis TEXT;
ALTER TABLE public.saved_analyses ADD COLUMN IF NOT EXISTS live_score JSONB;

CREATE INDEX IF NOT EXISTS idx_saved_analyses_timestamp
  ON public.saved_analyses (timestamp DESC);

COMMENT ON TABLE public.saved_analyses IS 'Análises salvas com dados da partida, resultado e aposta';
COMMENT ON COLUMN public.saved_analyses.match_data IS 'Snapshot do MatchData (tabelas, stats, times)';
COMMENT ON COLUMN public.saved_analyses.analysis_result IS 'Snapshot do AnalysisResult (Poisson, EV, probabilidades)';

-- ============================================================================
-- 6. bank_settings (configuração da banca — registro único id=default)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bank_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  total_bank NUMERIC(15, 2) NOT NULL DEFAULT 0,
  base_bank NUMERIC(15, 2),
  leverage NUMERIC(5, 2) NOT NULL DEFAULT 1.0,
  currency TEXT NOT NULL DEFAULT 'R$',
  updated_at BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.bank_settings
    ADD CONSTRAINT check_leverage_range CHECK (leverage >= 0.1 AND leverage <= 10.0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.bank_settings ADD COLUMN IF NOT EXISTS base_bank NUMERIC(15, 2);
ALTER TABLE public.bank_settings ADD COLUMN IF NOT EXISTS leverage NUMERIC(5, 2) NOT NULL DEFAULT 1.0;

-- Inserir registro default se não existir
INSERT INTO public.bank_settings (id, total_bank, base_bank, leverage, currency, updated_at)
VALUES ('default', 0, NULL, 1.0, 'R$', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.bank_settings IS 'Configuração da banca (registro único id=default)';

-- ============================================================================
-- 7. bank_transactions (ledger atômico de movimentos de banca)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  bet_id TEXT NOT NULL REFERENCES public.saved_analyses (id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
  type TEXT NOT NULL CHECK (type IN ('DEBIT', 'CREDIT', 'PROFIT')),
  balance_after NUMERIC(15, 2) NOT NULL,
  transaction_type TEXT,
  signed_delta NUMERIC(15, 2),
  old_bank_balance NUMERIC(15, 2),
  new_bank_balance NUMERIC(15, 2),
  bet_info_snapshot JSONB,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Colunas de auditoria que podem faltar
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT;
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS signed_delta NUMERIC(15, 2);
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS old_bank_balance NUMERIC(15, 2);
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS new_bank_balance NUMERIC(15, 2);
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS bet_info_snapshot JSONB;
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_bet_id
  ON public.bank_transactions (bet_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_created_at
  ON public.bank_transactions (created_at DESC);

COMMENT ON TABLE public.bank_transactions IS 'Ledger atômico de movimentos de banca por aposta';
COMMENT ON COLUMN public.bank_transactions.type IS 'DEBIT (reduz), CREDIT (aumenta), PROFIT (lucro líquido)';
COMMENT ON COLUMN public.bank_transactions.balance_after IS 'Saldo da banca após esta transação';

-- ============================================================================
-- 8. RPC: process_bet_transaction (transação atômica de banca)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_bet_transaction (
  p_settings_id TEXT,
  p_bet_id TEXT,
  p_signed_delta NUMERIC,
  p_tx_type TEXT,
  p_tx_amount NUMERIC,
  p_bet_info JSONB,
  p_increment_leverage_day BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.bank_settings%ROWTYPE;
  v_current NUMERIC(15, 2);
  v_new NUMERIC(15, 2);
  v_final_bet JSONB;
  v_day INT;
  v_updated INT;
BEGIN
  IF p_settings_id IS NULL OR p_bet_id IS NULL THEN
    RAISE EXCEPTION 'settings_id e bet_id são obrigatórios';
  END IF;

  IF p_tx_type IS NULL OR p_tx_type NOT IN ('DEBIT', 'CREDIT', 'PROFIT') THEN
    RAISE EXCEPTION 'Tipo de transação inválido: %', p_tx_type;
  END IF;

  SELECT * INTO v_row FROM public.bank_settings WHERE id = p_settings_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bank_settings não encontrado: %', p_settings_id;
  END IF;

  v_current := COALESCE(v_row.total_bank, 0);

  IF COALESCE(p_signed_delta, 0) IS DISTINCT FROM 0 THEN
    IF p_tx_amount IS NULL OR p_tx_amount < 0 THEN
      RAISE EXCEPTION 'p_tx_amount deve ser >= 0 quando há movimento de saldo';
    END IF;

    v_new := v_current + p_signed_delta;

    IF v_new < 0 THEN
      RAISE EXCEPTION 'Saldo insuficiente (saldo %, delta %)', v_current, p_signed_delta;
    END IF;

    UPDATE public.bank_settings
    SET
      total_bank = v_new,
      updated_at = (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT
    WHERE id = p_settings_id;

    INSERT INTO public.bank_transactions (bet_id, amount, type, balance_after, transaction_type, signed_delta, old_bank_balance, new_bank_balance)
    VALUES (p_bet_id, p_tx_amount, p_tx_type, v_new, p_tx_type, p_signed_delta, v_current, v_new);
  ELSE
    v_new := v_current;
  END IF;

  v_final_bet := p_bet_info;
  IF COALESCE(p_increment_leverage_day, FALSE) THEN
    v_day := COALESCE((p_bet_info->>'leverageProgressionDay')::INT, 0);
    v_final_bet := jsonb_set(
      p_bet_info,
      '{leverageProgressionDay}',
      to_jsonb(v_day + 1),
      TRUE
    );
  END IF;

  UPDATE public.saved_analyses
  SET
    bet_info = v_final_bet,
    updated_at = NOW()
  WHERE id = p_bet_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'saved_analyses não encontrado: %', p_bet_id;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'balance_after', v_new,
    'signed_delta', p_signed_delta,
    'bet_info', v_final_bet
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_bet_transaction (TEXT, TEXT, NUMERIC, TEXT, NUMERIC, JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_bet_transaction (TEXT, TEXT, NUMERIC, TEXT, NUMERIC, JSONB, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.process_bet_transaction (TEXT, TEXT, NUMERIC, TEXT, NUMERIC, JSONB, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_bet_transaction (TEXT, TEXT, NUMERIC, TEXT, NUMERIC, JSONB, BOOLEAN) TO service_role;

-- ============================================================================
-- 9. RPC: detect_championship_table_format
-- ============================================================================
CREATE OR REPLACE FUNCTION public.detect_championship_table_format (
  champ_id TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_has_xg BOOLEAN := FALSE;
BEGIN
  -- Verificar se há dados na tabela geral com xG
  FOR v_row IN
    SELECT table_data
    FROM public.championship_tables
    WHERE championship_id = champ_id
      AND table_type = 'geral'
    LIMIT 1
  LOOP
    IF v_row.table_data IS NOT NULL AND jsonb_array_length(v_row.table_data) > 0 THEN
      v_has_xg := (
        v_row.table_data->0 ? 'Home xG'
        OR v_row.table_data->0 ? 'xG'
        OR v_row.table_data->0 ? 'Away xG'
      );
    END IF;
  END LOOP;

  -- Também verificar championship_teams
  IF NOT v_has_xg THEN
    SELECT EXISTS(
      SELECT 1 FROM public.championship_teams
      WHERE championship_id = champ_id
        AND (home_xg IS NOT NULL AND home_xg != '' AND home_xg != '0')
      LIMIT 1
    ) INTO v_has_xg;
  END IF;

  IF v_has_xg THEN
    RETURN 'completa';
  ELSE
    RETURN 'basica';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.detect_championship_table_format (TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_championship_table_format (TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.detect_championship_table_format (TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_championship_table_format (TEXT) TO service_role;

-- ============================================================================
-- 10. RLS (Row Level Security) — app usa anon key
-- ============================================================================
ALTER TABLE public.championships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championship_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championship_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championship_complement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas (app usa anon key, sem auth)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow anonymous access" ON public.championships;
  DROP POLICY IF EXISTS "Allow anonymous access" ON public.championship_tables;
  DROP POLICY IF EXISTS "Allow anonymous access" ON public.championship_teams;
  DROP POLICY IF EXISTS "Allow anonymous access" ON public.championship_complement;
  DROP POLICY IF EXISTS "Allow anonymous access" ON public.saved_analyses;
  DROP POLICY IF EXISTS "Allow anonymous access" ON public.bank_settings;
  DROP POLICY IF EXISTS "Allow anonymous access" ON public.bank_transactions;
END $$;

CREATE POLICY "Allow anonymous access" ON public.championships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous access" ON public.championship_tables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous access" ON public.championship_teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous access" ON public.championship_complement FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous access" ON public.saved_analyses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous access" ON public.bank_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous access" ON public.bank_transactions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 11. Views úteis para debug
-- ============================================================================

-- View: resumo dos campeonados com contagem de tabelas e times
CREATE OR REPLACE VIEW public.v_championship_summary AS
SELECT
  c.id,
  c.nome,
  c.table_format,
  c.fbref_url,
  c.created_at,
  (SELECT COUNT(*) FROM public.championship_teams ct WHERE ct.championship_id = c.id) AS team_count,
  (SELECT COUNT(*) FROM public.championship_tables ct WHERE ct.championship_id = c.id AND ct.table_type = 'geral') AS geral_tables,
  (SELECT COUNT(*) FROM public.championship_tables ct WHERE ct.championship_id = c.id AND ct.table_type = 'complement') AS complement_tables,
  (SELECT COUNT(*) FROM public.championship_complement cc WHERE cc.championship_id = c.id) AS complement_teams
FROM public.championships c
ORDER BY c.created_at DESC;

COMMENT ON VIEW public.v_championship_summary IS 'Resumo: quantos times, tabelas e complementos por campeonado';

-- View: verificar dados de um time específico
CREATE OR REPLACE VIEW public.v_team_data AS
SELECT
  ct.championship_id,
  c.nome AS championship_name,
  ct.squad,
  ct.rk,
  ct.home_mp, ct.home_gf, ct.home_ga, ct.home_xg, ct.home_xga,
  ct.away_mp, ct.away_gf, ct.away_ga, ct.away_xg, ct.away_xga,
  ct.standing_mp, ct.standing_gf, ct.standing_ga, ct.standing_pts,
  ct.extra_fields
FROM public.championship_teams ct
JOIN public.championships c ON c.id = ct.championship_id
ORDER BY c.nome, ct.rk;

COMMENT ON VIEW public.v_team_data IS 'Dados normalizados de todos os times com nome do campeonado';

-- View: resumo financeiro
CREATE OR REPLACE VIEW public.v_bank_summary AS
SELECT
  bs.total_bank,
  bs.base_bank,
  bs.leverage,
  bs.currency,
  (SELECT COUNT(*) FROM public.saved_analyses sa WHERE sa.bet_info IS NOT NULL) AS total_bets,
  (SELECT COUNT(*) FROM public.bank_transactions bt WHERE bt.type = 'DEBIT') AS total_debits,
  (SELECT COUNT(*) FROM public.bank_transactions bt WHERE bt.type = 'PROFIT') AS total_profits,
  (SELECT COALESCE(SUM(bt.amount), 0) FROM public.bank_transactions bt WHERE bt.type = 'PROFIT') AS total_profit_amount
FROM public.bank_settings bs
WHERE bs.id = 'default';

COMMENT ON VIEW public.v_bank_summary IS 'Resumo financeiro: saldo, alavancagem, contadores';

-- ============================================================================
-- Fim. Todas as 7 tabelas, 2 RPC functions, 3 views e RLS criados/atualizados.
-- ============================================================================

COMMIT;
