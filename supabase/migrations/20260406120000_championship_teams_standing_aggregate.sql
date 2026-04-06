-- Classificação agregada da temporada (JSON único, sem Home/Away por time)
ALTER TABLE championship_teams
  ADD COLUMN IF NOT EXISTS standing_mp TEXT,
  ADD COLUMN IF NOT EXISTS standing_w TEXT,
  ADD COLUMN IF NOT EXISTS standing_d TEXT,
  ADD COLUMN IF NOT EXISTS standing_l TEXT,
  ADD COLUMN IF NOT EXISTS standing_gf TEXT,
  ADD COLUMN IF NOT EXISTS standing_ga TEXT,
  ADD COLUMN IF NOT EXISTS standing_gd TEXT,
  ADD COLUMN IF NOT EXISTS standing_pts TEXT,
  ADD COLUMN IF NOT EXISTS standing_pts_per_mp TEXT,
  ADD COLUMN IF NOT EXISTS standing_last_5 TEXT,
  ADD COLUMN IF NOT EXISTS standing_attendance TEXT,
  ADD COLUMN IF NOT EXISTS top_team_scorer TEXT,
  ADD COLUMN IF NOT EXISTS goalkeeper TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS status_b TEXT;

COMMENT ON COLUMN championship_teams.standing_mp IS 'Partidas jogadas (tabela agregada temporada)';
COMMENT ON COLUMN championship_teams.standing_gf IS 'Gols a favor (agregado temporada)';
COMMENT ON COLUMN championship_teams.standing_ga IS 'Gols contra (agregado temporada)';
COMMENT ON COLUMN championship_teams.status_b IS 'Flag exportada da planilha (ex.: FALSO/VERDADEIRO)';
