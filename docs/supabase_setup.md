# Configuração do Supabase

Este documento explica como configurar o Supabase para o GoalScan Pro - Analisador Over 1.5.

## Pré-requisitos

- Conta no Supabase (https://supabase.com)
- Projeto Supabase criado
- URL e chave anônima do projeto configuradas em `lib/supabase.ts`

## Tabelas Necessárias

O aplicativo utiliza duas tabelas no Supabase:

1. **saved_analyses**: Armazena análises de partidas salvas
2. **bank_settings**: Armazena configurações globais de banca (valor total e moeda)

## Estrutura da Tabela saved_analyses

A tabela `saved_analyses` armazena todas as análises de partidas realizadas. Sua estrutura é:

- `id` (TEXT, PRIMARY KEY) - Identificador único da análise
- `timestamp` (BIGINT) - Timestamp da análise
- `match_data` (JSONB) - Dados da partida (times, estatísticas, etc.)
- `analysis_result` (JSONB) - Resultado da análise (probabilidades, EV, etc.)
- `bet_info` (JSONB, opcional) - Informações da aposta associada
- `created_at` (TIMESTAMP) - Data de criação
- `updated_at` (TIMESTAMP) - Data de última atualização

### Adicionando a Coluna bet_info

Se a tabela `saved_analyses` já existe mas não possui a coluna `bet_info`, execute o script de migração:

1. No SQL Editor do Supabase, clique em **New Query**
2. Copie e cole o conteúdo do arquivo `supabase/migrations/add_bet_info_to_saved_analyses.sql`
3. Clique em **Run** (ou pressione `Ctrl+Enter`)

O script irá:
- Adicionar a coluna `bet_info` como JSONB (permite NULL)
- Adicionar comentário descritivo na coluna

**Estrutura do JSON bet_info:**
```json
{
  "betAmount": 100,           // Valor da aposta
  "odd": 1.85,                // Odd da aposta
  "potentialReturn": 185,     // Retorno potencial
  "profit": 85,                // Lucro potencial
  "status": "pending"         // Status: "pending" | "won" | "lost"
}
```

## Criando a Tabela bank_settings

### Passo 1: Acessar o Supabase Dashboard

1. Acesse https://supabase.com e faça login
2. Selecione seu projeto
3. No menu lateral, clique em **SQL Editor**

### Passo 2: Executar o Script SQL

1. No SQL Editor, clique em **New Query**
2. Copie e cole o conteúdo do arquivo `supabase/migrations/create_bank_settings.sql`
3. Clique em **Run** (ou pressione `Ctrl+Enter`)

O script irá:
- Criar a tabela `bank_settings` com a estrutura necessária
- Criar um índice para otimizar buscas
- Habilitar Row Level Security (RLS)
- Criar uma política para permitir acesso anônimo
- Inserir um registro padrão se não existir

### Passo 3: Verificar se a Tabela foi Criada

1. No menu lateral, clique em **Table Editor**
2. Verifique se a tabela `bank_settings` aparece na lista
3. Clique na tabela para visualizar sua estrutura:
   - `id` (TEXT, PRIMARY KEY) - Sempre 'default'
   - `total_bank` (NUMERIC) - Valor total da banca
   - `currency` (TEXT) - Moeda (R$, $, €, etc.)
   - `updated_at` (BIGINT) - Timestamp da última atualização
   - `created_at` (TIMESTAMP) - Data de criação

## Estrutura da Tabela bank_settings

```sql
CREATE TABLE bank_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  total_bank NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'R$',
  updated_at BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Políticas de Segurança (RLS)

A tabela `bank_settings` utiliza Row Level Security (RLS) com uma política que permite acesso anônimo completo. Isso é necessário porque o aplicativo não utiliza autenticação de usuários.

**Importante**: Se você planeja adicionar autenticação no futuro, será necessário atualizar as políticas RLS para restringir o acesso adequadamente.

## Troubleshooting

### Erro PGRST204 - Coluna bet_info não encontrada

Se você verificar erros `PGRST204` no console indicando que a coluna `bet_info` não foi encontrada:

1. **Verifique se a coluna existe**: Acesse Table Editor > `saved_analyses` e verifique as colunas
2. **Execute o script de migração**: Execute `supabase/migrations/add_bet_info_to_saved_analyses.sql`
3. **Recarregue a página**: Após executar o script, recarregue o aplicativo

### Erro 404 ao Carregar/Salvar Configurações

Se você verificar erros 404 no console do navegador ao tentar carregar ou salvar configurações de banca:

1. **Verifique se a tabela existe**: Acesse Table Editor no Supabase Dashboard
2. **Execute o script SQL novamente**: Certifique-se de que o script foi executado completamente
3. **Verifique as políticas RLS**: A política "Allow anonymous access" deve estar ativa
4. **Verifique as credenciais**: Confirme que a URL e a chave anônima em `lib/supabase.ts` estão corretas

### Dados não Sincronizam entre Dispositivos

Se os dados não sincronizam entre dispositivos:

1. **Verifique a conexão com o Supabase**: Abra o console do navegador e verifique se há erros
2. **Verifique se a tabela existe**: Execute o script SQL se necessário
3. **Limpe o cache do navegador**: Às vezes o cache pode causar problemas
4. **Verifique as políticas RLS**: Certifique-se de que a política permite acesso anônimo

### Fallback para localStorage

O sistema possui um fallback automático para `localStorage`. Se a tabela não existir ou houver problemas de conexão, os dados serão salvos apenas localmente. Isso garante que o aplicativo continue funcionando mesmo sem conexão com o Supabase.

## Próximos Passos

Após criar a tabela `bank_settings`:

1. Teste o aplicativo e verifique se os dados são salvos corretamente
2. Abra o aplicativo em outro dispositivo para verificar a sincronização
3. Verifique no Supabase Dashboard se os dados estão sendo salvos na tabela

## Referências

- [Documentação do Supabase](https://supabase.com/docs)
- [SQL Editor do Supabase](https://supabase.com/docs/guides/database/tables)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

