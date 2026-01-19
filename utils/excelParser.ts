import * as XLSX from 'xlsx';
import { TableRowGeral } from '../types';

/**
 * Converte um arquivo Excel para array de objetos JSON
 * @param file Arquivo Excel (.xlsx, .xls)
 * @returns Promise com array de objetos no formato TableRowGeral[]
 */
export async function parseExcelToJson(file: File): Promise<TableRowGeral[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Erro ao ler arquivo Excel'));
          return;
        }

        // Ler workbook do Excel
        const workbook = XLSX.read(data, { type: 'array' });

        // Pegar primeira planilha
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error('Arquivo Excel não contém planilhas'));
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];

        // Converter para JSON (array de objetos)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false, // Converter valores para string (mantém formato original)
          defval: '', // Valor padrão para células vazias
        });

        if (!Array.isArray(jsonData) || jsonData.length === 0) {
          reject(new Error('Planilha Excel está vazia ou não contém dados'));
          return;
        }

        // Normalizar nomes das colunas (remover espaços extras, manter case original)
        const normalizedData = jsonData.map((row: Record<string, unknown>) => {
          const normalized: Record<string, string> = {};

          // Mapear todas as propriedades do objeto
          for (const [key, value] of Object.entries(row)) {
            // Manter chave original (pode ser "Rk", "Squad", etc.)
            normalized[key] = String(value || '');
          }

          return normalized as unknown as TableRowGeral;
        });

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
                'Planilha Excel deve conter uma coluna "Squad" (ou "Equipe", "Time", "Team"). ' +
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

        resolve(normalizedData);
      } catch (error) {
        reject(
          new Error(
            `Erro ao processar arquivo Excel: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
          )
        );
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo Excel'));
    };

    // Ler arquivo como ArrayBuffer
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Valida se um arquivo é um Excel válido
 */
export function isExcelFile(file: File): boolean {
  const validExtensions = ['.xlsx', '.xls', '.xlsm'];
  const fileName = file.name.toLowerCase();
  return validExtensions.some((ext) => fileName.endsWith(ext));
}

