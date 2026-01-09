/**
 * Script para importar dados do JSON para o Supabase usando MCP
 * 
 * Este script lê o arquivo JSON e importa todos os dados para a tabela overall_statistics_import
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
 * Escapa strings para SQL
 */
function escapeSqlString(str: string | null | undefined): string {
  if (!str) return 'NULL';
  return `'${str.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

/**
 * Converte string numérica removendo vírgulas
 */
function parseNumber(value: string): number {
  return parseInt(value.replace(/,/g, ''), 10) || 0;
}

/**
 * Converte string decimal removendo vírgulas
 */
function parseDecimal(value: string): number | null {
  if (!value || value.trim() === '') return null;
  return parseFloat(value.replace(/,/g, '')) || null;
}

/**
 * Gera SQL para inserção de um registro
 */
function generateInsertValue(row: OverallStatisticsRow, championshipId: string): string {
  const values = [
    escapeSqlString(championshipId),
    parseNumber(row.Rk),
    escapeSqlString(row.Squad),
    parseNumber(row.MP),
    parseNumber(row.W),
    parseNumber(row.D),
    parseNumber(row.L),
    parseNumber(row.GF),
    parseNumber(row.GA),
    escapeSqlString(row.GD),
    parseNumber(row.Pts),
    parseDecimal(row['Pts/MP']) ?? 'NULL',
    parseDecimal(row.xG) ?? 'NULL',
    parseDecimal(row.xGA) ?? 'NULL',
    parseDecimal(row.xGD) ?? 'NULL',
    parseDecimal(row['xGD/90']) ?? 'NULL',
    escapeSqlString(row['Last 5']),
    escapeSqlString(row.Attendance),
    escapeSqlString(row['Top Team Scorer_link']),
    escapeSqlString(row['Top Team Scorer']),
    escapeSqlString(row['Goalkeeper_link']),
    escapeSqlString(row.Goalkeeper),
    escapeSqlString(row.Notes),
    escapeSqlString(JSON.stringify(row)) + '::jsonb',
  ];
  return `(${values.join(', ')})`;
}

/**
 * Gera SQL completo para importação
 */
function generateImportSQL(
  data: OverallStatisticsRow[],
  championshipId: string
): string {
  const values = data.map((row) => generateInsertValue(row, championshipId));
  
  return `-- Importação de estatísticas gerais
-- Championship ID: ${championshipId}
-- Total de registros: ${data.length}
-- Data: ${new Date().toISOString()}

-- Limpar dados existentes para este campeonato (opcional - descomente se necessário)
-- DELETE FROM overall_statistics_import WHERE championship_id = ${escapeSqlString(championshipId)};

INSERT INTO overall_statistics_import (
  championship_id, rank, squad, matches_played, wins, draws, losses,
  goals_for, goals_against, goal_difference, points, points_per_match,
  expected_goals, expected_goals_against, expected_goal_difference,
  expected_goal_difference_per_90, last_5_form, attendance,
  top_team_scorer_link, top_team_scorer, goalkeeper_link, goalkeeper,
  notes, raw_data
) VALUES
${values.join(',\n')}
ON CONFLICT DO NOTHING;

-- Verificar importação
SELECT COUNT(*) as total_registros, championship_id 
FROM overall_statistics_import 
WHERE championship_id = ${escapeSqlString(championshipId)}
GROUP BY championship_id;
`;
}

/**
 * Função principal
 */
async function importData(championshipId: string, jsonFilePath: string): Promise<string> {
  console.log(`📊 Iniciando importação...`);
  console.log(`   Championship ID: ${championshipId}`);
  console.log(`   Arquivo JSON: ${jsonFilePath}`);

  // Ler arquivo JSON
  const filePath = join(process.cwd(), jsonFilePath);
  const fileContent = readFileSync(filePath, 'utf-8');
  const data: OverallStatisticsRow[] = JSON.parse(fileContent);

  console.log(`   ✅ ${data.length} registros encontrados no JSON`);

  // Gerar SQL
  const sql = generateImportSQL(data, championshipId);

  // Salvar SQL em arquivo
  const sqlFilePath = join(
    process.cwd(),
    `supabase/migrations/import_overall_stats_${championshipId}_${Date.now()}.sql`
  );
  require('fs').writeFileSync(sqlFilePath, sql, 'utf-8');

  console.log(`   ✅ SQL gerado: ${sqlFilePath}`);
  console.log(`\n💡 Para importar, execute o SQL no Supabase ou use o MCP`);

  return sql;
}

// Executar se chamado diretamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('❌ Erro: Argumentos insuficientes');
    console.log('\nUso:');
    console.log('  npx tsx scripts/import-json-to-supabase.ts <championship_id> <caminho_do_json>');
    console.log('\nExemplo:');
    console.log('  npx tsx scripts/import-json-to-supabase.ts "serie-a-2025-2026" "Jsons/results2025-2026111_overall (1).json"');
    process.exit(1);
  }

  const [championshipId, jsonFilePath] = args;
  
  importData(championshipId, jsonFilePath)
    .then(() => {
      console.log('\n✅ Processamento concluído!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erro:', error);
      process.exit(1);
    });
}

export { importData, generateImportSQL };

