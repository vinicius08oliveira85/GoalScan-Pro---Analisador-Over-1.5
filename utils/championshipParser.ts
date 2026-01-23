import { TableRowGeral } from '../types';

export const parseChampionshipGeneralTable = (text: string): TableRowGeral[] => {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  // Detectar separador (Tabulação ou múltiplos espaços)
  const headerLine = lines[0];
  const isTabSeparated = headerLine.includes('\t');
  const separator = isTabSeparated ? '\t' : /\s{2,}/;

  // Processar cabeçalhos
  const headers = headerLine.trim().split(separator).map(h => h.trim());
  
  const data: TableRowGeral[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(separator).map(v => v.trim());

    if (values.length > 0) {
        const row: any = {};
        
        // Mapear valores para as chaves baseadas nos headers
        headers.forEach((header, index) => {
            if (index < values.length) {
                row[header] = values[index];
            }
        });

        // Validação básica
        if (row['Squad'] || row['Rk']) {
            // Lógica de Agregação: Se tiver dados de Casa/Fora mas não tiver Totais, calcula os Totais
            const parseNum = (val: any) => parseInt(val) || 0;
            
            // MP (Matches Played)
            if (!row['MP'] && row['Home MP'] && row['Away MP']) {
                row['MP'] = (parseNum(row['Home MP']) + parseNum(row['Away MP'])).toString();
            }
            
            // W (Wins)
            if (!row['W'] && row['Home W'] && row['Away W']) {
                row['W'] = (parseNum(row['Home W']) + parseNum(row['Away W'])).toString();
            }
            
            // D (Draws)
            if (!row['D'] && row['Home D'] && row['Away D']) {
                row['D'] = (parseNum(row['Home D']) + parseNum(row['Away D'])).toString();
            }
            
            // L (Losses)
            if (!row['L'] && row['Home L'] && row['Away L']) {
                row['L'] = (parseNum(row['Home L']) + parseNum(row['Away L'])).toString();
            }
            
            // GF (Goals For)
            if (!row['GF'] && row['Home GF'] && row['Away GF']) {
                row['GF'] = (parseNum(row['Home GF']) + parseNum(row['Away GF'])).toString();
            }
            
            // GA (Goals Against)
            if (!row['GA'] && row['Home GA'] && row['Away GA']) {
                row['GA'] = (parseNum(row['Home GA']) + parseNum(row['Away GA'])).toString();
            }
            
            // GD (Goal Difference)
            if (row['GF'] && row['GA']) {
                const gd = parseNum(row['GF']) - parseNum(row['GA']);
                row['GD'] = gd > 0 ? `+${gd}` : gd.toString();
            }

            // Pts (Points)
            if (!row['Pts'] && row['Home Pts'] && row['Away Pts']) {
                row['Pts'] = (parseNum(row['Home Pts']) + parseNum(row['Away Pts'])).toString();
            }

            // Pts/MP (Points per Match)
            if (!row['Pts/MP'] && row['Pts'] && row['MP']) {
                const mp = parseNum(row['MP']);
                if (mp > 0) {
                    row['Pts/MP'] = (parseNum(row['Pts']) / mp).toFixed(2);
                }
            }

            data.push(row as TableRowGeral);
        }
    }
  }

  return data;
};