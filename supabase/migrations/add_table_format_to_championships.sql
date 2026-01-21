-- Adicionar campo table_format na tabela championships
-- Este campo indica se a planilha do campeonato é "completa" (com xG) ou "basica" (sem xG)
-- Permite NULL para compatibilidade com dados existentes

ALTER TABLE championships 
  ADD COLUMN IF NOT EXISTS table_format TEXT CHECK (table_format IN ('completa', 'basica'));

-- Adicionar comentário descritivo
COMMENT ON COLUMN championships.table_format IS 
  'Formato da planilha: "completa" (27 campos com xG) ou "basica" (21 campos sem xG). NULL indica formato não detectado ainda.';

-- Criar função para detectar formato automaticamente baseado nos dados salvos
CREATE OR REPLACE FUNCTION detect_championship_table_format(champ_id TEXT)
RETURNS TEXT AS $$
DECLARE
  has_xg BOOLEAN;
BEGIN
  -- Verificar se existem dados com campos xG na tabela championship_teams
  SELECT EXISTS(
    SELECT 1 
    FROM championship_teams 
    WHERE championship_id = champ_id 
      AND (
        (home_xg IS NOT NULL AND home_xg != '' AND home_xg != '0') OR
        (home_xga IS NOT NULL AND home_xga != '' AND home_xga != '0') OR
        (away_xg IS NOT NULL AND away_xg != '' AND away_xg != '0') OR
        (away_xga IS NOT NULL AND away_xga != '' AND away_xga != '0')
      )
    LIMIT 1
  ) INTO has_xg;
  
  -- Retornar formato detectado
  IF has_xg THEN
    RETURN 'completa';
  ELSE
    RETURN 'basica';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Adicionar comentário na função
COMMENT ON FUNCTION detect_championship_table_format IS 
  'Detecta automaticamente o formato da planilha (completa ou basica) baseado na presença de campos xG nos dados salvos';

