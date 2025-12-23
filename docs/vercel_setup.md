# Configuração de Variáveis de Ambiente no Vercel

Este guia explica como configurar as variáveis de ambiente do Supabase no Vercel para que o aplicativo funcione corretamente em produção.

## Passo a Passo

### 1. Acesse o Dashboard do Vercel

1. Acesse [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Faça login na sua conta
3. Selecione o projeto **GoalScan Pro - Analisador Over 1.5**

### 2. Configure as Variáveis de Ambiente

1. No menu do projeto, clique em **Settings**
2. No menu lateral, clique em **Environment Variables**
3. Adicione as seguintes variáveis:

#### Variável 1: VITE_SUPABASE_URL
- **Key:** `VITE_SUPABASE_URL`
- **Value:** `https://seu-projeto-id.supabase.co`
  - Substitua `seu-projeto-id` pelo ID do seu projeto Supabase
  - Você pode encontrar essa URL no painel do Supabase: Settings > API > Project URL
- **Environments:** Selecione todas (Production, Preview, Development)

#### Variável 2: VITE_SUPABASE_ANON_KEY
- **Key:** `VITE_SUPABASE_ANON_KEY`
- **Value:** Sua chave anônima pública do Supabase
  - Você pode encontrar essa chave no painel do Supabase: Settings > API > Project API keys > `anon` `public`
- **Environments:** Selecione todas (Production, Preview, Development)

### 3. Fazer o Deploy

Após adicionar as variáveis:

1. **Opção 1 - Redeploy automático:**
   - O Vercel pode fazer um redeploy automático quando detecta mudanças
   - Aguarde alguns minutos ou force um redeploy

2. **Opção 2 - Redeploy manual:**
   - Vá para a aba **Deployments**
   - Clique nos três pontos (...) do último deployment
   - Selecione **Redeploy**
   - Confirme o redeploy

### 4. Verificar se Funcionou

Após o deploy:

1. Acesse seu site no Vercel
2. Abra o Console do navegador (F12)
3. Procure por logs que começam com `[Supabase]`
4. Se as variáveis estiverem configuradas corretamente, você verá:
   - `[Supabase] ✅ URL válida`
   - `[Supabase] ✅ Cliente inicializado com sucesso`

## Importante

⚠️ **As variáveis DEVE começar com `VITE_`** para serem expostas ao cliente no Vite.

❌ **NÃO use:**
- `SUPABASE_URL` (sem VITE_)
- `SUPABASE_ANON_KEY` (sem VITE_)

✅ **USE:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Onde Encontrar as Credenciais do Supabase

1. Acesse [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **Settings** > **API**
4. Você encontrará:
   - **Project URL** → Use como `VITE_SUPABASE_URL`
   - **Project API keys** → Use a chave `anon` `public` como `VITE_SUPABASE_ANON_KEY`

## Troubleshooting

### As variáveis não estão sendo carregadas

1. Verifique se as variáveis começam com `VITE_`
2. Verifique se selecionou todos os ambientes (Production, Preview, Development)
3. Faça um novo deploy após adicionar as variáveis
4. Limpe o cache do navegador (Ctrl+Shift+R ou Cmd+Shift+R)

### Erro de autenticação

- Verifique se a chave `anon` `public` está correta
- Certifique-se de que não está usando a chave `service_role` (ela é privada)

### Erro de conexão

- Verifique se a URL do Supabase está correta
- Verifique se o projeto Supabase está ativo
- Verifique se há restrições de CORS no Supabase

## Suporte

Se ainda tiver problemas, verifique os logs no console do navegador. Os logs começam com `[Supabase]` e fornecem informações detalhadas sobre o que está acontecendo.

