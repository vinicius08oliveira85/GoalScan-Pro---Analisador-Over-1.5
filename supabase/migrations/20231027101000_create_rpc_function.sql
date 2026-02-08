-- supabase/migrations/YYYYMMDDHHMMSS_create_rpc_function.sql

CREATE OR REPLACE FUNCTION public.update_bet_and_bank_transactional(
    p_user_id UUID,
    p_analysis_id BIGINT,
    p_bet_status TEXT,
    p_bet_amount_cents BIGINT,
    p_odd NUMERIC
)
RETURNS JSON -- Retorna um JSON com o resultado
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com os privilégios do criador da função (essencial para segurança)
AS $$
DECLARE
    current_bank_settings RECORD;
    initial_balance BIGINT;
    final_balance BIGINT;
    profit_cents BIGINT;
    transaction_description TEXT;
BEGIN
    -- Etapa 1: Obter o saldo atual da banca e bloquear a linha para evitar concorrência
    -- A cláusula FOR UPDATE garante que nenhuma outra transação possa modificar esta linha até o commit.
    SELECT * INTO current_bank_settings FROM public.bank_settings WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Configurações de banca não encontradas para o usuário.';
    END IF;

    initial_balance := current_bank_settings.total_bank_cents;

    -- Etapa 2: Calcular o novo saldo com base no status da aposta
    CASE p_bet_status
        WHEN 'pending' THEN
            final_balance := initial_balance - p_bet_amount_cents;
            transaction_description := 'Aposta realizada na partida ID: ' || p_analysis_id;
        WHEN 'won' THEN
            profit_cents := (p_bet_amount_cents * p_odd)::BIGINT - p_bet_amount_cents;
            final_balance := initial_balance + profit_cents;
            transaction_description := 'Aposta ganha na partida ID: ' || p_analysis_id;
        WHEN 'lost' THEN
            -- O saldo não muda, pois o dinheiro já foi debitado na criação da aposta
            final_balance := initial_balance;
            transaction_description := 'Aposta perdida na partida ID: ' || p_analysis_id;
        WHEN 'cancelled' THEN
            final_balance := initial_balance + p_bet_amount_cents;
            transaction_description := 'Aposta cancelada e valor reembolsado. Partida ID: ' || p_analysis_id;
        ELSE
            RAISE EXCEPTION 'Status de aposta inválido: %', p_bet_status;
    END CASE;

    -- Etapa 3: Atualizar o status da aposta na tabela saved_analyses
    UPDATE public.saved_analyses
    SET bet_status = p_bet_status, bet_amount_cents = p_bet_amount_cents, bet_odd = p_odd
    WHERE id = p_analysis_id AND user_id = p_user_id;

    -- Etapa 4: Atualizar o saldo da banca
    UPDATE public.bank_settings
    SET total_bank_cents = final_balance
    WHERE user_id = p_user_id;

    -- Etapa 5: Inserir o registro de auditoria
    INSERT INTO public.bank_transactions(
        user_id, 
        analysis_id, 
        transaction_type, 
        amount, 
        initial_bank_balance, 
        final_bank_balance, 
        description
    ) VALUES (
        p_user_id,
        p_analysis_id,
        p_bet_status, -- 'bet', 'win', 'loss', etc.
        CASE WHEN p_bet_status = 'won' THEN profit_cents ELSE p_bet_amount_cents END,
        initial_balance,
        final_balance,
        transaction_description
    );

    -- Etapa 6: Retornar o resultado
    RETURN json_build_object(
        'success', true,
        'message', 'Operação realizada com sucesso.',
        'initial_balance_cents', initial_balance,
        'final_balance_cents', final_balance
    );

-- O bloco COMMIT/ROLLBACK é implícito no final de uma função plpgsql
END;
$$;
