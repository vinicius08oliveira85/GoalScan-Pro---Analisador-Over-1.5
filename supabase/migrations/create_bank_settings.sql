-- Criar tabela bank_settings para armazenar configurações globais de banca
-- Esta tabela armazena o valor total da banca e a moeda utilizada

CREATE TABLE IF NOT EXISTS bank_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  total_bank NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'R$',
  updated_at BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índice para busca rápida (já que sempre buscamos por id='default')
CREATE INDEX IF NOT EXISTS idx_bank_settings_id ON bank_settings(id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE bank_settings ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura/escrita anônima
-- Como não há autenticação de usuário, permitimos acesso anônimo completo
-- Remover política existente se houver (para evitar erro ao recriar)
DROP POLICY IF EXISTS "Allow anonymous access" ON bank_settings;

-- Criar política de acesso anônimo
CREATE POLICY "Allow anonymous access" ON bank_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Inserir registro padrão se não existir
INSERT INTO bank_settings (id, total_bank, currency, updated_at)
VALUES ('default', 0, 'R$', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT (id) DO NOTHING;

