# 🔧 Configurar Branch de Produção no Vercel

## ✅ Solução Recomendada: Mudar Branch Padrão no GitHub

A forma mais simples é mudar a branch padrão do repositório no GitHub. O Vercel detecta automaticamente e usa essa branch como produção.

### Passos:

1. **Acesse as configurações do repositório:**
   - https://github.com/vinicius08oliveira85/GoalScan-Pro---Analisador-Over-1-5/settings/branches

2. **Em "Default branch", clique em "Switch to another branch"**

3. **Selecione `producao` e confirme**

4. **Pronto!** O Vercel agora usará `producao` como branch de produção

---

## 🔧 Alternativa: Usar Script via API do Vercel

Se preferir usar a API do Vercel diretamente:

### Pré-requisitos:
- Token do Vercel (obtenha em: https://vercel.com/account/tokens)

### Executar:

```bash
# Opção 1: Com token como variável de ambiente
$env:VERCEL_TOKEN="seu_token_aqui"
npm run set:vercel:production-branch

# Opção 2: O script pedirá o token interativamente
npm run set:vercel:production-branch
```

---

## 📝 Nota

Após mudar a branch padrão no GitHub ou configurar via API, pode levar alguns minutos para o Vercel processar a mudança. Verifique em **Settings > Git** do seu projeto no Vercel.

