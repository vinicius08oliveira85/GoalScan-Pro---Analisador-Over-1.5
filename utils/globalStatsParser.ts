import * as XLSX from 'xlsx';
import { TeamStatistics, GolsStats, PercursoStats } from '../types';

interface ParsedGlobalStats {
  homeTeamStats: TeamStatistics;
  awayTeamStats: TeamStatistics;
}

/**
 * Converte um valor de string para número, removendo % e tratando valores vazios
 */
function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  
  const str = String(value).trim();
  if (str === '' || str === '-' || str === 'N/A') {
    return 0;
  }
  
  // Remover % e espaços
  const cleaned = str.replace(/%/g, '').replace(/\s/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Cria um objeto GolsStats vazio
 */
function createEmptyGolsStats(): GolsStats {
  return {
    avgScored: 0,
    avgConceded: 0,
    avgTotal: 0,
    cleanSheetPct: 0,
    noGoalsPct: 0,
    over25Pct: 0,
    under25Pct: 0,
  };
}

/**
 * Cria um objeto PercursoStats vazio
 */
function createEmptyPercursoStats(): PercursoStats {
  return {
    winStreak: 0,
    drawStreak: 0,
    lossStreak: 0,
    withoutWin: 0,
    withoutDraw: 0,
    withoutLoss: 0,
  };
}

/**
 * Cria um objeto TeamStatistics vazio
 */
function createEmptyTeamStatistics(): TeamStatistics {
  return {
    percurso: {
      home: createEmptyPercursoStats(),
      away: createEmptyPercursoStats(),
      global: createEmptyPercursoStats(),
    },
    gols: {
      home: createEmptyGolsStats(),
      away: createEmptyGolsStats(),
      global: createEmptyGolsStats(),
    },
  };
}

/**
 * Extrai dados de uma seção (Time Casa ou Time Fora) da planilha
 */
function extractTeamStats(
  rows: unknown[][],
  startRow: number,
  endRow: number
): { home: GolsStats; away: GolsStats; global: GolsStats } | null {
  // Procurar linha de cabeçalho (deve conter "Casa", "Fora", "Global")
  let headerRowIndex = -1;
  let casaColIndex = -1;
  let foraColIndex = -1;
  let globalColIndex = -1;

  for (let i = startRow; i <= endRow && i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    // Procurar colunas Casa, Fora, Global
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').trim().toLowerCase();
      if (cell === 'casa') {
        casaColIndex = j;
      } else if (cell === 'fora') {
        foraColIndex = j;
      } else if (cell === 'global') {
        globalColIndex = j;
      }
    }

    // Se encontrou todas as colunas, esta é a linha de cabeçalho
    if (casaColIndex >= 0 && foraColIndex >= 0 && globalColIndex >= 0) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex < 0 || casaColIndex < 0 || foraColIndex < 0 || globalColIndex < 0) {
    return null;
  }

  // Extrair dados das linhas seguintes
  const stats = {
    home: createEmptyGolsStats(),
    away: createEmptyGolsStats(),
    global: createEmptyGolsStats(),
  };

  // Mapeamento de métricas para índices de linha esperados
  const metricMappings: Array<{
    pattern: RegExp;
    field: keyof GolsStats;
  }> = [
    { pattern: /média.*gols.*marcados/i, field: 'avgScored' },
    { pattern: /média.*gols.*sofridos/i, field: 'avgConceded' },
    { pattern: /média.*gols.*marcados.*sofridos|média.*total/i, field: 'avgTotal' },
    { pattern: /jogos.*sem.*sofrer/i, field: 'cleanSheetPct' },
    { pattern: /jogos.*sem.*marcar/i, field: 'noGoalsPct' },
    { pattern: /jogos.*mais.*2[.,]?5.*gols|over.*2[.,]?5/i, field: 'over25Pct' },
    { pattern: /jogos.*menos.*2[.,]?5.*gols|under.*2[.,]?5/i, field: 'under25Pct' },
  ];

  // Processar linhas após o cabeçalho
  for (let i = headerRowIndex + 1; i <= endRow && i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Primeira coluna contém a descrição da métrica
    const metricName = String(row[0] || '').trim();
    if (!metricName) continue;

    // Encontrar qual métrica é esta
    for (const mapping of metricMappings) {
      if (mapping.pattern.test(metricName)) {
        // Extrair valores das colunas Casa, Fora e Global
        const casaRaw = String(row[casaColIndex] || '').trim();
        const foraRaw = String(row[foraColIndex] || '').trim();
        const globalRaw = String(row[globalColIndex] || '').trim();

        // Atualizar estatísticas apenas se o valor não for vazio ou '-'
        if (casaRaw && casaRaw !== '-') {
          (stats.home[mapping.field] as number) = parseNumber(casaRaw);
        }
        if (foraRaw && foraRaw !== '-') {
          (stats.away[mapping.field] as number) = parseNumber(foraRaw);
        }
        if (globalRaw && globalRaw !== '-') {
          (stats.global[mapping.field] as number) = parseNumber(globalRaw);
        }
        break;
      }
    }
  }

  return stats;
}

