-- Criar tabela championships para armazenar campeonatos
-- Esta tabela armazena os campeonatos cadastrados pelo usuário

-- Remover tabelas existentes se houver (para evitar conflitos de tipo)
DROP TABLE IF EXISTS championship_tables CASCADE;
DROP TABLE IF EXISTS championships CASCADE;

CREATE TABLE championships (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela championship_tables para armazenar as tabelas de cada campeonato
-- Esta tabela armazena os dados JSON da tabela geral

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

-- Remover políticas existentes se houver (para evitar erro ao recriar)
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

