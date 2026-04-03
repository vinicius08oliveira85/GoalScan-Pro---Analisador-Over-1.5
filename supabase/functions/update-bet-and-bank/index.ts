
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { matchId, betInfo, status } = await req.json()

  // TODO: Implementar a lógica da transação aqui

  return new Response(
    JSON.stringify({ message: "Função executada com sucesso!" }),
    { headers: { "Content-Type": "application/json" } },
  )
})