/**
 * Converte um arquivo Excel (xlsx) ou CSV com Estatísticas Globais para objeto TeamStatistics
 * @param file Arquivo Excel (.xlsx, .xls) ou CSV (.csv) no formato especificado
 * @returns Promise com objeto contendo homeTeamStats e awayTeamStats
 */
export async function parseGlobalStatsExcel(file: File): Promise<ParsedGlobalStats> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const isCsv = file.name.toLowerCase().endsWith('.csv');

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Erro ao ler arquivo'));
          return;
        }

        let workbook: XLSX.WorkBook;

        if (isCsv) {
          // Para CSV, ler como texto e converter
          const text = typeof data === 'string' ? data : new TextDecoder('utf-8').decode(data as ArrayBuffer);
          // Detectar separador: verificar se usa ; ou ,
          const separator = text.includes(';') ? ';' : ',';
          workbook = XLSX.read(text, {
            type: 'string',
            FS: separator,
            codepage: 65001, // UTF-8
          });
        } else {
          // Para Excel, ler como ArrayBuffer
          workbook = XLSX.read(data, { type: 'array' });
        }

        // Pegar primeira planilha
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error('Arquivo não contém planilhas'));
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];

        // Converter para array de arrays (mantém estrutura original)
        const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1, // Retorna array de arrays
          defval: '', // Valor padrão para células vazias
          raw: false, // Converter valores para string
        }) as unknown[][];

        if (!Array.isArray(rows) || rows.length === 0) {
          reject(new Error('Planilha está vazia ou não contém dados'));
          return;
        }

        // Procurar seções "Time Casa" e "Time Fora"
        let timeCasaStart = -1;
        let timeCasaEnd = -1;
        let timeForaStart = -1;
        let timeForaEnd = -1;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row) || row.length === 0) continue;

          const firstCell = String(row[0] || '').trim().toLowerCase();
          
          if (firstCell.includes('time casa') || firstCell.includes('timecasa')) {
            timeCasaStart = i;
            // Procurar próxima seção ou fim do arquivo
            for (let j = i + 1; j < rows.length; j++) {
              const nextRow = rows[j];
              if (Array.isArray(nextRow) && nextRow.length > 0) {
                const nextFirstCell = String(nextRow[0] || '').trim().toLowerCase();
                if (nextFirstCell.includes('time fora') || nextFirstCell.includes('timefora')) {
                  timeCasaEnd = j - 1;
                  break;
                }
              }
            }
            if (timeCasaEnd < 0) {
              timeCasaEnd = rows.length - 1;
            }
          } else if (firstCell.includes('time fora') || firstCell.includes('timefora')) {
            timeForaStart = i;
            timeForaEnd = rows.length - 1;
          }
        }

        // Validar que encontrou ambas as seções
        if (timeCasaStart < 0) {
          reject(new Error('Seção "Time Casa" não encontrada no arquivo'));
          return;
        }

        if (timeForaStart < 0) {
          reject(new Error('Seção "Time Fora" não encontrada no arquivo'));
          return;
        }

        // Extrair estatísticas de cada seção
        const homeStats = extractTeamStats(rows, timeCasaStart, timeCasaEnd);
        const awayStats = extractTeamStats(rows, timeForaStart, timeForaEnd);

        if (!homeStats) {
          reject(new Error('Não foi possível extrair estatísticas do Time Casa. Verifique se o formato está correto.'));
          return;
        }

        if (!awayStats) {
          reject(new Error('Não foi possível extrair estatísticas do Time Fora. Verifique se o formato está correto.'));
          return;
        }

        // Criar objetos TeamStatistics completos
        const homeTeamStats: TeamStatistics = {
          ...createEmptyTeamStatistics(),
          gols: homeStats,
        };

        const awayTeamStats: TeamStatistics = {
          ...createEmptyTeamStatistics(),
          gols: awayStats,
        };

        resolve({
          homeTeamStats,
          awayTeamStats,
        });
      } catch (error) {
        reject(
          new Error(
            `Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
          )
        );
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };

    // Ler arquivo: como texto para CSV, como ArrayBuffer para Excel
    if (isCsv) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

/**
 * Valida se um arquivo é um Excel ou CSV válido para Estatísticas Globais
 */
export function isGlobalStatsFile(file: File): boolean {
  const validExtensions = ['.xlsx', '.xls', '.xlsm', '.csv'];
  const fileName = file.name.toLowerCase();
  return validExtensions.some((ext) => fileName.endsWith(ext));
}

