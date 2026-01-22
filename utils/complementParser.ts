import * as XLSX from 'xlsx';
import { TableRowComplement } from '../types';

/**
 * Converte um arquivo Excel ou CSV de complemento para array de objetos JSON
 * @param file Arquivo Excel (.xlsx, .xls) ou CSV (.csv) com dados de complemento
 * @returns Promise com array de objetos no formato TableRowComplement[]
 */
export async function parseComplementToJson(file: File): Promise<TableRowComplement[]> {
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
            FS: separator, // Usar separador detectado
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

        // Converter para JSON (array de objetos)
        // Manter nomes das colunas exatamente como estão
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false, // Converter valores para string (mantém formato original)
          defval: '', // Valor padrão para células vazias
        });

        if (!Array.isArray(jsonData) || jsonData.length === 0) {
          reject(new Error('Planilha está vazia ou não contém dados'));
          return;
        }

        // Normalizar nomes das colunas e mapear para estrutura esperada
        const normalizedData = jsonData.map((row: Record<string, unknown>) => {
          const normalized: Record<string, string> = {};

          // Mapear todas as propriedades do objeto
          for (const [key, value] of Object.entries(row)) {
            // Normalizar nome da coluna (case-insensitive, suportar variações)
            const normalizedKey = normalizeColumnName(key);
            normalized[normalizedKey] = value != null ? String(value).trim() : '';
          }

          return normalized as unknown as TableRowComplement;
        });

        if (normalizedData.length === 0) {
          reject(new Error('Nenhum dado válido encontrado na planilha'));
          return;
        }

        // Validar estrutura básica (deve ter campo Squad)
        const firstRow = normalizedData[0];
        if (!firstRow || !firstRow.Squad) {
          // Tentar encontrar campo Squad com variações de nome
          const squadKey = Object.keys(firstRow).find(
            (key) =>
              key.toLowerCase() === 'squad' ||
              key.toLowerCase() === 'equipe' ||
              key.toLowerCase() === 'time' ||
              key.toLowerCase() === 'team'
          );

          if (!squadKey) {
            reject(
              new Error(
                'Planilha deve conter uma coluna "Squad" (ou "Equipe", "Time", "Team"). ' +
                'Colunas encontradas: ' +
                Object.keys(firstRow).join(', ')
              )
            );
            return;
          }

          // Normalizar nome da coluna para "Squad"
          normalizedData.forEach((row) => {
            if (squadKey !== 'Squad' && row[squadKey as keyof typeof row]) {
              row.Squad = String(row[squadKey as keyof typeof row]);
              delete row[squadKey as keyof typeof row];
            }
          });
        }

        // Validar que pelo menos alguns campos obrigatórios estão presentes
        const hasRequiredFields = normalizedData.some((row) => {
          return row.Squad && (
            row.Pl || 
            row.Age || 
            row.Poss || 
            row['Playing Time MP'] ||
            row['Performance Gls'] ||
            row['Per 90 Minutes Gls']
          );
        });

        if (!hasRequiredFields) {
          reject(new Error('Planilha não contém campos válidos de complemento'));
          return;
        }

        resolve(normalizedData);
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
 * Normaliza nome de coluna para formato esperado (case-insensitive, suportar variações)
 */
function normalizeColumnName(key: string): string {
  const normalized = key.trim();
  const lower = normalized.toLowerCase();

  // Mapeamento de variações para nomes padrão
  const columnMap: Record<string, string> = {
    // Squad
    'equipe': 'Squad',
    'time': 'Squad',
    'team': 'Squad',
    
    // Playing Time
    'playing time mp': 'Playing Time MP',
    'mp': 'Playing Time MP',
    'matches played': 'Playing Time MP',
    'playing time starts': 'Playing Time Starts',
    'starts': 'Playing Time Starts',
    'playing time min': 'Playing Time Min',
    'min': 'Playing Time Min',
    'minutes': 'Playing Time Min',
    'playing time 90s': 'Playing Time 90s',
    '90s': 'Playing Time 90s',
    '90s played': 'Playing Time 90s',
    
    // Performance
    'performance gls': 'Performance Gls',
    'gls': 'Performance Gls',
    'goals': 'Performance Gls',
    'performance ast': 'Performance Ast',
    'ast': 'Performance Ast',
    'assists': 'Performance Ast',
    'performance g+a': 'Performance G+A',
    'g+a': 'Performance G+A',
    'goals + assists': 'Performance G+A',
    'performance g-pk': 'Performance G-PK',
    'g-pk': 'Performance G-PK',
    'non-penalty goals': 'Performance G-PK',
    'performance pk': 'Performance PK',
    'pk': 'Performance PK',
    'penalty kicks made': 'Performance PK',
    'performance pkatt': 'Performance PKatt',
    'pkatt': 'Performance PKatt',
    'penalty kicks attempted': 'Performance PKatt',
    'performance crdy': 'Performance CrdY',
    'crdy': 'Performance CrdY',
    'yellow cards': 'Performance CrdY',
    'performance crdr': 'Performance CrdR',
    'crdr': 'Performance CrdR',
    'red cards': 'Performance CrdR',
    
    // Per 90 Minutes
    'per 90 minutes gls': 'Per 90 Minutes Gls',
    'gls/90': 'Per 90 Minutes Gls',
    'goals/90': 'Per 90 Minutes Gls',
    'per 90 minutes ast': 'Per 90 Minutes Ast',
    'ast/90': 'Per 90 Minutes Ast',
    'assists/90': 'Per 90 Minutes Ast',
    'per 90 minutes g+a': 'Per 90 Minutes G+A',
    'g+a/90': 'Per 90 Minutes G+A',
    'per 90 minutes g-pk': 'Per 90 Minutes G-PK',
    'g-pk/90': 'Per 90 Minutes G-PK',
    'per 90 minutes g+a-pk': 'Per 90 Minutes G+A-PK',
    'g+a-pk/90': 'Per 90 Minutes G+A-PK',
  };

  // Verificar se há mapeamento direto
  if (columnMap[lower]) {
    return columnMap[lower];
  }

  // Se não houver mapeamento, manter nome original (pode ser variação válida)
  return normalized;
}

/**
 * Valida estrutura de dados de complemento
 * @param data Array de dados de complemento
 * @returns true se válido, lança erro se inválido
 */
export function validateComplementData(data: TableRowComplement[]): void {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Dados de complemento devem ser um array não vazio');
  }

  // Verificar que todos os registros têm Squad
  const missingSquad = data.some((row) => !row.Squad || row.Squad.trim() === '');
  if (missingSquad) {
    throw new Error('Todos os registros devem ter um campo "Squad" válido');
  }

  // Verificar que há pelo menos alguns dados válidos
  const hasData = data.some((row) => {
    return row.Pl || 
           row.Age || 
           row.Poss || 
           row['Playing Time MP'] ||
           row['Performance Gls'] ||
           row['Per 90 Minutes Gls'];
  });

  if (!hasData) {
    throw new Error('Dados de complemento não contêm informações válidas');
  }
}

/**
 * Valida se um arquivo é um Excel ou CSV válido para complemento
 */
export function isComplementFile(file: File): boolean {
  const validExtensions = ['.xlsx', '.xls', '.xlsm', '.csv'];
  const fileName = file.name.toLowerCase();
  return validExtensions.some((ext) => fileName.endsWith(ext));
}

