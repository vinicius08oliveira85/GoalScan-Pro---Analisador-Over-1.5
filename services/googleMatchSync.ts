/**
 * Serviço de sincronização de placar e tempo de jogos via Google Search
 */

export interface MatchScore {
  homeScore: number | null;
  awayScore: number | null;
  minute: number | null; // Minuto do jogo (0-90+)
  status: 'not_started' | 'live' | 'finished' | 'unknown';
  lastUpdated: number; // Timestamp
}

export interface GoogleMatchSyncResult {
  success: boolean;
  score?: MatchScore;
  error?: string;
}

/**
 * Cache local para evitar buscas excessivas
 */
const CACHE_KEY_PREFIX = 'goalscan_score_cache_';
const CACHE_TTL_LIVE = 2 * 60 * 1000; // 2 minutos para jogos ao vivo
const CACHE_TTL_FINISHED = 30 * 60 * 1000; // 30 minutos para jogos finalizados
const RATE_LIMIT_MS = 30 * 1000; // 30 segundos entre buscas do mesmo jogo

interface CacheEntry {
  score: MatchScore;
  timestamp: number;
}

/**
 * Gera chave de cache baseada nos times
 */
function getCacheKey(homeTeam: string, awayTeam: string): string {
  const normalized = `${homeTeam.toLowerCase()}_${awayTeam.toLowerCase()}`.replace(/[^a-z0-9_]/g, '_');
  return `${CACHE_KEY_PREFIX}${normalized}`;
}

/**
 * Verifica se há cache válido
 */
function getCachedScore(homeTeam: string, awayTeam: string): MatchScore | null {
  try {
    const cacheKey = getCacheKey(homeTeam, awayTeam);
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const entry: CacheEntry = JSON.parse(cached);
    const now = Date.now();
    const age = now - entry.timestamp;

    // Verificar TTL baseado no status
    const ttl = entry.score.status === 'live' ? CACHE_TTL_LIVE : CACHE_TTL_FINISHED;
    if (age > ttl) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    // Verificar rate limiting
    if (age < RATE_LIMIT_MS) {
      return entry.score;
    }

    return entry.score;
  } catch {
    return null;
  }
}

/**
 * Salva score no cache
 */
