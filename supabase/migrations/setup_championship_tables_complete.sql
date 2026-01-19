-- ============================================================================
-- SCRIPT COMPLETO: Configuração das Tabelas de Campeonatos
-- ============================================================================
-- Este script configura todas as tabelas necessárias para o sistema de campeonatos
-- Execute este script no SQL Editor do Supabase
-- ============================================================================

-- ============================================================================
-- PARTE 1: Criar Tabela de Campeonatos (se ainda não existir)
-- ============================================================================

-- Remover tabelas existentes se houver (para evitar conflitos de tipo)
-- ⚠️ ATENÇÃO: Isso apagará dados existentes! Faça backup se necessário.
DROP TABLE IF EXISTS championship_tables CASCADE;
DROP TABLE IF EXISTS championship_teams CASCADE;
DROP TABLE IF EXISTS championships CASCADE;

CREATE TABLE championships (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela championship_tables para armazenar as tabelas de cada campeonato
-- Esta tabela armazena os dados JSON da tabela geral (compatibilidade retroativa)
CREATE TABLE championship_tables (
  id TEXT PRIMARY KEY,
  championship_id TEXT NOT NULL REFERENCES championships(id) ON DELETE CASCADE,
  table_type TEXT NOT NULL CHECK (table_type IN ('geral', 'standard_for')),
  table_name TEXT NOT NULL,
  table_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_championships_nome ON championships(nome);
CREATE INDEX IF NOT EXISTS idx_championship_tables_championship_id ON championship_tables(championship_id);
CREATE INDEX IF NOT EXISTS idx_championship_tables_table_type ON championship_tables(table_type);

-- Habilitar RLS (Row Level Security)
ALTER TABLE championships ENABLE ROW LEVEL SECURITY;
ALTER TABLE championship_tables ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Allow anonymous access" ON championships;
DROP POLICY IF EXISTS "Allow anonymous access" ON championship_tables;

-- Criar políticas de acesso anônimo
CREATE POLICY "Allow anonymous access" ON championships
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous access" ON championship_tables
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PARTE 2: Adicionar Campo uploaded_at na Tabela championships
-- ============================================================================

ALTER TABLE championships 
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN championships.uploaded_at IS 
  'Data e hora do último upload/atualização da tabela de dados do campeonato';

-- ============================================================================
-- PARTE 3: Criar Tabela Normalizada championship_teams
-- ============================================================================

CREATE TABLE championship_teams (
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

-- ============================================================================
-- VERIFICAÇÃO: Confirmar que as tabelas foram criadas
-- ============================================================================

-- Verificar estrutura das tabelas
SELECT 
  'championships' as tabela,
  COUNT(*) as total_registros
FROM championships
UNION ALL
SELECT 
  'championship_tables' as tabela,
  COUNT(*) as total_registros
FROM championship_tables
UNION ALL
SELECT 
  'championship_teams' as tabela,
  COUNT(*) as total_registros
FROM championship_teams;

-- Verificar colunas da tabela championship_teams
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'championship_teams'
ORDER BY ordinal_position;

-- ============================================================================
-- SCRIPT CONCLUÍDO
-- ============================================================================
-- As tabelas estão prontas para uso!
-- Agora você pode fazer upload de arquivos Excel ou JSON na aba "Campeonatos"
-- ============================================================================

