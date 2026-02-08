import { supabase } from './supabaseClient';

// Definição do tipo para os dados da aposta, alinhado com a Edge Function
interface BetUpdatePayload {
  analysis_id: number;
  bet_status: 'pending' | 'won' | 'lost' | 'cancelled';
  bet_amount: number; // O valor ainda é recebido como float do formulário
  bet_odd: number;
}

/**
 * Orquestra a atualização de uma aposta e o saldo da banca de forma transacional,
 * invocando a Edge Function "update-bet-and-bank".
 * 
 * @param payload Os dados da aposta a serem atualizados.
 * @returns O resultado da operação da Edge Function.
 */
const updateBetAndBank = async (payload: BetUpdatePayload) => {
  // 1. Converter o valor da aposta para centavos antes de enviar para o backend.
  // Isso garante que todos os cálculos no backend sejam feitos com inteiros.
  const betAmountCents = Math.round(payload.bet_amount * 100);

  // 2. Chamar a Edge Function.
  const { data, error } = await supabase.functions.invoke('update-bet-and-bank', {
    body: {
      analysis_id: payload.analysis_id,
      bet_status: payload.bet_status,
      bet_amount_cents: betAmountCents,
      bet_odd: payload.bet_odd,
    },
  });

  if (error) {
    console.error("Erro ao invocar a Edge Function:", error.message);
    // Propaga o erro para que o componente React possa tratá-lo (ex: mostrar notificação)
    throw new Error(`Falha ao atualizar a aposta: ${error.message}`);
  }

  // 3. Opcional: O backend já atualizou a banca. O frontend pode precisar re-sincronizar
  // os dados ou usar a resposta para atualizar o estado localmente.
  console.log("Edge Function invocada com sucesso:", data);
  return data;
};

// A função para buscar as configurações da banca permanece a mesma, mas agora
// o valor retornado (`total_bank_cents`) estará em centavos.
const getBankSettings = async () => {
  const { data, error } = await supabase
    .from('bank_settings')
    .select('*, user:users(*)') // Incluindo dados do usuário se necessário
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116: "exact-one-row-not-found"
    console.error('Erro ao buscar configurações da banca:', error);
    throw error;
  }

  return data;
};

// Exporta as funções para serem usadas nos componentes React.
export const bankService = {
  updateBetAndBank,
  getBankSettings,
};
