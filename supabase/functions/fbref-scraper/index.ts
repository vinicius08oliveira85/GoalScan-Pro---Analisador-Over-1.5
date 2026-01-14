import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Tipos
interface ExtractRequest {
  championshipUrl: string;
  championshipId: string;
  extractTypes: ('table' | 'matches' | 'team-stats' | 'all')[];
  tableType?: 'geral' | 'standard_for';
}

interface ExtractionResult {
  success: boolean;
  data?: {
    table?: unknown[];
    matches?: unknown[];
    teamStats?: unknown[];
  };
  error?: string;
}

// Headers para evitar bloqueio
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Referer': 'https://www.google.com/',
};

// Delay entre requisições (respeitar rate limit)
const DELAY_MS = 3000; // 3 segundos

// Validar URL do fbref.com
function isValidFbrefUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === 'fbref.com' || urlObj.hostname.endsWith('.fbref.com');
  } catch {
    return false;
  }
}

// Delay helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extrair tabela HTML e converter para JSON
async function extractTableFromUrl(url: string, tableType: 'geral' | 'standard_for' = 'geral'): Promise<unknown[]> {
  // Validar URL
  if (!isValidFbrefUrl(url)) {
    throw new Error('URL inválida. Apenas URLs do fbref.com são permitidas.');
  }

  // Fazer requisição com delay
  await delay(DELAY_MS);

  const response = await fetch(url, {
    headers: DEFAULT_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();

  // Parse HTML usando regex (melhorado para lidar com tabelas complexas)
  // Buscar por tabelas com classe stats_table
  const tableRegex = /<table[^>]*class="[^"]*stats_table[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;
  const tableMatches = Array.from(html.matchAll(tableRegex));

  if (!tableMatches || tableMatches.length === 0) {
    throw new Error('Tabela não encontrada na página. Certifique-se de que a URL aponta para uma página com tabela de classificação.');
  }

  // Usar a primeira tabela encontrada (geralmente é a tabela principal)
  const tableHtml = tableMatches[0][0];
  
  // Extrair cabeçalhos do thead
  const headerRegex = /<thead[^>]*>([\s\S]*?)<\/thead>/gi;
  const headerMatch = tableHtml.match(headerRegex);
  const headers: string[] = [];

  if (headerMatch) {
    const theadContent = headerMatch[0];
    // Buscar todas as linhas de cabeçalho
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const trMatches = Array.from(theadContent.matchAll(trRegex));
    
    // Pegar a última linha de cabeçalho (geralmente a mais completa)
    if (trMatches.length > 0) {
      const lastHeaderRow = trMatches[trMatches.length - 1][1];
      const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
      const thMatches = Array.from(lastHeaderRow.matchAll(thRegex));
      
      thMatches.forEach((match) => {
        let text = match[1];
        // Remover tags HTML aninhadas
        text = text.replace(/<[^>]*>/g, '');
        // Remover espaços extras
        text = text.trim();
        // Remover quebras de linha
        text = text.replace(/\s+/g, ' ');
        if (text) {
          headers.push(text);
        }
      });
    }
  }

  // Se não encontrou cabeçalhos no thead, tentar na primeira linha do tbody
  if (headers.length === 0) {
    const tbodyRegex = /<tbody[^>]*>([\s\S]*?)<\/tbody>/gi;
    const tbodyMatch = tableHtml.match(tbodyRegex);
    if (tbodyMatch) {
      const firstTrRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/i;
      const firstTrMatch = tbodyMatch[0].match(firstTrRegex);
      if (firstTrMatch) {
        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const tdMatches = Array.from(firstTrMatch[1].matchAll(tdRegex));
        tdMatches.forEach((match) => {
          let text = match[1].replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
          if (text) {
            headers.push(text || `col_${headers.length}`);
          }
        });
      }
    }
  }

  // Extrair linhas de dados do tbody
  const tbodyRegex = /<tbody[^>]*>([\s\S]*?)<\/tbody>/gi;
  const tbodyMatch = tableHtml.match(tbodyRegex);
  const rows: unknown[] = [];

  if (tbodyMatch) {
    const tbodyContent = tbodyMatch[0];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const trMatches = Array.from(tbodyContent.matchAll(trRegex));

    trMatches.forEach((trMatch) => {
      const rowHtml = trMatch[1];
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const tdMatches = Array.from(rowHtml.matchAll(tdRegex));
      const cells: string[] = [];

      tdMatches.forEach((tdMatch) => {
        let text = tdMatch[1];
        // Remover tags HTML (incluindo links)
        text = text.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1');
        text = text.replace(/<[^>]*>/g, '');
        // Remover espaços extras e quebras de linha
        text = text.trim().replace(/\s+/g, ' ');
        cells.push(text);
      });

      if (cells.length > 0) {
        const row: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          if (cells[index] !== undefined) {
            const normalizedHeader = normalizeHeader(header);
            row[normalizedHeader] = cells[index];
          }
        });
        
        // Garantir que há campo Squad (obrigatório)
        // Tentar diferentes variações do nome
        const squadValue = row.Squad || row.squad || row.Team || row.team;
        if (squadValue) {
          row.Squad = String(squadValue);
          rows.push(row);
        }
      }
    });
  }

  if (rows.length === 0) {
    throw new Error('Nenhuma linha de dados encontrada na tabela. Verifique se a URL está correta.');
  }

  return rows;
}

// Normalizar nomes de cabeçalhos
function normalizeHeader(header: string): string {
  const headerLower = header.toLowerCase().trim();
  
  const mapping: Record<string, string> = {
    'rk': 'Rk',
    'rank': 'Rk',
    'squad': 'Squad',
    'team': 'Squad',
    'mp': 'MP',
    'matches played': 'MP',
    'w': 'W',
    'wins': 'W',
    'd': 'D',
    'draws': 'D',
    'l': 'L',
    'losses': 'L',
    'gf': 'GF',
    'goals for': 'GF',
    'ga': 'GA',
    'goals against': 'GA',
    'gd': 'GD',
    'goal difference': 'GD',
    'pts': 'Pts',
    'points': 'Pts',
    'pts/mp': 'Pts/MP',
    'pts / mp': 'Pts/MP',
    'xg': 'xG',
    'expected goals': 'xG',
    'xga': 'xGA',
    'expected goals against': 'xGA',
  };

  if (mapping[headerLower]) {
    return mapping[headerLower];
  }

  // Capitalizar primeira letra de cada palavra
  return header.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: ExtractRequest = await req.json();

    // Validar request
    if (!body.championshipUrl || !body.championshipId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'championshipUrl e championshipId são obrigatórios',
        } as ExtractionResult),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validar URL
    if (!isValidFbrefUrl(body.championshipUrl)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'URL inválida. Apenas URLs do fbref.com são permitidas.',
        } as ExtractionResult),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const result: ExtractionResult = {
      success: true,
      data: {},
    };

    // Extrair tabela se solicitado
    if (body.extractTypes.includes('table') || body.extractTypes.includes('all')) {
      try {
        const tableData = await extractTableFromUrl(
          body.championshipUrl,
          body.tableType || 'geral'
        );
        result.data!.table = tableData;
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Erro ao extrair tabela: ${error instanceof Error ? error.message : String(error)}`,
          } as ExtractionResult),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // TODO: Implementar extração de jogos e estatísticas de times nas próximas fases

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      } as ExtractionResult),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

