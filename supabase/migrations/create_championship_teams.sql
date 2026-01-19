-- Criar tabela championship_teams para armazenar dados normalizados dos times
-- Cada time do campeonato será uma linha separada com todas as colunas do JSON

CREATE TABLE IF NOT EXISTS championship_teams (
  id TEXT PRIMARY KEY,
  championship_id TEXT NOT NULL REFERENCES championships(id) ON DELETE CASCADE,
  squad TEXT NOT NULL,
  table_name TEXT NOT NULL,
  
  -- Colunas do JSON normalizadas
  rk TEXT,
  mp TEXT,
  w TEXT,
  d TEXT,
  l TEXT,
  gf TEXT,
  ga TEXT,
  gd TEXT,
  pts TEXT,
  pts_mp TEXT,
  xg TEXT,
  xga TEXT,
  xgd TEXT,
  xgd_90 TEXT,
  last_5 TEXT,
  attendance TEXT,
  top_team_scorer TEXT,
  goalkeeper TEXT,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint UNIQUE para garantir que cada time aparece apenas uma vez por campeonato
  CONSTRAINT championship_teams_championship_squad_unique 
    UNIQUE (championship_id, squad)
);

-- Criar índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_championship_teams_championship_id 
  ON championship_teams(championship_id);
CREATE INDEX IF NOT EXISTS idx_championship_teams_squad 
  ON championship_teams(squad);
CREATE INDEX IF NOT EXISTS idx_championship_teams_table_name 
  ON championship_teams(table_name);

-- Habilitar RLS (Row Level Security)
ALTER TABLE championship_teams ENABLE ROW LEVEL SECURITY;

-- Remover política existente se houver
DROP POLICY IF EXISTS "Allow anonymous access" ON championship_teams;

-- Criar política de acesso anônimo
CREATE POLICY "Allow anonymous access" ON championship_teams
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Adicionar comentários descritivos
COMMENT ON TABLE championship_teams IS 
  'Tabela normalizada que armazena os dados de cada time do campeonato como linhas separadas';
COMMENT ON COLUMN championship_teams.squad IS 
  'Nome do time (chave lógica junto com championship_id)';
COMMENT ON COLUMN championship_teams.table_name IS 
  'Nome da tabela original (ex: results2025-2026201_overall)';
COMMENT ON CONSTRAINT championship_teams_championship_squad_unique ON championship_teams IS 
  'Garante unicidade: cada time aparece apenas uma vez por campeonato';

