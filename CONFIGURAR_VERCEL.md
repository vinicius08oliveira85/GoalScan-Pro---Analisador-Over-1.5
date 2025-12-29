# ⚡ Configuração Rápida - Vercel

## 🎯 Você já tem a URL do Supabase!
✅ URL: `https://vebpalhcvzbbzmdzglag.supabase.co`

## 📋 Agora você precisa:

### 1. Obter a Chave Anônima do Supabase

1. Acesse: **https://supabase.com/dashboard**
2. Selecione seu projeto
3. Vá em **Settings** > **API**
4. Em **Project API keys**, copie a chave **`anon` `public`** (não a `service_role`!)

### 2. Configurar no Vercel

#### Opção A: Automático (Recomendado)

Execute o script com sua chave:

```bash
npm run setup:vercel:api
```

O script vai pedir sua chave anônima e configurar automaticamente via API do Vercel.

#### Opção B: Manual (5 minutos)

1. Acesse: **https://vercel.com/dashboard**
2. Selecione: **goal-scan-pro-analisador-over-1-5**
3. Vá em **Settings** > **Environment Variables**
4. Clique em **Add New** e adicione:

   **Variável 1:**
   - **Key:** `VITE_SUPABASE_URL`
   - **Value:** `https://vebpalhcvzbbzmdzglag.supabase.co`
   - **Environments:** ☑ Production, ☑ Preview, ☑ Development
   - Clique em **Save**

   **Variável 2:**
   - **Key:** `VITE_SUPABASE_ANON_KEY`
   - **Value:** Cole sua chave anônima aqui
   - **Environments:** ☑ Production, ☑ Preview, ☑ Development
   - Clique em **Save**

   **Variável 3:**
   - **Key:** `GEMINI_API_KEY`
   - **Value:** Cole sua chave da API do Gemini aqui (obtenha em: https://aistudio.google.com/)
   - **Environments:** ☑ Production, ☑ Preview, ☑ Development
   - Clique em **Save**

   **Variável 4 (Opcional - Recomendado):**
   - **Key:** `GEMINI_API_KEY_FALLBACK`
   - **Value:** Cole uma segunda chave da API do Gemini como fallback
   - **Environments:** ☑ Production, ☑ Preview, ☑ Development
   - **Nota:** Esta chave será usada automaticamente se a principal atingir quota ou falhar
   - Clique em **Save**

### 3. Fazer Redeploy

1. Vá em **Deployments**
2. Clique nos **três pontos (...)** do último deployment
3. Selecione **Redeploy**
4. Aguarde 2-3 minutos

### 4. Verificar

Acesse: **https://goal-scan-pro-analisador-over-1-5.vercel.app**

Abra o Console (F12) e procure por:
- ✅ `[Supabase] ✅ Cliente inicializado com sucesso`
- ✅ `[Supabase] X análise(s) carregada(s) com sucesso`

## 🚀 Pronto!

Seu app agora deve carregar as partidas do Supabase corretamente!

