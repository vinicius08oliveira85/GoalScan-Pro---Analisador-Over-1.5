# Configuração das Tabelas de Campeonatos no Supabase

Este guia explica como configurar as tabelas de campeonatos no Supabase, incluindo a tabela normalizada `championship_teams`.

## Pré-requisitos

- Conta no Supabase (https://supabase.com)
- Projeto Supabase criado
- Acesso ao SQL Editor do Supabase

## Ordem de Execução das Migrações

Execute as migrações na seguinte ordem no SQL Editor do Supabase:

### 1. Criar Tabela de Campeonatos (se ainda não existir)

**Arquivo:** `supabase/migrations/create_championships.sql`

Esta migração cria:
- Tabela `championships` - Armazena os campeonatos cadastrados
- Tabela `championship_tables` - Armazena dados JSON das tabelas (compatibilidade retroativa)

**⚠️ ATENÇÃO:** Esta migração usa `DROP TABLE IF EXISTS`, então se você já tem dados, faça backup antes!

### 2. Adicionar Campo uploaded_at

**Arquivo:** `supabase/migrations/add_uploaded_at_to_championships.sql`

Esta migração adiciona o campo `uploaded_at` na tabela `championships` para rastrear quando a tabela foi atualizada pela última vez.

**Seguro para executar:** Usa `ADD COLUMN IF NOT EXISTS`, então não afeta dados existentes.

### 3. Criar Tabela Normalizada championship_teams

**Arquivo:** `supabase/migrations/create_championship_teams.sql`

Esta migração cria a tabela normalizada `championship_teams` onde cada time é uma linha separada com todas as colunas do JSON.

**Seguro para executar:** Usa `CREATE TABLE IF NOT EXISTS`, então não afeta dados existentes.

### 4. (Opcional) Preencher Dados de Teste

**Arquivo:** `supabase/migrations/seed_championship_teams_test.sql`

Esta migração cria um campeonato de teste com 18 times da Bundesliga para você testar a funcionalidade.

**⚠️ ATENÇÃO:** Esta migração cria dados de teste. Execute apenas se quiser testar.

## Passo a Passo

### Passo 1: Acessar o SQL Editor

1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. No menu lateral, clique em **SQL Editor**
4. Clique em **New Query**

### Passo 2: Executar Migrações

Execute cada migração na ordem listada acima:

1. **Copie o conteúdo** do arquivo SQL
2. **Cole no SQL Editor** do Supabase
3. Clique em **Run** (ou pressione `Ctrl+Enter`)
4. Verifique se não há erros na mensagem de resultado

### Passo 3: Verificar Tabelas Criadas

Após executar as migrações, verifique se as tabelas foram criadas:

```sql
-- Verificar tabela championships
SELECT * FROM championships LIMIT 5;

-- Verificar tabela championship_teams
SELECT * FROM championship_teams LIMIT 5;

-- Verificar estrutura da tabela championship_teams
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'championship_teams';
```

## Estrutura das Tabelas

### Tabela `championships`

Armazena os campeonatos cadastrados:

- `id` (TEXT, PRIMARY KEY) - ID único do campeonato
- `nome` (TEXT) - Nome do campeonato
- `created_at` (TIMESTAMP) - Data de criação
- `updated_at` (TIMESTAMP) - Data de última atualização
- `uploaded_at` (TIMESTAMP) - Data do último upload de dados

### Tabela `championship_teams`

Armazena dados normalizados dos times (cada time = uma linha):

- `id` (TEXT, PRIMARY KEY) - ID único do registro
- `championship_id` (TEXT, FK) - Referência ao campeonato
- `squad` (TEXT) - Nome do time
- `table_name` (TEXT) - Nome da tabela original
- `rk`, `mp`, `w`, `d`, `l`, `gf`, `ga`, `gd`, `pts`, etc. - Estatísticas do time
- `created_at`, `updated_at` - Timestamps

**Constraint UNIQUE:** `(championship_id, squad)` - Garante que cada time aparece apenas uma vez por campeonato.

## Políticas de Segurança (RLS)

Todas as tabelas têm Row Level Security (RLS) habilitado com política de acesso anônimo, permitindo leitura e escrita sem autenticação.

## Troubleshooting

### Erro: "relation does not exist"

Se você receber este erro, significa que a tabela `championships` ainda não foi criada. Execute primeiro a migração `create_championships.sql`.

### Erro: "column already exists"

Se você receber este erro ao executar `add_uploaded_at_to_championships.sql`, significa que o campo já existe. Isso é normal e o script usa `IF NOT EXISTS`, então pode ser ignorado.

### Erro: "duplicate key value"

Se você receber este erro ao inserir dados, significa que já existe um time com o mesmo `championship_id` e `squad`. O sistema substitui dados ao fazer novo upload, então isso não deveria acontecer em operações normais.

## Próximos Passos

Após configurar as tabelas:

1. Teste fazendo upload de um arquivo Excel ou JSON na aba "Campeonatos"
2. Verifique se os dados foram salvos na tabela `championship_teams`
3. Confirme que o campo `uploaded_at` foi atualizado na tabela `championships`

## Suporte

Se encontrar problemas, verifique:
- Logs do Supabase no dashboard
- Mensagens de erro no SQL Editor
- Console do navegador para erros do frontend

