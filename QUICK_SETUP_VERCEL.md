# ⚡ Configuração Rápida - Variáveis de Ambiente no Vercel

## 🎯 Objetivo

Configurar as variáveis de ambiente do Supabase no Vercel para que o app funcione em produção.

## 📋 Passo 1: Obter Credenciais do Supabase

1. Acesse: **https://supabase.com/dashboard**
2. Selecione seu projeto
3. Vá em **Settings** > **API**
4. Você encontrará:
   - **Project URL** → Copie esta URL
   - **Project API keys** → Copie a chave `anon` `public` (não a `service_role`!)

## 🚀 Passo 2: Configurar no Vercel

### Opção A: Via Dashboard (Recomendado)

1. Acesse: **https://vercel.com/dashboard**
2. Selecione o projeto: **goal-scan-pro-analisador-over-1-5**
3. Clique em **Settings** (no topo)
4. No menu lateral, clique em **Environment Variables**
5. Clique em **Add New** e adicione:

   **Variável 1:**
   - **Key:** `VITE_SUPABASE_URL`
   - **Value:** Cole a URL do Supabase (ex: `https://xxxxx.supabase.co`)
   - **Environments:** Marque todas (☑ Production, ☑ Preview, ☑ Development)
   - Clique em **Save**

   **Variável 2:**
   - **Key:** `VITE_SUPABASE_ANON_KEY`
   - **Value:** Cole a chave anônima do Supabase
   - **Environments:** Marque todas (☑ Production, ☑ Preview, ☑ Development)
   - Clique em **Save**

### Opção B: Via Script (Se tiver Vercel CLI instalado)

```bash
# 1. Instalar Vercel CLI (se não tiver)
npm install -g vercel

# 2. Fazer login
vercel login

# 3. Executar o script helper
npm run setup:vercel
```

## 🔄 Passo 3: Fazer Redeploy

Após adicionar as variáveis:

1. No Vercel, vá em **Deployments**
2. Clique nos **três pontos (...)** do último deployment
3. Selecione **Redeploy**
4. Aguarde o deploy concluir (2-3 minutos)

## ✅ Verificar se Funcionou

1. Acesse seu site: **https://goal-scan-pro-analisador-over-1-5.vercel.app**
2. Abra o Console do navegador (F12)
3. Procure por logs que começam com `[Supabase]`
4. Se estiver funcionando, você verá:
   - `[Supabase] ✅ URL válida`
   - `[Supabase] ✅ Cliente inicializado com sucesso`
   - `[Supabase] X análise(s) carregada(s) com sucesso`

## 🆘 Problemas Comuns

### As variáveis não aparecem

- ✅ Certifique-se de que começam com `VITE_` (As variáveis DEVEM começar com VITE_)
- ✅ Verifique se selecionou todos os ambientes
- ✅ Faça um novo deploy após adicionar

### Erro de autenticação

- ✅ Use a chave `anon` `public`, não a `service_role`
- ✅ Verifique se copiou a chave completa

### Ainda mostra "NÃO CONFIGURADO"

- ✅ Limpe o cache do navegador (Ctrl+Shift+R)
- ✅ Aguarde alguns minutos após o deploy
- ✅ Verifique se as variáveis estão salvas no Vercel

## 📞 Precisa de Ajuda?

Se ainda tiver problemas, verifique:

- Os logs no console do navegador
- O guia completo em: [docs/vercel_setup.md](docs/vercel_setup.md)
