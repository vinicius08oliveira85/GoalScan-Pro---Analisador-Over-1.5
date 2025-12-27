/**
 * Vercel Serverless Function (Node 18+)
 *
 * POST /api/gemini
 * body: { prompt: string }
 *
 * Mantém a GEMINI_API_KEY somente no servidor (env).
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey || String(apiKey).trim().length === 0) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: 'GEMINI_API_KEY não configurada no servidor.'
      })
    );
    return;
  }

  let body = req.body;
  // Em alguns runtimes o body pode vir como string
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }

  const prompt = body?.prompt;
  if (typeof prompt !== 'string' || prompt.trim().length < 10) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Prompt inválido.' }));
    return;
  }

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          topP: 0.9,
          maxOutputTokens: 900
        }
      })
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      res.statusCode = upstream.status;
      res.end(JSON.stringify({ error: `Falha ao chamar Gemini (${upstream.status}).`, details: text }));
      return;
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: 'Resposta inválida do Gemini (JSON).' }));
      return;
    }

    const outText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof outText !== 'string' || outText.trim().length === 0) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: 'Resposta inválida do Gemini (sem texto).' }));
      return;
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ text: outText.trim() }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Erro interno ao chamar Gemini.' }));
  }
}

