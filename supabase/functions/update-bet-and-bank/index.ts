import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  computeBankDifferenceForBetSave,
  ledgerForSignedDelta,
} from "./bankFinanceDeno.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type BetInfoBody = {
  betAmount: number;
  potentialReturn: number;
  status: "pending" | "won" | "lost" | "cancelled";
  odd?: number;
  useLeverageProgression?: boolean;
  leverageProgressionDay?: number;
  [key: string]: unknown;
};

interface UpdateBetAndBankRequest {
  match_id: string;
  bet_info: BetInfoBody;
  old_bet_info?: BetInfoBody | null;
  settings_id?: string;
  increment_leverage_progression_day?: boolean;
}

function parseRpcResult(data: unknown): {
  balanceAfter: number;
  betInfo: unknown;
} | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const inner = (o.success !== undefined ? o : o) as Record<string, unknown>;
  const bal = inner.balance_after ?? inner.balanceAfter;
  const num = typeof bal === "number" ? bal : typeof bal === "string" ? parseFloat(bal as string) : NaN;
  if (!Number.isFinite(num)) return null;
  return { balanceAfter: num, betInfo: inner.bet_info ?? inner.betInfo };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Use POST" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    const supabase = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = (await req.json()) as UpdateBetAndBankRequest;
    const matchId = body.match_id?.trim();
    if (!matchId || !body.bet_info) {
      return new Response(
        JSON.stringify({ success: false, error: "match_id e bet_info são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const settingsId = body.settings_id?.trim() || "default";
    const oldBet = body.old_bet_info ?? undefined;
    const newBet = body.bet_info;

    const signedDelta = computeBankDifferenceForBetSave({
      oldBetInfo: oldBet,
      betInfo: newBet,
    });

    const needIncrement = Boolean(body.increment_leverage_progression_day);
    const needBankMove = signedDelta !== 0;

    if (!needBankMove && !needIncrement) {
      const { data: row, error: bErr } = await supabase
        .from("bank_settings")
        .select("total_bank")
        .eq("id", settingsId)
        .maybeSingle();
      if (bErr) {
        console.error("[update-bet-and-bank] read bank", bErr);
        throw new Error(bErr.message);
      }
      const bal = row?.total_bank != null ? Number(row.total_bank) : 0;
      return new Response(
        JSON.stringify({
          success: true,
          noop: true,
          data: { balance_after: bal, bet_info: newBet, signed_delta: 0 },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ledger = ledgerForSignedDelta(signedDelta, {
      oldStatus: oldBet?.status,
      newStatus: newBet.status,
    });

    const { data, error } = await supabase.rpc("process_bet_transaction", {
      p_settings_id: settingsId,
      p_bet_id: matchId,
      p_signed_delta: signedDelta,
      p_tx_type: ledger.type,
      p_tx_amount: needBankMove ? ledger.amount : 0,
      p_bet_info: newBet as Record<string, unknown>,
      p_increment_leverage_day: needIncrement,
    });

    if (error) {
      console.error("[update-bet-and-bank] RPC", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = parseRpcResult(data);
    if (!parsed) {
      return new Response(JSON.stringify({ success: false, error: "Resposta RPC inválida." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          balance_after: parsed.balanceAfter,
          bet_info: parsed.betInfo,
          signed_delta: signedDelta,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
