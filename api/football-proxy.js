const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
const API_KEY = process.env.VITE_API_FOOTBALL_KEY || '';

if (!API_KEY) {
  console.error('[football-proxy] VITE_API_FOOTBALL_KEY nao configurada');
}

/**
 * Vercel serverless function: proxy para API-Football
 * Frontend chama /api/football-proxy?endpoint=standings&league=39&season=2025
 */
module.exports = async (req, res) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { endpoint, ...params } = req.query;
  if (!endpoint) {
    res.status(400).json({ error: 'Parametro endpoint obrigatorio (ex: standings, fixtures, headtohead)' });
    return;
  }

  const url = new URL(`${API_FOOTBALL_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') {
      url.searchParams.set(k, v);
    }
  }

  try {
    const resp = await fetch(url.toString(), {
      headers: {
        'x-apisports-key': API_KEY,
        'Content-Type': 'application/json',
      },
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error(`[football-proxy] Erro ${resp.status} para ${endpoint}:`, data);
      res.status(resp.status).json({ error: data.message || `API-Football ${resp.status}`, details: data });
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    console.error(`[football-proxy] Erro ao buscar ${endpoint}:`, err);
    res.status(500).json({ error: err.message || 'Erro interno no proxy' });
  }
};
