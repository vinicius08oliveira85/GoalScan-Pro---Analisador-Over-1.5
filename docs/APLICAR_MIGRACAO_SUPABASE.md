# Aplicar Migração no Supabase

## Problema
O erro 400 ao salvar tabelas do tipo `'standard_for'` ocorre porque a constraint CHECK na tabela `championship_tables` só permite `table_type = 'geral'`.

## Solução
Execute a migração SQL abaixo no Supabase para atualizar a constraint.

## Como Aplicar

### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **SQL Editor** (no menu lateral)
4. Clique em **New Query**
5. Cole o seguinte SQL:

```sql
-- Atualizar constraint de table_type para aceitar 'geral' e 'standard_for'
-- Esta migração atualiza a constraint CHECK para permitir ambos os tipos de tabela

-- Remover constraint antiga
ALTER TABLE championship_tables 
  DROP CONSTRAINT IF EXISTS championship_tables_table_type_check;

-- Adicionar nova constraint que aceita 'geral' e 'standard_for'
ALTER TABLE championship_tables 
  ADD CONSTRAINT championship_tables_table_type_check 
  CHECK (table_type IN ('geral', 'standard_for'));
```

6. Clique em **Run** (ou pressione Ctrl+Enter)
7. Verifique se a mensagem de sucesso aparece

### Opção 2: Via Supabase CLI (Se configurado)

```bash
# Navegue até a pasta do projeto
cd "caminho/do/projeto"

# Aplique a migração
supabase db push
```

## Verificação

Após aplicar a migração, o erro 400 deve desaparecer e você poderá salvar tabelas do tipo `'standard_for'` normalmente.

## Nota

O código já está preparado para fazer fallback para localStorage caso a constraint ainda não esteja atualizada, mas é recomendado aplicar a migração para sincronização completa com o Supabase.

