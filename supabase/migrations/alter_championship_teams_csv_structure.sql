-- Reestruturar tabela championship_teams baseada no CSV Bundesliga.csv
-- Esta migração remove campos antigos e adiciona campos Home e Away

-- ⚠️ ATENÇÃO: Esta migração remove dados existentes das colunas antigas!
-- Faça backup antes de executar se tiver dados importantes.

-- 1. Remover colunas antigas que não existem no CSV
ALTER TABLE championship_teams 
  DROP COLUMN IF EXISTS mp,
  DROP COLUMN IF EXISTS w,
  DROP COLUMN IF EXISTS d,
  DROP COLUMN IF EXISTS l,
  DROP COLUMN IF EXISTS gf,
  DROP COLUMN IF EXISTS ga,
  DROP COLUMN IF EXISTS gd,
  DROP COLUMN IF EXISTS pts,
  DROP COLUMN IF EXISTS pts_mp,
  DROP COLUMN IF EXISTS xg,
  DROP COLUMN IF EXISTS xga,
  DROP COLUMN IF EXISTS xgd,
  DROP COLUMN IF EXISTS xgd_90,
  DROP COLUMN IF EXISTS last_5,
  DROP COLUMN IF EXISTS attendance,
  DROP COLUMN IF EXISTS top_team_scorer,
  DROP COLUMN IF EXISTS goalkeeper,
  DROP COLUMN IF EXISTS notes;

-- 2. Adicionar campos Home (estatísticas em casa)
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

-- 3. Adicionar campos Away (estatísticas fora)
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

-- 4. Adicionar campo extra_fields JSONB para campos extras de outros campeonatos
ALTER TABLE championship_teams 
  ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}'::jsonb;

-- 5. Adicionar comentários descritivos
COMMENT ON COLUMN championship_teams.home_mp IS 'Partidas jogadas em casa';
COMMENT ON COLUMN championship_teams.home_w IS 'Vitórias em casa';
COMMENT ON COLUMN championship_teams.home_d IS 'Empates em casa';
COMMENT ON COLUMN championship_teams.home_l IS 'Derrotas em casa';
COMMENT ON COLUMN championship_teams.home_gf IS 'Gols a favor em casa';
COMMENT ON COLUMN championship_teams.home_ga IS 'Gols contra em casa';
COMMENT ON COLUMN championship_teams.home_gd IS 'Saldo de gols em casa';
COMMENT ON COLUMN championship_teams.home_pts IS 'Pontos em casa';
COMMENT ON COLUMN championship_teams.home_pts_mp IS 'Pontos por partida em casa';
COMMENT ON COLUMN championship_teams.home_xg IS 'Expected Goals em casa';
COMMENT ON COLUMN championship_teams.home_xga IS 'Expected Goals Against em casa';
COMMENT ON COLUMN championship_teams.home_xgd IS 'Expected Goals Difference em casa';
COMMENT ON COLUMN championship_teams.home_xgd_90 IS 'Expected Goals Difference por 90min em casa';

COMMENT ON COLUMN championship_teams.away_mp IS 'Partidas jogadas fora';
COMMENT ON COLUMN championship_teams.away_w IS 'Vitórias fora';
COMMENT ON COLUMN championship_teams.away_d IS 'Empates fora';
COMMENT ON COLUMN championship_teams.away_l IS 'Derrotas fora';
COMMENT ON COLUMN championship_teams.away_gf IS 'Gols a favor fora';
COMMENT ON COLUMN championship_teams.away_ga IS 'Gols contra fora';
COMMENT ON COLUMN championship_teams.away_gd IS 'Saldo de gols fora';
COMMENT ON COLUMN championship_teams.away_pts IS 'Pontos fora';
COMMENT ON COLUMN championship_teams.away_pts_mp IS 'Pontos por partida fora';
COMMENT ON COLUMN championship_teams.away_xg IS 'Expected Goals fora';
COMMENT ON COLUMN championship_teams.away_xga IS 'Expected Goals Against fora';
COMMENT ON COLUMN championship_teams.away_xgd IS 'Expected Goals Difference fora';
COMMENT ON COLUMN championship_teams.away_xgd_90 IS 'Expected Goals Difference por 90min fora';

COMMENT ON COLUMN championship_teams.extra_fields IS 'Campos extras em formato JSONB para suportar diferentes estruturas de campeonatos';

-- 6. Verificar estrutura final
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'championship_teams'
ORDER BY ordinal_position;

