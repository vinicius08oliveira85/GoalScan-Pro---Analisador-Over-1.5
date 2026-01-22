-- Criar tabela championship_complement para armazenar dados detalhados de complemento dos times
-- Cada time do campeonato terá uma linha com dados de Playing Time, Performance e Per 90 Minutes
-- Chave primária: squad (nome do time)
-- Foreign key: championship_id → championships(id)

CREATE TABLE IF NOT EXISTS championship_complement (
  squad TEXT NOT NULL,
  championship_id TEXT NOT NULL REFERENCES championships(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  
  -- Campos básicos
  pl TEXT,              -- # of Players (Number of Players used in Games)
  age TEXT,             -- Average Age (weighted by minutes played)
  poss TEXT,             -- Possession (percentage of passes attempted)
  
  -- Playing Time
  playing_time_mp TEXT,      -- Matches Played
  playing_time_starts TEXT,  -- Game or games started
  playing_time_min TEXT,     -- Minutes
  playing_time_90s TEXT,     -- 90s Played (Minutes played divided by 90)
  
  -- Performance
  performance_gls TEXT,      -- Goals scored or allowed
  performance_ast TEXT,       -- Assists
  performance_g_a TEXT,       -- Goals + Assists
  performance_g_pk TEXT,     -- Non-Penalty Goals
  performance_pk TEXT,        -- Penalty Kicks Made
  performance_pkatt TEXT,    -- Penalty Kicks Attempted
  performance_crdy TEXT,      -- Yellow Cards
  performance_crdr TEXT,      -- Red Cards
  
  -- Per 90 Minutes
  per_90_gls TEXT,           -- Goals/90 (Goals Scored per 90 minutes)
  per_90_ast TEXT,           -- Assists/90 (Assists per 90 minutes)
  per_90_g_a TEXT,           -- Goals + Assists/90
  per_90_g_pk TEXT,          -- Non-Penalty Goals/90
  per_90_g_a_pk TEXT,        -- Non-Penalty Goals + Assists/90
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint UNIQUE para garantir que cada time aparece apenas uma vez por campeonato
  CONSTRAINT championship_complement_championship_squad_unique 
    UNIQUE (championship_id, squad),
  
  -- Chave primária composta (squad + championship_id)
  PRIMARY KEY (championship_id, squad)
);

-- Criar índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_championship_complement_championship_id 
  ON championship_complement(championship_id);
CREATE INDEX IF NOT EXISTS idx_championship_complement_squad 
  ON championship_complement(squad);
CREATE INDEX IF NOT EXISTS idx_championship_complement_table_name 
  ON championship_complement(table_name);

-- Habilitar RLS (Row Level Security)
ALTER TABLE championship_complement ENABLE ROW LEVEL SECURITY;

-- Remover política existente se houver
DROP POLICY IF EXISTS "Allow anonymous access" ON championship_complement;

-- Criar política de acesso anônimo
CREATE POLICY "Allow anonymous access" ON championship_complement
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Adicionar comentários descritivos
COMMENT ON TABLE championship_complement IS 
  'Tabela normalizada que armazena dados detalhados de complemento de cada time do campeonato (Playing Time, Performance, Per 90 Minutes)';
COMMENT ON COLUMN championship_complement.squad IS 
  'Nome do time (chave primária junto com championship_id)';
COMMENT ON COLUMN championship_complement.table_name IS 
  'Nome da tabela original (ex: Bundesliga Complemento.csv)';
COMMENT ON COLUMN championship_complement.pl IS 
  '# of Players - Number of Players used in Games';
COMMENT ON COLUMN championship_complement.age IS 
  'Average Age - weighted by minutes played';
COMMENT ON COLUMN championship_complement.poss IS 
  'Possession - percentage of passes attempted';
COMMENT ON CONSTRAINT championship_complement_championship_squad_unique ON championship_complement IS 
  'Garante unicidade: cada time aparece apenas uma vez por campeonato na tabela de complemento';

