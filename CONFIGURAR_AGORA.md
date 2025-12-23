# ⚡ Configurar Agora - Vercel

## ✅ Credenciais

Você precisa das credenciais do Supabase:
- **URL:** Encontre em Settings > API > Project URL
- **Chave Anônima:** Encontre em Settings > API > Project API keys > `anon` `public`

## 🚀 Opção 1: Automático (Recomendado)

Se você tiver um token do Vercel:

```powershell
# 1. Obter token em: https://vercel.com/account/tokens
# 2. Executar:
$env:VERCEL_TOKEN="seu_token_aqui"
npm run config:vercel
```

## 📝 Opção 2: Manual (2 minutos)

1. **Acesse:** https://vercel.com/dashboard
2. **Selecione:** goal-scan-pro-analisador-over-1-5
3. **Vá em:** Settings > Environment Variables
4. **Clique em:** Add New

   **Variável 1:**
   - **Key:** `VITE_SUPABASE_URL`
   - **Value:** `https://vebpalhcvzbbzmdzglag.supabase.co`
   - **Environments:** ☑ Production, ☑ Preview, ☑ Development
   - **Save**

   **Variável 2:**
   - **Key:** `VITE_SUPABASE_ANON_KEY`
   - **Value:** (Cole sua chave anônima do Supabase aqui)
   - **Environments:** ☑ Production, ☑ Preview, ☑ Development
   - **Save**

5. **Fazer Redeploy:**
   - Vá em **Deployments**
   - Clique nos **três pontos (...)** do último deployment
   - Selecione **Redeploy**
   - Aguarde 2-3 minutos

## ✅ Verificar

Acesse: https://goal-scan-pro-analisador-over-1-5.vercel.app

Abra o Console (F12) e procure por:
- ✅ `[Supabase] ✅ Cliente inicializado com sucesso`
- ✅ `[Supabase] X análise(s) carregada(s) com sucesso`

## 🎉 Pronto!

Seu app agora deve carregar as partidas do Supabase!

