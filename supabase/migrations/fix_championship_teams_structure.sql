-- ============================================================================
-- MIGRAÇÃO: Corrigir Estrutura da Tabela championship_teams
-- ============================================================================
-- Esta migração verifica e garante que todos os campos são opcionais
-- Adiciona campos faltantes se necessário
-- ============================================================================

-- 1. Garantir que campos Home existem e são opcionais
ALTER TABLE championship_teams
  ADD COLUMN IF NOT EXISTS home_mp TEXT,
  ADD COLUMN IF NOT EXISTS home_w TEXT,
  ADD COLUMN IF NOT EXISTS home_d TEXT,
  ADD COLUMN IF NOT EXISTS home_l TEXT,
  ADD COLUMN IF NOT EXISTS home_gf TEXT,
  ADD COLUMN IF NOT EXISTS home_ga TEXT,
  ADD COLUMN IF NOT EXISTS home_gd TEXT,
  ADD COLUMN IF NOT EXISTS home_pts TEXT,
  ADD COLUMN IF NOT EXISTS home_pts_mp TEXT,
  ADD COLUMN IF NOT EXISTS home_xg TEXT,
  ADD COLUMN IF NOT EXISTS home_xga TEXT,
  ADD COLUMN IF NOT EXISTS home_xgd TEXT,
  ADD COLUMN IF NOT EXISTS home_xgd_90 TEXT;

-- 2. Garantir que campos Away existem e são opcionais
ALTER TABLE championship_teams
  ADD COLUMN IF NOT EXISTS away_mp TEXT,
  ADD COLUMN IF NOT EXISTS away_w TEXT,
  ADD COLUMN IF NOT EXISTS away_d TEXT,
  ADD COLUMN IF NOT EXISTS away_l TEXT,
  ADD COLUMN IF NOT EXISTS away_gf TEXT,
  ADD COLUMN IF NOT EXISTS away_ga TEXT,
  ADD COLUMN IF NOT EXISTS away_gd TEXT,
  ADD COLUMN IF NOT EXISTS away_pts TEXT,
  ADD COLUMN IF NOT EXISTS away_pts_mp TEXT,
  ADD COLUMN IF NOT EXISTS away_xg TEXT,
  ADD COLUMN IF NOT EXISTS away_xga TEXT,
  ADD COLUMN IF NOT EXISTS away_xgd TEXT,
  ADD COLUMN IF NOT EXISTS away_xgd_90 TEXT;

-- 3. Garantir que campo extra_fields existe
ALTER TABLE championship_teams
  ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}'::jsonb;

-- 4. Garantir que campo rk existe
ALTER TABLE championship_teams
  ADD COLUMN IF NOT EXISTS rk TEXT;

-- 5. Garantir que campos created_at e updated_at têm valores padrão
ALTER TABLE championship_teams
  ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE championship_teams
  ALTER COLUMN updated_at SET DEFAULT NOW();

-- 6. Verificar constraint UNIQUE - garantir que existe
-- Se não existir, criar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE table_name = 'championship_teams' 
      AND constraint_name = 'championship_teams_championship_squad_unique'
  ) THEN
    ALTER TABLE championship_teams
      ADD CONSTRAINT championship_teams_championship_squad_unique 
      UNIQUE (championship_id, squad);
  END IF;
END $$;

-- ============================================================================
-- VERIFICAÇÃO: Confirmar estrutura da tabela championship_teams
-- ============================================================================

-- Verificar colunas da tabela championship_teams
SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'championship_teams'
ORDER BY ordinal_position;

-- Verificar constraints
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'championship_teams';

-- ============================================================================
-- MIGRAÇÃO CONCLUÍDA
-- ============================================================================

