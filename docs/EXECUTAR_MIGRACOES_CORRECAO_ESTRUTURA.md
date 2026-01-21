# Executar Migrações de Correção de Estrutura

Este documento explica como executar as migrações SQL para corrigir a estrutura das tabelas do Supabase e resolver os erros 400 e 409.

## Problema

Os erros 400 e 409 ao salvar campeonatos e tabelas podem estar relacionados a:
- Campo `table_format` não existe na tabela `championships`
- Constraints incorretas na tabela `championship_tables`
- Campos faltantes na tabela `championship_teams`

## Solução

Execute as seguintes migrações SQL no Supabase na ordem especificada:

### 1. Corrigir Estrutura da Tabela championships

**Arquivo:** `supabase/migrations/fix_championships_table_structure.sql`

Esta migração:
- Adiciona campo `table_format` se não existir
- Adiciona campo `fbref_url` se não existir
- Adiciona campo `uploaded_at` se não existir
- Ajusta constraint de `table_format` para permitir NULL

### 2. Corrigir Estrutura da Tabela championship_tables

**Arquivo:** `supabase/migrations/fix_championship_tables_structure.sql`

Esta migração:
- Remove registros com tipos não permitidos
- Ajusta constraint de `table_type` para aceitar apenas: 'geral', 'home_away', 'standard_for'
- Garante que `table_data` pode ser NULL (compatibilidade)
- Define valores padrão para `created_at` e `updated_at`

### 3. Corrigir Estrutura da Tabela championship_teams

**Arquivo:** `supabase/migrations/fix_championship_teams_structure.sql`

Esta migração:
- Adiciona campos Home e Away se não existirem
- Adiciona campo `extra_fields` se não existir
- Garante que todos os campos são opcionais
- Cria constraint UNIQUE se não existir
- Define valores padrão para `created_at` e `updated_at`

## Como Executar

1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. No menu lateral, clique em **SQL Editor**
4. Clique em **New Query**
5. Execute cada migração na ordem:
   - Primeiro: `fix_championships_table_structure.sql`
   - Segundo: `fix_championship_tables_structure.sql`
   - Terceiro: `fix_championship_teams_structure.sql`
6. Verifique se não há erros na mensagem de resultado

## Verificação

Após executar as migrações, verifique se as tabelas estão corretas:

```sql
-- Verificar estrutura de championships
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'championships'
ORDER BY ordinal_position;

-- Verificar estrutura de championship_tables
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'championship_tables'
ORDER BY ordinal_position;

-- Verificar estrutura de championship_teams
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'championship_teams'
ORDER BY ordinal_position;
```

## Notas Importantes

- As migrações usam `ADD COLUMN IF NOT EXISTS`, então são seguras para executar múltiplas vezes
- As migrações não apagam dados existentes
- Se houver erros, verifique os logs no SQL Editor do Supabase

