import * as XLSX from 'xlsx';
import { TableRowGeral } from '../types';

/**
 * Converte um arquivo Excel ou CSV para array de objetos JSON
 * @param file Arquivo Excel (.xlsx, .xls) ou CSV (.csv)
 * @returns Promise com array de objetos no formato TableRowGeral[]
 */
export async function parseExcelToJson(file: File): Promise<TableRowGeral[]> {
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
        // Manter nomes das colunas exatamente como estão (importante para Home/Away)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false, // Converter valores para string (mantém formato original)
          defval: '', // Valor padrão para células vazias
        });

        if (!Array.isArray(jsonData) || jsonData.length === 0) {
          reject(new Error('Planilha está vazia ou não contém dados'));
          return;
        }

        // Normalizar nomes das colunas (manter case original, importante para Home/Away)
        const normalizedData = jsonData.map((row: Record<string, unknown>) => {
          const normalized: Record<string, string> = {};

          // Mapear todas as propriedades do objeto
          for (const [key, value] of Object.entries(row)) {
            // Manter chave original exatamente como está (ex: "Home MP", "Away MP")
            // Isso é importante para preservar os nomes das colunas Home e Away
            normalized[key] = value != null ? String(value) : '';
          }

          return normalized as unknown as TableRowGeral;
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
 * Valida se um arquivo é um Excel ou CSV válido
 */
export function isExcelFile(file: File): boolean {
  const validExtensions = ['.xlsx', '.xls', '.xlsm', '.csv'];
  const fileName = file.name.toLowerCase();
  return validExtensions.some((ext) => fileName.endsWith(ext));
}

