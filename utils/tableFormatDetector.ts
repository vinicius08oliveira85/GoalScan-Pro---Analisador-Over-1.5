import { TableRowGeral, TableFormat } from '../types';

/**
 * Detecta automaticamente o formato da planilha (completa ou basica)
 * baseado na presença de colunas xG nos dados
 * 
 * @param data Array de linhas da planilha
 * @returns 'completa' se encontrar colunas xG, 'basica' caso contrário
 */
export function detectTableFormatFromData(data: TableRowGeral[]): TableFormat {
  if (!Array.isArray(data) || data.length === 0) {
    // Se não houver dados, assumir formato básico por padrão
    return 'basica';
  }

  // Verificar se existem colunas xG na primeira linha (ou em qualquer linha)
  const firstRow = data[0] as Record<string, unknown>;
  
  // Campos xG que indicam formato completo
  const xgFields = [
    'Home xG',
    'Home xGA',
    'Home xGD',
    'Home xGD/90',
    'Away xG',
    'Away xGA',
    'Away xGD',
    'Away xGD/90',
  ];

  // Verificar se pelo menos um campo xG existe e tem valor não vazio
  for (const field of xgFields) {
    const value = firstRow[field];
    if (value !== undefined && value !== null && value !== '' && String(value).trim() !== '') {
      // Verificar se o valor não é zero (pode ser string "0" ou número 0)
      const numValue = parseFloat(String(value));
      if (!isNaN(numValue) && numValue !== 0) {
        return 'completa';
      }
    }
  }

  // Se não encontrou campos xG com valores, verificar em todas as linhas
  // (pode ser que a primeira linha tenha valores vazios mas outras tenham)
  for (const row of data) {
    const rowData = row as Record<string, unknown>;
    for (const field of xgFields) {
      const value = rowData[field];
      if (value !== undefined && value !== null && value !== '' && String(value).trim() !== '') {
        const numValue = parseFloat(String(value));
        if (!isNaN(numValue) && numValue !== 0) {
          return 'completa';
        }
      }
    }
  }

  // Se não encontrou nenhum campo xG com valor, é formato básico
  return 'basica';
}

/**
 * Valida se os campos esperados estão presentes baseado no formato
 * 
 * @param data Array de linhas da planilha
 * @param expectedFormat Formato esperado ('completa' ou 'basica')
 * @returns Array de avisos sobre campos faltantes (vazio se tudo estiver OK)
 */
export function validateTableFormat(
  data: TableRowGeral[],
  expectedFormat: TableFormat
): string[] {
  const warnings: string[] = [];

  if (!Array.isArray(data) || data.length === 0) {
    return warnings;
  }

  const firstRow = data[0] as Record<string, unknown>;

  // Campos obrigatórios para ambos os formatos
  const requiredFields = ['Rk', 'Squad'];
  for (const field of requiredFields) {
    if (!(field in firstRow)) {
      warnings.push(`Campo obrigatório "${field}" não encontrado`);
    }
  }

  // Campos esperados para formato completo
  if (expectedFormat === 'completa') {
    const expectedXgFields = [
      'Home xG',
      'Home xGA',
      'Away xG',
      'Away xGA',
    ];

    for (const field of expectedXgFields) {
      if (!(field in firstRow)) {
        warnings.push(`Campo esperado para formato completo "${field}" não encontrado`);
      }
    }
  }

  // Campos esperados para formato básico (Home/Away sem xG)
  const expectedBasicFields = [
    'Home MP',
    'Home W',
    'Home D',
    'Home L',
    'Home GF',
    'Home GA',
    'Home GD',
    'Home Pts',
    'Home Pts/MP',
    'Away MP',
    'Away W',
    'Away D',
    'Away L',
    'Away GF',
    'Away GA',
    'Away GD',
    'Away Pts',
    'Away Pts/MP',
  ];

  for (const field of expectedBasicFields) {
    if (!(field in firstRow)) {
      warnings.push(`Campo esperado "${field}" não encontrado`);
    }
  }

  return warnings;
}

