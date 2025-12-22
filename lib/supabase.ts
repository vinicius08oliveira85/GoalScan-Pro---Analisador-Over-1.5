// Configuração do cliente Supabase
const SUPABASE_URL = 'https://vebpalhcvzbbzmdzglag.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlYnBhbGhjdnpiYnptZHpnbGFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTAwNjksImV4cCI6MjA3ODA4NjA2OX0._CeC5YzIyzSssdH285VlAyGRCPJmCZOa2ZTksD9e7T4';

// Importação dinâmica do Supabase (via importmap no HTML)
let supabaseClient: any = null;
let supabaseModule: any = null;

export const getSupabaseClient = async () => {
  if (supabaseClient) {
    return supabaseClient;
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

