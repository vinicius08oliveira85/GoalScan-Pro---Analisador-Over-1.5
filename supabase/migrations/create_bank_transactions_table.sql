-- Complemento de auditoria em bank_transactions + RPC process_bet_transaction com rastreabilidade estendida.
-- A tabela base e a função foram introduzidas em 20260410190000_bank_transactions_process_bet_transaction.sql.

ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS transaction_type TEXT,
  ADD COLUMN IF NOT EXISTS signed_delta NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS old_bank_balance NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS new_bank_balance NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS bet_info_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_transaction_type ON public.bank_transactions (transaction_type);

COMMENT ON COLUMN public.bank_transactions.transaction_type IS 'Semântica de negócio: bet_debit, bet_credit, bet_profit, bet_adjustment, etc.';
COMMENT ON COLUMN public.bank_transactions.signed_delta IS 'Alteração assinada em total_bank (negativo = saída).';
COMMENT ON COLUMN public.bank_transactions.old_bank_balance IS 'Saldo antes do movimento.';
COMMENT ON COLUMN public.bank_transactions.new_bank_balance IS 'Saldo após o movimento.';
COMMENT ON COLUMN public.bank_transactions.bet_info_snapshot IS 'Snapshot JSON do bet_info no momento da transação.';

CREATE OR REPLACE FUNCTION public.process_bet_transaction (
  p_settings_id TEXT,
  p_bet_id TEXT,
  p_signed_delta NUMERIC,
  p_tx_type TEXT,
  p_tx_amount NUMERIC,
  p_bet_info JSONB,
  p_increment_leverage_day BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.bank_settings%ROWTYPE;
  v_current NUMERIC(15, 2);
  v_new NUMERIC(15, 2);
  v_final_bet JSONB;
  v_day INT;
  v_updated INT;
  v_transaction_type TEXT;
  v_description TEXT;
BEGIN
  IF p_settings_id IS NULL OR p_bet_id IS NULL THEN
    RAISE EXCEPTION 'settings_id e bet_id são obrigatórios';
  END IF;

  IF p_tx_type IS NULL OR p_tx_type NOT IN ('DEBIT', 'CREDIT', 'PROFIT') THEN
    RAISE EXCEPTION 'Tipo de transação inválido: %', p_tx_type;
  END IF;

  SELECT * INTO v_row FROM public.bank_settings WHERE id = p_settings_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bank_settings não encontrado: %', p_settings_id;
  END IF;

  v_current := COALESCE(v_row.total_bank, 0);

  v_transaction_type := CASE
    WHEN p_tx_type = 'DEBIT' THEN 'bet_debit'
    WHEN p_tx_type = 'CREDIT' THEN 'bet_credit'
    WHEN p_tx_type = 'PROFIT' THEN 'bet_profit'
    ELSE 'bet_adjustment'
  END;

  v_description := format('process_bet_transaction: type=%s signed_delta=%s', p_tx_type, p_signed_delta);

  IF COALESCE(p_signed_delta, 0) IS DISTINCT FROM 0 THEN
    IF p_tx_amount IS NULL OR p_tx_amount < 0 THEN
      RAISE EXCEPTION 'p_tx_amount deve ser >= 0 quando há movimento de saldo';
    END IF;

    v_new := v_current + p_signed_delta;

    IF v_new < 0 THEN
      RAISE EXCEPTION 'Saldo insuficiente (saldo %, delta %)', v_current, p_signed_delta;
    END IF;

    IF p_tx_type = 'DEBIT' AND p_signed_delta < 0 THEN
      IF v_current + p_signed_delta < 0 THEN
        RAISE EXCEPTION 'Saldo insuficiente para débito';
      END IF;
    END IF;

    UPDATE public.bank_settings
    SET
      total_bank = v_new,
      updated_at = (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT
    WHERE id = p_settings_id;

    INSERT INTO public.bank_transactions (
      bet_id,
      amount,
      type,
      balance_after,
      transaction_type,
      signed_delta,
      old_bank_balance,
      new_bank_balance,
      bet_info_snapshot,
      description
    ) VALUES (
      p_bet_id,
      p_tx_amount,
      p_tx_type,
      v_new,
      v_transaction_type,
      p_signed_delta,
      v_current,
      v_new,
      p_bet_info,
      v_description
    );
  ELSE
    v_new := v_current;
  END IF;

  v_final_bet := p_bet_info;
  IF COALESCE(p_increment_leverage_day, FALSE) THEN
    v_day := COALESCE((p_bet_info->>'leverageProgressionDay')::INT, 0);
    v_final_bet := jsonb_set(
      p_bet_info,
      '{leverageProgressionDay}',
      to_jsonb(v_day + 1),
      TRUE
    );
  END IF;

  UPDATE public.saved_analyses
  SET
    bet_info = v_final_bet,
    updated_at = NOW()
  WHERE id = p_bet_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'saved_analyses não encontrado: %', p_bet_id;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'balance_after', v_new,
    'signed_delta', p_signed_delta,
    'bet_info', v_final_bet
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_bet_transaction (TEXT, TEXT, NUMERIC, TEXT, NUMERIC, JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_bet_transaction (TEXT, TEXT, NUMERIC, TEXT, NUMERIC, JSONB, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.process_bet_transaction (TEXT, TEXT, NUMERIC, TEXT, NUMERIC, JSONB, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_bet_transaction (TEXT, TEXT, NUMERIC, TEXT, NUMERIC, JSONB, BOOLEAN) TO service_role;