function setCachedScore(homeTeam: string, awayTeam: string, score: MatchScore): void {
  try {
    const cacheKey = getCacheKey(homeTeam, awayTeam);
    const entry: CacheEntry = {
      score,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    // Ignorar erros de localStorage
  }
}

/**
 * Busca página HTML do Google Search
 */
async function searchMatchOnGoogle(query: string): Promise<string> {
  // NOTA IMPORTANTE: Scraping direto do Google do browser é bloqueado por CORS
  // Esta função tentará buscar, mas provavelmente falhará em navegadores modernos
  // Soluções alternativas:
  // 1. Usar um backend proxy (recomendado)
  // 2. Usar Google Custom Search API
  // 3. Usar API de futebol alternativa (FotMob, ESPN, etc.)
  
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=pt-BR`;
  
  try {
    // Tentar buscar via fetch (provavelmente falhará por CORS)
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    // CORS é esperado - fornecer mensagem clara
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Detectar erro de CORS
    if (errorMessage.includes('CORS') || 
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Network request failed')) {
      throw new Error('CORS_BLOCKED: O navegador bloqueou o acesso ao Google por questões de segurança. Para usar esta funcionalidade, é necessário implementar um backend proxy ou usar uma API de futebol alternativa.');
    }
    
    throw new Error(`Erro ao buscar no Google: ${errorMessage}`);
  }
}

/**
 * Extrai placar de uma string
 */
function parseScoreString(scoreText: string): { home: number; away: number } | null {
  // Padrões: "2-1", "2 x 1", "2:1", "2 1"
  const patterns = [
    /(\d+)\s*[-x:]\s*(\d+)/i,
    /(\d+)\s+(\d+)/,
    /(\d+)\s*×\s*(\d+)/ // × (multiplicação unicode)
  ];

  for (const pattern of patterns) {
    const match = scoreText.match(pattern);
    if (match && match[1] && match[2]) {
      const home = parseInt(match[1], 10);
      const away = parseInt(match[2], 10);
      if (!isNaN(home) && !isNaN(away) && home >= 0 && away >= 0) {
        return { home, away };
      }
    }
  }

  return null;
}

/**
 * Extrai minuto de uma string
 */
function parseMinute(minuteText: string): number | null {
  // Padrões: "45'", "45 min", "45min", "HT" (intervalo), "FT" (finalizado)
  const patterns = [
    /(\d+)\s*[''min]/i, // 45', 45 min
    /(\d+)\s*min/i, // 45min
    /intervalo|half\s*time|ht/i, // Intervalo = 45
    /finalizado|finished|ft/i // Finalizado = 90
  ];

  for (const pattern of patterns) {
    const match = minuteText.match(pattern);
    if (match) {
      if (match[1]) {
        const minute = parseInt(match[1], 10);
        if (!isNaN(minute) && minute >= 0 && minute <= 120) {
          return minute;
        }
      } else if (/intervalo|half\s*time|ht/i.test(minuteText)) {
        return 45;
      } else if (/finalizado|finished|ft/i.test(minuteText)) {
        return 90;
      }
    }
  }

  return null;
}

/**
 * Identifica status do jogo baseado no texto
 */
function identifyStatus(text: string): 'not_started' | 'live' | 'finished' | 'unknown' {
  const lowerText = text.toLowerCase();
  
  if (/ao\s*vivo|live|em\s*andamento|jogando|playing/i.test(lowerText)) {
    return 'live';
  }
  
  if (/finalizado|finished|terminado|fim|ended/i.test(lowerText)) {
    return 'finished';
  }
  
  if (/não\s*iniciou|not\s*started|aguardando|waiting|próximo/i.test(lowerText)) {
    return 'not_started';
  }
  
  return 'unknown';
}

/**
 * Extrai dados de placar e tempo do HTML do Google
 */
function extractScoreFromGoogle(html: string, _homeTeam: string, _awayTeam: string): MatchScore | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Procurar por elementos que possam conter placar
    // Google geralmente mostra placar em elementos específicos
    const possibleScoreElements = [
      ...doc.querySelectorAll('[data-ved]'),
      ...doc.querySelectorAll('.BNeawe'),
      ...doc.querySelectorAll('.s3v9rd'),
      ...doc.querySelectorAll('.Z0LcW'),
      ...doc.querySelectorAll('span'),
      ...doc.querySelectorAll('div')
    ];

    let foundScore: { home: number; away: number } | null = null;
    let foundMinute: number | null = null;
    let foundStatus: 'not_started' | 'live' | 'finished' | 'unknown' = 'unknown';

    // Procurar por placar
    for (const element of possibleScoreElements) {
      const text = element.textContent || '';
      
      // Tentar extrair placar
      if (!foundScore) {
        const score = parseScoreString(text);
        if (score) {
          foundScore = score;
        }
      }

      // Tentar extrair minuto
      if (foundMinute === null) {
        const minute = parseMinute(text);
        if (minute !== null) {
          foundMinute = minute;
        }
      }

      // Identificar status
      if (foundStatus === 'unknown') {
        const status = identifyStatus(text);
        if (status !== 'unknown') {
          foundStatus = status;
        }
      }
    }

    // Se encontrou placar, retornar resultado
    if (foundScore) {
      return {
        homeScore: foundScore.home,
        awayScore: foundScore.away,
        minute: foundMinute,
        status: foundStatus === 'unknown' ? (foundMinute !== null ? 'live' : 'finished') : foundStatus,
        lastUpdated: Date.now()
      };
    }

    // Tentar buscar em JSON-LD (structured data)
    const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent || '{}');
        if (data.sportsEvent || data.SportsEvent) {
          const event = data.sportsEvent || data.SportsEvent;
          if (event.homeTeam && event.awayTeam) {
            const homeScore = event.homeScore || event.homeTeam?.score;
            const awayScore = event.awayScore || event.awayTeam?.score;
            
            if (typeof homeScore === 'number' && typeof awayScore === 'number') {
              return {
                homeScore,
                awayScore,
                minute: null,
                status: event.eventStatus === 'EventLive' ? 'live' : 
                       event.eventStatus === 'EventScheduled' ? 'not_started' : 'finished',
                lastUpdated: Date.now()
              };
            }
          }
        }
      } catch {
        // Continuar procurando
      }
    }

    return null;
  } catch (error) {
    console.error('Erro ao extrair placar do HTML:', error);
    return null;
  }
}

/**
 * Sincroniza placar e tempo de um jogo específico
 */
export async function syncMatchScore(
  homeTeam: string,
  awayTeam: string,
  matchDate?: string
): Promise<GoogleMatchSyncResult> {
  // Verificar cache primeiro
  const cached = getCachedScore(homeTeam, awayTeam);
  if (cached) {
    return {
      success: true,
      score: cached
    };
  }

  try {
    // Montar query de busca
    let query = `${homeTeam} vs ${awayTeam} placar`;
    if (matchDate) {
      // Adicionar data se disponível para resultados mais precisos
      const date = new Date(matchDate);
      const today = new Date();
      const isToday = date.toDateString() === today.toDateString();
      
      if (isToday) {
        query = `${homeTeam} vs ${awayTeam} placar hoje ao vivo`;
      } else {
        query = `${homeTeam} vs ${awayTeam} placar ${matchDate}`;
      }
    }

    // Buscar no Google
    const html = await searchMatchOnGoogle(query);

    // Extrair dados
    const score = extractScoreFromGoogle(html, homeTeam, awayTeam);

    if (score) {
      // Salvar no cache
      setCachedScore(homeTeam, awayTeam, score);
      
      return {
        success: true,
        score
      };
    }

    return {
      success: false,
      error: 'Placar não encontrado nos resultados da busca'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar placar';
    
    // Se for erro de CORS, fornecer mensagem mais detalhada
    if (errorMessage.includes('CORS_BLOCKED') || errorMessage.includes('CORS')) {
      return {
        success: false,
        error: 'O navegador bloqueou o acesso ao Google por questões de segurança (CORS). Para usar esta funcionalidade, é necessário implementar um backend proxy ou usar uma API de futebol alternativa (ex: FotMob, ESPN API).'
      };
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Limpa cache de placares
 */
export function clearScoreCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));
  } catch {
    // Ignorar erros
  }
}

