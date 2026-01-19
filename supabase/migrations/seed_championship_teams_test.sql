-- Script para preencher dados de teste na tabela championship_teams
-- Usa dados do arquivo results2025-2026201_overall.json

-- 1. Criar campeonato de teste (se não existir)
INSERT INTO championships (id, nome, created_at, updated_at, uploaded_at)
VALUES (
  'test_championship_001',
  'Bundesliga 2025-2026 (Teste)',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET updated_at = NOW(), uploaded_at = NOW();

-- 2. Limpar dados existentes do campeonato de teste (se houver)
DELETE FROM championship_teams WHERE championship_id = 'test_championship_001';

-- 3. Inserir times normalizados do campeonato de teste
INSERT INTO championship_teams (
  id,
  championship_id,
  squad,
  table_name,
  rk,
  mp,
  w,
  d,
  l,
  gf,
  ga,
  gd,
  pts,
  pts_mp,
  xg,
  xga,
  xgd,
  xgd_90,
  last_5,
  attendance,
  top_team_scorer,
  goalkeeper,
  notes,
  created_at,
  updated_at
) VALUES
  ('test_team_001', 'test_championship_001', 'Bayern Munich', 'results2025-2026201_overall', '1', '16', '14', '2', '0', '63', '12', '+51', '44', '2.75', '46.9', '11.9', '+35.0', '+2.19', 'WWDWW', '75,000', 'Harry Kane-20', 'Manuel Neuer', '', NOW(), NOW()),
  ('test_team_002', 'test_championship_001', 'Dortmund', 'results2025-2026201_overall', '2', '16', '9', '6', '1', '29', '15', '+14', '33', '2.06', '25.2', '16.2', '+9.0', '+0.56', 'WWDWD', '81,365', 'Serhou Guirassy,Maximilian Beier-5', 'Gregor Kobel', '', NOW(), NOW()),
  ('test_team_003', 'test_championship_001', 'RB Leipzig', 'results2025-2026201_overall', '3', '15', '9', '2', '4', '30', '19', '+11', '29', '1.93', '27.9', '20.7', '+7.2', '+0.48', 'WDWLL', '46,725', 'Christoph Baumgartner,Yan Diomandé-6', 'Péter Gulácsi', '', NOW(), NOW()),
  ('test_team_004', 'test_championship_001', 'Leverkusen', 'results2025-2026201_overall', '4', '16', '9', '2', '5', '34', '24', '+10', '29', '1.81', '29.0', '20.4', '+8.6', '+0.54', 'LLWWL', '30,013', 'Patrik Schick-6', 'Mark Flekken', '', NOW(), NOW()),
  ('test_team_005', 'test_championship_001', 'Stuttgart', 'results2025-2026201_overall', '5', '16', '9', '2', '5', '29', '23', '+6', '29', '1.81', '24.4', '22.3', '+2.1', '+0.13', 'LLWDW', '59,500', 'Deniz Undav-9', 'Alexander Nübel', '', NOW(), NOW()),
  ('test_team_006', 'test_championship_001', 'Hoffenheim', 'results2025-2026201_overall', '6', '15', '8', '3', '4', '29', '20', '+9', '27', '1.80', '22.5', '22.6', '-0.1', '-0.01', 'DWLWD', '27,358', 'Fisnik Asllani-6', 'Oliver Baumann', '', NOW(), NOW()),
  ('test_team_007', 'test_championship_001', 'Eint Frankfurt', 'results2025-2026201_overall', '7', '16', '7', '5', '4', '33', '33', '0', '26', '1.63', '23.8', '21.7', '+2.2', '+0.14', 'DLWDD', '59,100', 'Jonathan Burkardt-8', 'Michael Zetterer', '', NOW(), NOW()),
  ('test_team_008', 'test_championship_001', 'Freiburg', 'results2025-2026201_overall', '8', '16', '6', '5', '5', '27', '27', '0', '23', '1.44', '26.6', '20.3', '+6.2', '+0.39', 'WLDWW', '34,250', 'Vincenzo Grifo-6', 'Noah Atubolu', '', NOW(), NOW()),
  ('test_team_009', 'test_championship_001', 'Union Berlin', 'results2025-2026201_overall', '9', '16', '6', '4', '6', '22', '25', '-3', '22', '1.38', '20.8', '21.0', '-0.3', '-0.02', 'LLWWD', '21,981', 'Ilyas Ansah-5', 'Frederik Rønnow', '', NOW(), NOW()),
  ('test_team_010', 'test_championship_001', 'Gladbach', 'results2025-2026201_overall', '10', '16', '5', '4', '7', '22', '24', '-2', '19', '1.19', '22.2', '23.6', '-1.4', '-0.09', 'DWLLW', '51,308', 'Haris Tabakovic-9', 'Moritz Nicolas', '', NOW(), NOW()),
  ('test_team_011', 'test_championship_001', 'Köln', 'results2025-2026201_overall', '11', '16', '4', '5', '7', '24', '26', '-2', '17', '1.06', '23.6', '25.5', '-1.9', '-0.12', 'DDLLD', '50,000', 'Said El Mala-7', 'Marvin Schwäbe', '', NOW(), NOW()),
  ('test_team_012', 'test_championship_001', 'Werder Bremen', 'results2025-2026201_overall', '12', '15', '4', '5', '6', '18', '28', '-10', '17', '1.13', '17.6', '26.1', '-8.4', '-0.56', 'LDLLD', '41,600', 'Jens Stage-5', 'Mio Backhaus', '', NOW(), NOW()),
  ('test_team_013', 'test_championship_001', 'Hamburger SV', 'results2025-2026201_overall', '13', '16', '4', '4', '8', '17', '27', '-10', '16', '1.00', '18.7', '25.0', '-6.3', '-0.39', 'WWLDL', '56,888', 'Albert Sambi Lokonga,Rayan Philippe-4', 'Daniel Heuer Fernandes', '', NOW(), NOW()),
  ('test_team_014', 'test_championship_001', 'Wolfsburg', 'results2025-2026201_overall', '14', '16', '4', '3', '9', '24', '36', '-12', '15', '0.94', '21.9', '28.4', '-6.6', '-0.41', 'DWWLL', '23,674', 'Mohamed Amoura-6', 'Kamil Grabara', '', NOW(), NOW()),
  ('test_team_015', 'test_championship_001', 'Augsburg', 'results2025-2026201_overall', '15', '16', '4', '2', '10', '17', '32', '-15', '14', '0.88', '18.5', '28.8', '-10.3', '-0.64', 'LWLDL', '29,743', 'Fabian Rieder-3', 'Finn Dahmen', '', NOW(), NOW()),
  ('test_team_016', 'test_championship_001', 'St. Pauli', 'results2025-2026201_overall', '16', '15', '3', '3', '9', '13', '26', '-13', '12', '0.80', '12.2', '23.7', '-11.5', '-0.77', 'LLDWD', '29,503', 'Andreas Hountondji-4', 'Nikola Vasilj', '', NOW(), NOW()),
  ('test_team_017', 'test_championship_001', 'Heidenheim', 'results2025-2026201_overall', '17', '16', '3', '3', '10', '15', '36', '-21', '12', '0.75', '20.6', '31.2', '-10.6', '-0.66', 'WWLLD', '14,778', 'Stefan Schimmer-4', 'Diant Ramaj', '', NOW(), NOW()),
  ('test_team_018', 'test_championship_001', 'Mainz 05', 'results2025-2026201_overall', '18', '16', '1', '6', '9', '15', '28', '-13', '9', '0.56', '18.1', '31.1', '-13.0', '-0.81', 'LLDDD', '31,840', 'Nadiem Amiri-4', 'Robin Zentner', '', NOW(), NOW());

-- 4. Verificar dados inseridos
SELECT 
  COUNT(*) as total_teams,
  championship_id,
  table_name
FROM championship_teams
WHERE championship_id = 'test_championship_001'
GROUP BY championship_id, table_name;

