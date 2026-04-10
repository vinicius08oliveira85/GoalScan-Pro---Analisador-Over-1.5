import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

/** Corpo alinhado à RPC `process_bet_transaction` (substitui o fluxo legado em centavos). */
interface ProcessBetTransactionRequest {
  bet_id: string;
  signed_delta: number;
  tx_type: "DEBIT" | "CREDIT" | "PROFIT";
  tx_amount: number;
  bet_info: Record<string, unknown>;
  settings_id?: string;
  increment_leverage_day?: boolean;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const body: ProcessBetTransactionRequest = await req.json();

    if (!body.bet_id || body.tx_type == null || body.bet_info == null) {
      return new Response(
        JSON.stringify({
          error: "Campos obrigatórios: bet_id, tx_type, bet_info.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const settingsId = body.settings_id ?? "default";

    const { data, error } = await supabaseClient.rpc("process_bet_transaction", {
      p_settings_id: settingsId,
      p_bet_id: body.bet_id,
      p_signed_delta: body.signed_delta,
      p_tx_type: body.tx_type,
      p_tx_amount: body.tx_amount,
      p_bet_info: body.bet_info,
      p_increment_leverage_day: Boolean(body.increment_leverage_day),
    });

    if (error) {
      console.error("RPC process_bet_transaction:", error);
      throw new Error(error.message);
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(String(err?.message ?? err), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
