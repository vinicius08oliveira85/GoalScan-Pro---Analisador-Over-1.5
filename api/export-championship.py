"""
API route para exportar dados de campeonato via API-Football.
Endpoint publico GET que retorna JSON estruturado com classificacao + jogos.
Consumivel por apps externos (CORS habilitado).

Uso: GET /api/export-championship?league_id=39&season=2026
"""
import json
import logging
import os
import sys
from typing import Dict, List, Optional
from starlette.requests import Request
from starlette.responses import Response

logging.basicConfig(level=logging.INFO, stream=sys.stderr)
logger = logging.getLogger('export-championship')

try:
    import requests
except ImportError:
    pass

API_BASE = 'https://v3.football.api-sports.io'
LEAGUE_NAMES: Dict[int, str] = {
    39: 'Premier League', 140: 'La Liga', 78: 'Bundesliga',
    135: 'Serie A', 61: 'Ligue 1', 71: 'Serie A (Brazil)',
}


async def handler(request: Request):
    if request.method == 'OPTIONS':
        return _cors(Response(content='', status_code=200))
    if request.method == 'POST':
        body = await request.json()
        league_id = body.get('league_id')
        season = body.get('season')
    elif request.method == 'GET':
        league_id = request.query_params.get('league_id')
        season = request.query_params.get('season')
    else:
        return _error(405, 'Use GET ou POST')
    if not league_id or not season:
        return _error(400, 'Parametros obrigatorios: league_id, season')
    try:
        league_id = int(league_id)
        season = int(season)
    except (ValueError, TypeError):
        return _error(400, 'league_id e season devem ser numeros')

    api_key = os.environ.get('VITE_API_FOOTBALL_KEY', '')
    if not api_key:
        return _error(500, 'VITE_API_FOOTBALL_KEY nao configurada')

    standings = _fetch_standings(api_key, league_id, season)
    fixtures = _fetch_fixtures(api_key, league_id, season)

    result = {
        'version': '1.0',
        'exported_at': __import__('datetime').datetime.utcnow().isoformat() + 'Z',
        'league': {
            'id': league_id,
            'name': LEAGUE_NAMES.get(league_id, f'League {league_id}'),
            'season': season,
        },
        'standings': standings,
        'fixtures': fixtures,
        'stats': {
            'total_teams': len(standings),
            'total_matches': len(fixtures),
        },
    }
    return _json(result)


def _api_get(api_key: str, endpoint: str, params: Dict) -> Optional[Dict]:
    url = f'{API_BASE}/{endpoint}?' + '&'.join(f'{k}={v}' for k, v in params.items())
    resp = requests.get(url, headers={'x-apisports-key': api_key}, timeout=25)
    if resp.status_code != 200:
        logger.error(f'[Export] Erro {resp.status_code} em {endpoint}')
        return None
    return resp.json()


def _fetch_standings(api_key: str, league_id: int, season: int) -> List[Dict]:
    data = _api_get(api_key, 'standings', {'league': league_id, 'season': season})
    if not data:
        return []
    try:
        teams = data['response'][0]['league']['standings'][0]
    except (KeyError, IndexError):
        return []
    rows = []
    for t in teams:
        rows.append({
            'rank': t.get('rank'),
            'team': t.get('team', {}).get('name', ''),
            'team_id': t.get('team', {}).get('id'),
            'played': t.get('all', {}).get('played', 0),
            'wins': t.get('all', {}).get('win', 0),
            'draws': t.get('all', {}).get('draw', 0),
            'losses': t.get('all', {}).get('lose', 0),
            'goals_for': t.get('all', {}).get('goals', {}).get('for', 0),
            'goals_against': t.get('all', {}).get('goals', {}).get('against', 0),
            'goal_diff': t.get('goalsDiff', 0),
            'points': t.get('points', 0),
            'form': t.get('form', ''),
            'home': {
                'played': t.get('home', {}).get('played', 0),
                'wins': t.get('home', {}).get('win', 0),
                'draws': t.get('home', {}).get('draw', 0),
                'losses': t.get('home', {}).get('lose', 0),
                'goals_for': t.get('home', {}).get('goals', {}).get('for', 0),
                'goals_against': t.get('home', {}).get('goals', {}).get('against', 0),
            },
            'away': {
                'played': t.get('away', {}).get('played', 0),
                'wins': t.get('away', {}).get('win', 0),
                'draws': t.get('away', {}).get('draw', 0),
                'losses': t.get('away', {}).get('lose', 0),
                'goals_for': t.get('away', {}).get('goals', {}).get('for', 0),
                'goals_against': t.get('away', {}).get('goals', {}).get('against', 0),
            },
        })
    return rows


def _fetch_fixtures(api_key: str, league_id: int, season: int) -> List[Dict]:
    data = _api_get(api_key, 'fixtures', {'league': league_id, 'season': season})
    if not data:
        return []
    matches = []
    for f in data.get('response', []):
        matches.append({
            'fixture_id': f.get('fixture', {}).get('id'),
            'date': f.get('fixture', {}).get('date'),
            'status': f.get('fixture', {}).get('status', {}).get('short', ''),
            'round': f.get('league', {}).get('round', ''),
            'home_team': f.get('teams', {}).get('home', {}).get('name', ''),
            'home_team_id': f.get('teams', {}).get('home', {}).get('id'),
            'away_team': f.get('teams', {}).get('away', {}).get('name', ''),
            'away_team_id': f.get('teams', {}).get('away', {}).get('id'),
            'goals_home': f.get('goals', {}).get('home'),
            'goals_away': f.get('goals', {}).get('away'),
        })
    return matches


def _json(data: Dict, status: int = 200) -> Response:
    return Response(
        content=json.dumps(data, ensure_ascii=False),
        status_code=status,
        headers={
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    )


def _error(status: int, msg: str) -> Response:
    return _json({'success': False, 'error': msg}, status)


def _cors(resp: Response) -> Response:
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return resp
