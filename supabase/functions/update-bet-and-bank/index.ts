
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Definição de tipos para a requisição
interface BetUpdateRequest {
  matchId: string;
  betInfo: {
    betAmount: number;
    odd: number;
    potentialReturn: number;
    status: 'pending' | 'won' | 'lost' | 'cancelled';
  };
  oldBetInfo?: {
    betAmount: number;
    status: 'pending' | 'won' | 'lost' | 'cancelled';
  };
}

serve(async (req) => {
  // 1. Validação inicial e CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // 2. Extrair dados da requisição
    const body: BetUpdateRequest = await req.json();
    const { matchId, betInfo, oldBetInfo } = body;

    // Validação básica dos dados recebidos
    if (!matchId || !betInfo) {
      return new Response(JSON.stringify({ error: "Dados da aposta ausentes." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Criar cliente Supabase com privilégios de administrador
    // As variáveis de ambiente são injetadas automaticamente no Deno Deploy.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // =========================================================================
    // AQUI ENTRARÁ A LÓGICA DE TRANSAÇÃO (Fase 2 da implementação)
    // - Chamar uma função de banco de dados (RPC) que executa a transação
    // - Implementar SELECT ... FOR UPDATE para lock
    // - Atualizar 'saved_analyses' e 'bank_settings'
    // - Inserir em 'bank_transactions'
    // =================================á========================================

    // Placeholder da lógica atual (não transacional - para ser substituído)
    // Esta parte simula a lógica que será movida para uma função RPC no PostgreSQL
    console.log(`Processando aposta para a partida: ${matchId}`);
    console.log(`Novo status: ${betInfo.status}, Valor: ${betInfo.betAmount}`);

    // Simplesmente retorna sucesso por enquanto
    const responseData = {
      message: "Requisição recebida com sucesso. Lógica transacional a ser implementada.",
      updatedMatchId: matchId,
    };

    return new Response(JSON.stringify(responseData), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 200,
    });

  } catch (error) {
    console.error("Erro na Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 500,
    });
  }
});
