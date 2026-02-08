
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Definição dos tipos para a requisição, garantindo que os dados sejam consistentes.
interface BetUpdateRequest {
  analysis_id: number;
  bet_status: 'pending' | 'won' | 'lost' | 'cancelled';
  bet_amount_cents: number;
  bet_odd: number;
}

// CORS Headers para permitir que o seu frontend chame esta função.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Em produção, restrinja para o seu domínio: 'https://seusite.com'
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Trata a requisição pre-flight do CORS.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Cria o cliente Supabase com as permissões do usuário que fez a chamada.
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_ANON_KEY") ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 2. Extrai os dados do usuário a partir do token JWT.
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // 3. Extrai e valida os dados da requisição.
    const betUpdate: BetUpdateRequest = await req.json();
    
    // 4. Chama a função transacional no banco de dados (RPC).
    // Esta é a parte central, que garante a atomicidade da operação.
    const { data, error } = await supabaseClient.rpc('update_bet_and_bank_transactional', {
      p_user_id: user.id,
      p_analysis_id: betUpdate.analysis_id,
      p_bet_status: betUpdate.bet_status,
      p_bet_amount_cents: betUpdate.bet_amount_cents,
      p_odd: betUpdate.bet_odd,
    });

    if (error) {
      // Se a função do DB retornar um erro (ex: saldo insuficiente, aposta não encontrada),
      // ele será repassado ao frontend.
      console.error('Erro na chamada RPC:', error);
      throw new Error(`Erro no banco de dados: ${error.message}`);
    }

    // 5. Retorna uma resposta de sucesso.
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    // Retorna uma resposta de erro genérica para qualquer outra falha.
    return new Response(String(err?.message ?? err), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
