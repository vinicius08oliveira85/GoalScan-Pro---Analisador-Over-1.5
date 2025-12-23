// Configuração do cliente Supabase
// Credenciais carregadas de variáveis de ambiente
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Importação dinâmica do Supabase (via importmap no HTML)
let supabaseClient: any = null;
let supabaseModule: any = null;

export const getSupabaseClient = async () => {
  if (supabaseClient) {
    console.log('[Supabase] Cliente já inicializado, reutilizando...');
    return supabaseClient;
  }

  console.log('[Supabase] Inicializando cliente...');
  console.log('[Supabase] Verificando variáveis de ambiente...');
  console.log('[Supabase] VITE_SUPABASE_URL:', SUPABASE_URL ? `${SUPABASE_URL.substring(0, 20)}...` : 'NÃO CONFIGURADO');
  console.log('[Supabase] VITE_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 10)}...` : 'NÃO CONFIGURADO');

  // Validar que as variáveis de ambiente estão configuradas
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const missingVars: string[] = [];
    if (!SUPABASE_URL) missingVars.push('VITE_SUPABASE_URL');
    if (!SUPABASE_ANON_KEY) missingVars.push('VITE_SUPABASE_ANON_KEY');
    
    // Detectar se está rodando em produção (Vercel)
    const isProduction = window.location.hostname.includes('vercel.app') || 
                         window.location.hostname.includes('vercel.com') ||
                         process.env.NODE_ENV === 'production';
    
    let errorMessage = `Variáveis de ambiente do Supabase não configuradas: ${missingVars.join(', ')}.\n\n`;
    
    if (isProduction) {
      errorMessage += '🔧 CONFIGURAÇÃO NO VERCEL:\n';
      errorMessage += '1. Acesse: https://vercel.com/dashboard\n';
      errorMessage += '2. Selecione seu projeto\n';
      errorMessage += '3. Vá em Settings > Environment Variables\n';
      errorMessage += '4. Adicione as seguintes variáveis:\n';
      errorMessage += '   - VITE_SUPABASE_URL = https://seu-projeto.supabase.co\n';
      errorMessage += '   - VITE_SUPABASE_ANON_KEY = sua_chave_anonima_aqui\n';
      errorMessage += '5. Faça um novo deploy (ou aguarde o redeploy automático)\n\n';
      errorMessage += '💡 As variáveis precisam começar com VITE_ para serem expostas ao cliente.';
    } else {
      errorMessage += '🔧 CONFIGURAÇÃO LOCAL:\n';
      errorMessage += '1. Crie um arquivo .env na raiz do projeto\n';
      errorMessage += '2. Adicione as seguintes variáveis:\n';
      errorMessage += '   VITE_SUPABASE_URL=https://seu-projeto.supabase.co\n';
      errorMessage += '   VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui\n';
      errorMessage += '3. Reinicie o servidor de desenvolvimento (npm run dev)';
    }
    
    const error = new Error(errorMessage);
    console.error('[Supabase] ❌ Erro de configuração:', error.message);
    console.error('[Supabase] 💡 Dica: As variáveis de ambiente precisam estar configuradas.');
    throw error;
  }

  // Validar formato da URL
  try {
    new URL(SUPABASE_URL);
    console.log('[Supabase] ✅ URL válida');
  } catch (e) {
    const error = new Error(
      `URL do Supabase inválida: ${SUPABASE_URL}. ` +
      'A URL deve estar no formato: https://seu-projeto.supabase.co'
    );
    console.error('[Supabase] ❌ Erro de validação:', error.message);
    throw error;
  }

  // Validar formato da chave (deve ter pelo menos 100 caracteres)
  if (SUPABASE_ANON_KEY.length < 50) {
    const error = new Error(
      'Chave anônima do Supabase parece inválida (muito curta). ' +
      'Verifique se VITE_SUPABASE_ANON_KEY está correta no arquivo .env'
    );
    console.error('[Supabase] ❌ Erro de validação:', error.message);
    throw error;
  }

  try {
    console.log('[Supabase] Carregando módulo @supabase/supabase-js...');
    // Carregar módulo via importmap (disponível no runtime)
    if (!supabaseModule) {
      supabaseModule = await import('@supabase/supabase-js');
      console.log('[Supabase] ✅ Módulo carregado com sucesso');
    }
    
    console.log('[Supabase] Criando cliente Supabase...');
    supabaseClient = supabaseModule.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[Supabase] ✅ Cliente inicializado com sucesso');
    
    return supabaseClient;
  } catch (error: any) {
    console.error('[Supabase] ❌ Erro ao inicializar cliente Supabase:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack
    });
    
    const detailedError = new Error(
      `Erro ao inicializar cliente Supabase: ${error?.message || 'Erro desconhecido'}. ` +
      'Verifique se o módulo @supabase/supabase-js está instalado (npm install @supabase/supabase-js)'
    );
    throw detailedError;
  }
};

