-- Adicionar coluna base_bank para suportar reconciliação/sincronização da banca base
-- Permite sincronizar a base entre dispositivos (quando houver autenticação/mesmo projeto)

ALTER TABLE bank_settings
  ADD COLUMN IF NOT EXISTS base_bank NUMERIC(15, 2);


