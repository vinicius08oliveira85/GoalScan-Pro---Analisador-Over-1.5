-- Adicionar coluna leverage para suportar alavancagem de apostas
-- A alavancagem multiplica o retorno potencial das apostas
-- Valor padrão: 1.0 (sem alavancagem)

ALTER TABLE bank_settings
  ADD COLUMN IF NOT EXISTS leverage NUMERIC(5, 2) DEFAULT 1.0;

-- Atualizar registros existentes para ter leverage = 1.0 (sem alavancagem)
UPDATE bank_settings
SET leverage = 1.0
WHERE leverage IS NULL;

-- Garantir que leverage não seja NULL
ALTER TABLE bank_settings
  ALTER COLUMN leverage SET NOT NULL;

-- Adicionar constraint para garantir valores válidos (0.1 a 10.0)
ALTER TABLE bank_settings
  ADD CONSTRAINT check_leverage_range CHECK (leverage >= 0.1 AND leverage <= 10.0);

