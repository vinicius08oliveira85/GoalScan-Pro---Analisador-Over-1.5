/**
 * Script para importar dados de estatísticas gerais do JSON para o Supabase
 * 
 * Uso:
 *   npx tsx scripts/import-overall-statistics.ts <championship_id> <caminho_do_json>
 * 
 * Exemplo:
 *   npx tsx scripts/import-overall-statistics.ts "serie-a-2025" "Jsons/results2025-2026111_overall (1).json"
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface OverallStatisticsRow {
  Rk: string;
  Squad: string;
  MP: string;
  W: string;
  D: string;
  L: string;
  GF: string;
  GA: string;
  GD: string;
  Pts: string;
  'Pts/MP': string;
  xG: string;
  xGA: string;
  xGD: string;
  'xGD/90': string;
  'Last 5': string;
  Attendance: string;
  'Top Team Scorer_link'?: string;
  'Top Team Scorer': string;
  'Goalkeeper_link'?: string;
  Goalkeeper: string;
  Notes: string;
}

/**
 * Converte string numérica removendo vírgulas e convertendo para número
 */
function parseNumber(value: string): number {
  return parseInt(value.replace(/,/g, ''), 10) || 0;
}

/**
 * Converte string decimal removendo vírgulas e convertendo para número
 */
function parseDecimal(value: string): number {
  return parseFloat(value.replace(/,/g, '')) || 0;
}

/**
 * Converte dados do JSON para formato da tabela
 */
function convertToDatabaseFormat(
  row: OverallStatisticsRow,
  championshipId: string
): Record<string, unknown> {
  // Extrair número do GD (remover + ou -)
  const gdValue = row.GD.replace(/[+-]/g, '');
  
  return {
    championship_id: championshipId,
    rank: parseNumber(row.Rk),
    squad: row.Squad,
    matches_played: parseNumber(row.MP),
    wins: parseNumber(row.W),
    draws: parseNumber(row.D),
    losses: parseNumber(row.L),
    goals_for: parseNumber(row.GF),
    goals_against: parseNumber(row.GA),
    goal_difference: row.GD, // Manter formato original com + ou -
    points: parseNumber(row.Pts),
    points_per_match: parseDecimal(row['Pts/MP']),
    expected_goals: row.xG ? parseDecimal(row.xG) : null,
    expected_goals_against: row.xGA ? parseDecimal(row.xGA) : null,
    expected_goal_difference: row.xGD ? parseDecimal(row.xGD) : null,
    expected_goal_difference_per_90: row['xGD/90'] ? parseDecimal(row['xGD/90']) : null,
    last_5_form: row['Last 5'] || null,
    attendance: row.Attendance || null,
    top_team_scorer_link: row['Top Team Scorer_link'] || null,
    top_team_scorer: row['Top Team Scorer'] || null,
    goalkeeper_link: row['Goalkeeper_link'] || null,
    goalkeeper: row.Goalkeeper || null,
    notes: row.Notes || null,
    raw_data: row, // Armazenar dados originais completos
  };
}

/**
 * Função principal de importação
 */
