-- supabase/migrations/YYYYMMDDHHMMSS_update_bank_settings_to_cents.sql

-- Renomear a coluna para refletir a nova unidade
ALTER TABLE public.bank_settings 
RENAME COLUMN total_bank TO total_bank_cents;

-- Alterar o tipo da coluna para BIGINT para armazenar centavos
-- O valor existente será multiplicado por 100 para a conversão.
-- NOTA: Execute um backup antes de aplicar em produção.
ALTER TABLE public.bank_settings
ALTER COLUMN total_bank_cents TYPE BIGINT USING (total_bank_cents * 100)::BIGINT;

-- Adicionar um valor padrão caso não exista
ALTER TABLE public.bank_settings
ALTER COLUMN total_bank_cents SET DEFAULT 0;

COMMENT ON COLUMN public.bank_settings.total_bank_cents IS 'Valor total da banca em centavos.';
