-- Detectar e atualizar formatos de planilhas para campeonatos existentes
-- Este script detecta automaticamente se um campeonato usa formato "completa" (com xG) ou "basica" (sem xG)
-- baseado nos dados já salvos na tabela championship_teams

-- Atualizar todos os campeonatos que ainda não têm table_format definido
-- usando a função de detecção automática
UPDATE championships
SET table_format = detect_championship_table_format(id)
WHERE table_format IS NULL
  AND EXISTS (
    SELECT 1 
    FROM championship_teams 
    WHERE championship_teams.championship_id = championships.id
    LIMIT 1
  );

-- Adicionar comentário explicativo
COMMENT ON FUNCTION detect_championship_table_format IS 
  'Detecta automaticamente o formato da planilha (completa ou basica) baseado na presença de campos xG nos dados salvos. 
   Retorna "completa" se encontrar campos xG preenchidos, "basica" caso contrário.';

-- Verificar resultados (query útil para debug)
-- SELECT 
--   id,
--   nome,
--   table_format,
--   (SELECT COUNT(*) FROM championship_teams WHERE championship_id = championships.id) as teams_count
-- FROM championships
-- ORDER BY nome;

