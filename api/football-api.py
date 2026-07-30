"""
API route Python para proxy da API-Football (v3.football.api-sports.io)
Endpoint dedicado, separado do FootyStats.
Suporta: standings, fixtures, head-to-head.
"""
import json
import logging
import os
import sys
from typing import Dict
from starlette.requests import Request
from starlette.responses import Response

logging.basicConfig(level=logging.INFO, stream=sys.stderr)
logger = logging.getLogger('football-api')

try:
    import requests
except ImportError:
    pass

API_BASE = 'https://v3.football.api-sports.io'


async def handler(request: Request):
    if request.method == 'OPTIONS':
        return _cors(Response(content='', status_code=200))
    if request.method != 'POST':
        return _error(405, 'Metodo nao permitido')
    try:
        body = await request.json()
        endpoint = body.get('endpoint', '')
        params = body.get('params', {})
        if not endpoint:
            return _error(400, 'Parametro endpoint obrigatorio')
        api_key = os.environ.get('VITE_API_FOOTBALL_KEY', '')
        if not api_key:
            return _error(500, 'VITE_API_FOOTBALL_KEY nao configurada')
        api_url = f'{API_BASE}/{endpoint}'
        if params:
            api_url += '?' + '&'.join(f'{k}={v}' for k, v in params.items())
        resp = requests.get(api_url, headers={
            'x-apisports-key': api_key,
        }, timeout=25)
        if resp.status_code != 200:
            logger.error(f'[APIFootball] Erro {resp.status_code}: {resp.text[:200]}')
            return _error(resp.status_code, f'API-Football {resp.status_code}')
        return _json(resp.json())
    except json.JSONDecodeError:
        return _error(400, 'JSON invalido')
    except requests.exceptions.Timeout:
        return _error(504, 'API-Football timeout')
    except Exception as e:
        logger.exception('[APIFootball] Erro interno')
        return _error(500, f'Erro: {str(e)}')


def _json(data: Dict, status: int = 200) -> Response:
    return Response(
        content=json.dumps(data, ensure_ascii=False),
        status_code=status,
        headers={
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    )


def _error(status: int, msg: str) -> Response:
    return _json({'success': False, 'error': msg}, status)


def _cors(resp: Response) -> Response:
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return resp
