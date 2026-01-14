# Integração com FBref.com

## Visão Geral

O aplicativo agora suporta extração automática de dados de tabelas do fbref.com, eliminando a necessidade de copiar/colar JSON manualmente.

## Como Usar

### 1. Acessar a Funcionalidade

1. Vá para a tela de **Campeonatos**
2. Selecione um campeonato
3. Clique em **Atualizar Tabelas**
4. Na seção **Extração Automática do FBref.com**, clique em **Extrair do FBref.com**

### 2. Extrair Dados

1. Cole a URL completa do campeonato no fbref.com
   - Exemplo: `https://fbref.com/en/comps/9/2024-2025/2024-2025-Premier-League-Stats`
2. Selecione o tipo de tabela:
   - **Geral**: Tabela de classificação completa
   - **Standard (For)**: Estatísticas complementares
3. Clique em **Extrair Dados**
4. Aguarde o processamento (pode levar alguns segundos)
5. Revise o preview dos dados extraídos
6. Clique em **Salvar Tabela** para persistir no banco de dados

### 3. Usar os Dados

Após salvar a tabela:
1. Volte para a tela de **Partida**
2. Preencha os dados da partida
3. Clique em **Sincronizar com Tabela** para usar os dados extraídos na análise

## Limitações e Considerações

### Rate Limiting
- O sistema respeita os termos de uso do fbref.com
- Há um delay de 3 segundos entre requisições
- Cache local de 1 hora para evitar requisições desnecessárias

### Validação de URLs
- Apenas URLs do fbref.com são permitidas
- A URL deve apontar para uma página com tabela de classificação

### Parsing de Dados
- O sistema extrai automaticamente os dados da tabela HTML
- Campos são normalizados para o formato esperado pelo aplicativo
- O campo `Squad` (nome do time) é obrigatório

## Troubleshooting

### Erro: "Tabela não encontrada na página"
- Verifique se a URL está correta
- Certifique-se de que a página contém uma tabela de classificação
- Tente acessar a URL diretamente no navegador para confirmar

### Erro: "Nenhuma linha de dados encontrada"
- A estrutura da tabela pode ter mudado
- Tente usar a extração manual (upload de JSON) como alternativa

### Erro: "URL inválida"
- Certifique-se de que está usando uma URL do fbref.com
- URLs devem começar com `https://fbref.com` ou `https://www.fbref.com`

## Arquitetura Técnica

### Edge Function
- Localização: `supabase/functions/fbref-scraper/index.ts`
- Faz scraping do HTML do fbref.com
- Converte dados para formato JSON esperado
- Respeita rate limits e termos de uso

### Serviço Frontend
- Localização: `services/fbrefService.ts`
- Cliente para chamar Edge Function
- Cache local com TTL
- Tratamento de erros e retry

### Mapper
- Localização: `utils/fbrefMapper.ts`
- Converte dados brutos para formatos `TableRowGeral[]` e `TableRowStandardFor[]`
- Normaliza nomes de campos

### UI
- Localização: `components/FbrefExtractionModal.tsx`
- Modal para inserir URL e extrair dados
- Preview dos dados antes de salvar
- Integrado com `ChampionshipTableUpdateModal`

## Próximas Melhorias

- [ ] Extração de jogos/resultados
- [ ] Extração de estatísticas detalhadas de times
- [ ] Suporte a múltiplas tabelas de uma vez
- [ ] Melhor tratamento de erros e feedback visual

