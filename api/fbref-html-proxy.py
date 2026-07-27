"""
Leve proxy que retorna o HTML bruto do FBref para parse client-side (DOMParser).
Usa headers anti-detecção idênticos ao fbref-extract.py para evitar 403.
Rodar como Vercel Serverless Function.
"""
import json
import random
import time
from typing import Dict, Optional

from starlette.requests import Request
from starlette.responses import Response

try:
    import requests
except ImportError:
    pass

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'DNT': '1',
    'Viewport-Width': '1920',
    'Width': '1920',
}


async def handler(request: Request):
    """Handler para Vercel Serverless Function"""

    if request.method == 'OPTIONS':
        return Response(
            content='',
            status_code=200,
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        )

    if request.method != 'POST':
        return _send_error(405, 'Método não permitido')

    try:
        body = await request.json()
        url = body.get('url', '')

        if not url or 'fbref.com' not in url:
            return _send_error(400, 'URL inválida. Apenas URLs do fbref.com são permitidas.')

        session = requests.Session()
        session.headers.update(HEADERS)
        last_error = None

        for attempt in range(3):
            try:
                if attempt > 0:
                    delay = (2 ** attempt) + random.uniform(0.5, 1.5)
                    time.sleep(delay)
                else:
                    time.sleep(random.uniform(1.0, 2.0))

                resp = session.get(url, timeout=45, allow_redirects=True)

                if resp.status_code == 403:
                    last_error = '403: Acesso negado pelo FBref'
                    session.headers['Referer'] = 'https://fbref.com/'
                    continue

                if resp.status_code >= 400:
                    last_error = f'HTTP {resp.status_code}: {resp.reason}'
                    continue

                if resp.encoding is None or resp.encoding == 'ISO-8859-1':
                    resp.encoding = 'utf-8'

                html = resp.text

                if len(html) < 10000:
                    last_error = f'Resposta curta ({len(html)} bytes)'
                    continue

                if 'stats_table' not in html and 'id="results' not in html:
                    last_error = 'HTML sem tabelas de estatísticas'
                    continue

                return _send_response({'html': html})

            except requests.exceptions.Timeout:
                last_error = 'Timeout (45s)'
            except requests.exceptions.ConnectionError:
                last_error = 'Erro de conexão'
            except requests.exceptions.RequestException as e:
                last_error = str(e)

        return _send_error(502, f'Falha ao acessar FBref após 3 tentativas: {last_error}')

    except json.JSONDecodeError:
        return _send_error(400, 'JSON inválido')
    except Exception as e:
        return _send_error(500, f'Erro interno: {str(e)}')


def _send_response(data: Dict, status_code: int = 200) -> Response:
    return Response(
        content=json.dumps(data, ensure_ascii=False),
        status_code=status_code,
        headers={
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
        },
    )


def _send_error(status_code: int, message: str) -> Response:
    return _send_response({'error': message}, status_code)