async function importOverallStatistics(
  championshipId: string,
  jsonFilePath: string
): Promise<void> {
  console.log(`📊 Iniciando importação de estatísticas gerais...`);
  console.log(`   Championship ID: ${championshipId}`);
  console.log(`   Arquivo JSON: ${jsonFilePath}`);

  // Ler arquivo JSON
  const filePath = join(process.cwd(), jsonFilePath);
  const fileContent = readFileSync(filePath, 'utf-8');
  const data: OverallStatisticsRow[] = JSON.parse(fileContent);

  console.log(`   ✅ ${data.length} registros encontrados no JSON`);

  // Converter dados
  const records = data.map((row) => convertToDatabaseFormat(row, championshipId));

  // Importar usando Supabase MCP
  // Nota: Este script precisa ser executado em um ambiente que tenha acesso ao MCP do Supabase
  // Por enquanto, vamos gerar SQL para inserção
  
  console.log(`\n📝 SQL para inserção (primeiros 3 registros como exemplo):`);
  console.log(`\nINSERT INTO overall_statistics_import (
    championship_id, rank, squad, matches_played, wins, draws, losses,
    goals_for, goals_against, goal_difference, points, points_per_match,
    expected_goals, expected_goals_against, expected_goal_difference,
    expected_goal_difference_per_90, last_5_form, attendance,
    top_team_scorer_link, top_team_scorer, goalkeeper_link, goalkeeper,
    notes, raw_data
  ) VALUES\n`);

  const sqlValues = records.slice(0, 3).map((record) => {
    const values = [
      `'${record.championship_id}'`,
      record.rank,
      `'${record.squad.replace(/'/g, "''")}'`,
      record.matches_played,
      record.wins,
      record.draws,
      record.losses,
      record.goals_for,
      record.goals_against,
      `'${record.goal_difference}'`,
      record.points,
      record.points_per_match,
      record.expected_goals ?? 'NULL',
      record.expected_goals_against ?? 'NULL',
      record.expected_goal_difference ?? 'NULL',
      record.expected_goal_difference_per_90 ?? 'NULL',
      record.last_5_form ? `'${record.last_5_form}'` : 'NULL',
      record.attendance ? `'${record.attendance}'` : 'NULL',
      record.top_team_scorer_link ? `'${record.top_team_scorer_link.replace(/'/g, "''")}'` : 'NULL',
      record.top_team_scorer ? `'${record.top_team_scorer.replace(/'/g, "''")}'` : 'NULL',
      record.goalkeeper_link ? `'${record.goalkeeper_link.replace(/'/g, "''")}'` : 'NULL',
      record.goalkeeper ? `'${record.goalkeeper.replace(/'/g, "''")}'` : 'NULL',
      record.notes ? `'${record.notes.replace(/'/g, "''")}'` : 'NULL',
      `'${JSON.stringify(record.raw_data).replace(/'/g, "''")}'::jsonb`,
    ];
    return `(${values.join(', ')})`;
  });

  console.log(sqlValues.join(',\n'));
  console.log(`\n... (${records.length - 3} registros restantes)\n`);

  // Gerar arquivo SQL completo
  const allSqlValues = records.map((record) => {
    const values = [
      `'${record.championship_id}'`,
      record.rank,
      `'${record.squad.replace(/'/g, "''")}'`,
      record.matches_played,
      record.wins,
      record.draws,
      record.losses,
      record.goals_for,
      record.goals_against,
      `'${record.goal_difference}'`,
      record.points,
      record.points_per_match,
      record.expected_goals ?? 'NULL',
      record.expected_goals_against ?? 'NULL',
      record.expected_goal_difference ?? 'NULL',
      record.expected_goal_difference_per_90 ?? 'NULL',
      record.last_5_form ? `'${record.last_5_form}'` : 'NULL',
      record.attendance ? `'${record.attendance}'` : 'NULL',
      record.top_team_scorer_link ? `'${record.top_team_scorer_link.replace(/'/g, "''")}'` : 'NULL',
      record.top_team_scorer ? `'${record.top_team_scorer.replace(/'/g, "''")}'` : 'NULL',
      record.goalkeeper_link ? `'${record.goalkeeper_link.replace(/'/g, "''")}'` : 'NULL',
      record.goalkeeper ? `'${record.goalkeeper.replace(/'/g, "''")}'` : 'NULL',
      record.notes ? `'${record.notes.replace(/'/g, "''")}'` : 'NULL',
      `'${JSON.stringify(record.raw_data).replace(/'/g, "''")}'::jsonb`,
    ];
    return `(${values.join(', ')})`;
  });

  const fullSql = `-- Importação de estatísticas gerais
-- Championship ID: ${championshipId}
-- Total de registros: ${records.length}
-- Data: ${new Date().toISOString()}

-- Limpar dados existentes para este campeonato (opcional)
-- DELETE FROM overall_statistics_import WHERE championship_id = '${championshipId}';

INSERT INTO overall_statistics_import (
  championship_id, rank, squad, matches_played, wins, draws, losses,
  goals_for, goals_against, goal_difference, points, points_per_match,
  expected_goals, expected_goals_against, expected_goal_difference,
  expected_goal_difference_per_90, last_5_form, attendance,
  top_team_scorer_link, top_team_scorer, goalkeeper_link, goalkeeper,
  notes, raw_data
) VALUES
${allSqlValues.join(',\n')};

-- Verificar importação
SELECT COUNT(*) as total_registros, championship_id 
FROM overall_statistics_import 
WHERE championship_id = '${championshipId}'
GROUP BY championship_id;
`;

  const sqlFilePath = join(process.cwd(), `supabase/migrations/import_overall_stats_${championshipId}_${Date.now()}.sql`);
  require('fs').writeFileSync(sqlFilePath, fullSql, 'utf-8');
  
  console.log(`✅ Arquivo SQL gerado: ${sqlFilePath}`);
  console.log(`\n💡 Para importar os dados, você pode:`);
  console.log(`   1. Executar o SQL diretamente no Supabase`);
  console.log(`   2. Ou usar o MCP do Supabase para executar o SQL`);
  console.log(`\n📊 Resumo da importação:`);
  console.log(`   - Total de registros: ${records.length}`);
  console.log(`   - Championship ID: ${championshipId}`);
  console.log(`   - Times únicos: ${new Set(records.map(r => r.squad)).size}`);
}

// Executar se chamado diretamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('❌ Erro: Argumentos insuficientes');
    console.log('\nUso:');
    console.log('  npx tsx scripts/import-overall-statistics.ts <championship_id> <caminho_do_json>');
    console.log('\nExemplo:');
    console.log('  npx tsx scripts/import-overall-statistics.ts "serie-a-2025" "Jsons/results2025-2026111_overall (1).json"');
    process.exit(1);
  }

  const [championshipId, jsonFilePath] = args;
  
  importOverallStatistics(championshipId, jsonFilePath)
    .then(() => {
      console.log('\n✅ Importação concluída com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erro durante importação:', error);
      process.exit(1);
    });
}

export { importOverallStatistics, convertToDatabaseFormat };

