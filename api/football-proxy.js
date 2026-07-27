const https = require('https');

const API_FOOTBALL_BASE = 'v3.football.api-sports.io';
const API_KEY = process.env.VITE_API_FOOTBALL_KEY || '';
const PROTOCOL = 'https:';

if (!API_KEY) {
  console.error('[football-proxy] VITE_API_FOOTBALL_KEY nao configurada');
}

function httpsGet(pathname, searchParams) {
  return new Promise((resolve, reject) => {
    const path = searchParams ? `${pathname}?${searchParams}` : pathname;
    const req = https.request(
      {
        hostname: API_FOOTBALL_BASE,
        path,
        method: 'GET',
        headers: {
          'x-apisports-key': API_KEY,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(new Error('Timeout')); });
    req.end();
  });
}

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
    res.status(400).json({ error: 'Parametro endpoint obrigatorio' });
    return;
  }

  const searchParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') {
      searchParams.set(k, v);
    }
  }

  try {
    const result = await httpsGet(`/${endpoint}`, searchParams.toString());

    if (result.status !== 200) {
      const errMsg = result.body?.message || `API-Football ${result.status}`;
      console.error(`[football-proxy] Erro ${result.status} para ${endpoint}:`, JSON.stringify(result.body));
      res.status(result.status).json({ error: errMsg });
      return;
    }

    res.status(200).json(result.body);
  } catch (err) {
    console.error(`[football-proxy] Erro ao buscar ${endpoint}:`, err.message);
    res.status(500).json({ error: err.message || 'Erro interno no proxy' });
  }
};
