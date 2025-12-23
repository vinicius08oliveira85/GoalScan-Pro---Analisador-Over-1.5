// Configuração do cliente Supabase
// Credenciais carregadas de variáveis de ambiente
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Importação dinâmica do Supabase (via importmap no HTML)
let supabaseClient: any = null;
let supabaseModule: any = null;

export const getSupabaseClient = async () => {
  if (supabaseClient) {
    return supabaseClient;
  }

  // Validar que as variáveis de ambiente estão configuradas
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const error = new Error(
      'Variáveis de ambiente do Supabase não configuradas. ' +
      'Certifique-se de que VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão definidas no arquivo .env'
    );
    console.error(error.message);
    throw error;
  }

  try {
    // Carregar módulo via importmap (disponível no runtime)
    if (!supabaseModule) {
      supabaseModule = await import('@supabase/supabase-js');
    }
    supabaseClient = supabaseModule.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabaseClient;
  } catch (error) {
    console.error('Erro ao inicializar cliente Supabase:', error);
    throw error;
  }
};

