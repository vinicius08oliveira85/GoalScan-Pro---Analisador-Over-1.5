
CREATE OR REPLACE FUNCTION public.update_bet_and_bank(
    p_user_id UUID,
    p_analysis_id BIGINT,
    p_bet_status TEXT,
    p_bet_amount_cents BIGINT,
    p_odd NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_bank_settings RECORD;
    initial_balance BIGINT;
    final_balance BIGINT;
    profit_cents BIGINT;
    transaction_description TEXT;
    transaction_type_text TEXT;
BEGIN
    -- Get the current bank balance and lock the row to prevent race conditions
    SELECT * INTO current_bank_settings FROM public.bank_settings WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bank settings not found for the user.';
    END IF;

    initial_balance := current_bank_settings.total_bank_cents;

    -- Determine the transaction type and calculate the new balance
    CASE p_bet_status
        WHEN 'pending' THEN
            final_balance := initial_balance - p_bet_amount_cents;
            transaction_type_text := 'bet';
            transaction_description := 'Bet placed on match ID: ' || p_analysis_id;
        WHEN 'won' THEN
            -- The 'pending' transaction already debited the bet amount
            profit_cents := (p_bet_amount_cents * p_odd)::BIGINT;
            final_balance := initial_balance + profit_cents;
            transaction_type_text := 'win';
            transaction_description := 'Bet won on match ID: ' || p_analysis_id;
        WHEN 'lost' THEN
            -- The balance does not change, as the money was already debited
            final_balance := initial_balance;
            transaction_type_text := 'loss';
            transaction_description := 'Bet lost on match ID: ' || p_analysis_id;
        WHEN 'cancelled' THEN
            -- Refund the original bet amount
            final_balance := initial_balance + p_bet_amount_cents;
            transaction_type_text := 'cancellation_refund';
            transaction_description := 'Bet cancelled and amount refunded. Match ID: ' || p_analysis_id;
        ELSE
            RAISE EXCEPTION 'Invalid bet status: %', p_bet_status;
    END CASE;

    -- Update the bet status in the saved_analyses table
    UPDATE public.saved_analyses
    SET bet_status = p_bet_status, bet_amount_cents = p_bet_amount_cents, bet_odd = p_odd
    WHERE id = p_analysis_id AND user_id = p_user_id;

    -- Update the bank balance
    UPDATE public.bank_settings
    SET total_bank_cents = final_balance
    WHERE user_id = p_user_id;

    -- Insert the audit record
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
        transaction_type_text,
        CASE
            WHEN p_bet_status = 'won' THEN profit_cents
            ELSE p_bet_amount_cents
        END,
        initial_balance,
        final_balance,
        transaction_description
    );

    -- Return the result
    RETURN json_build_object(
        'success', true,
        'message', 'Operation successful.',
        'initial_balance_cents', initial_balance,
        'final_balance_cents', final_balance
    );
END;
$$;
