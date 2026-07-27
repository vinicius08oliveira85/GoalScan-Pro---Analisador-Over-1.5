"""
API route Python para extrair dados de tabelas do footystats.org
"""
import json
import re
import time
from http.server import BaseHTTPRequestHandler
from typing import Dict, List, Optional

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    pass


class FootyStatsScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://footystats.org/',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
        })

    COLUMN_MAP = {
        'team': 'Squad',
        'mp': 'MP',
        'w': 'W',
        'd': 'D',
        'l': 'L',
        'gf': 'GF',
        'ga': 'GA',
        'gd': 'GD',
        'pts': 'Pts',
        'ppg': 'Pts/MP',
        'cs': 'CS',
        'btts': 'BTTS',
        'xgf': 'xG',
        'avg': 'AVG',
    }

    def _normalize_key(self, raw: str) -> str:
        key = re.sub(r'[^a-zA-Z0-9]', '', raw).strip().lower()
        return self.COLUMN_MAP.get(key, raw)

    def _parse_table_from_html(self, html: str) -> List[Dict[str, str]]:
        soup = BeautifulSoup(html, 'html.parser')
        table = soup.select_one('table.league-table')
        if not table:
            table = soup.select_one('table')
        if not table:
            return []

        rows = table.select('tbody tr')
        if not rows:
            rows = table.select('tr')[1:]

        headers = []
        thead = table.select_one('thead')
        if thead:
            header_cells = thead.select('th')
            for cell in header_cells:
                text = cell.get_text(strip=True)
                if text:
                    headers.append(self._normalize_key(text))

        if not headers:
            first_row = rows[0] if rows else None
            if first_row:
                cells = first_row.select('td, th')
                for i, cell in enumerate(cells):
                    headers.append(f'col_{i}')

        results = []
        for row in rows:
            cells = row.select('td')
            if len(cells) < 4:
                continue

            row_data = {}
            team_el = row.select_one('td.team-name a, td.team-name span, td a')
            if team_el:
                row_data['Squad'] = team_el.get_text(strip=True)

            for i, cell in enumerate(cells):
                text = cell.get_text(strip=True)
                if not text:
                    continue
                key = headers[i] if i < len(headers) else f'col_{i}'
                key = self._normalize_key(key)
                if key not in row_data or not row_data[key]:
                    row_data[key] = text

            if 'Rk' not in row_data and len(cells) > 0:
                row_data['Rk'] = cells[0].get_text(strip=True)

            if row_data.get('Squad'):
                results.append(row_data)

        return results

    def _parse_table_from_json_data(self, html: str) -> List[Dict[str, str]]:
        soup = BeautifulSoup(html, 'html.parser')
        scripts = soup.select('script')
        for script in scripts:
            text = script.string or ''
            if 'leagueTableData' in text or 'standingsData' in text or 'teams' in text:
                match = re.search(r'\[.*?\]', text, re.DOTALL)
                if match:
                    try:
                        data = json.loads(match.group())
                        if isinstance(data, list) and len(data) > 0:
                            return self._parse_json_entries(data)
                    except json.JSONDecodeError:
                        pass

            matches = list(re.finditer(r'(\{[^{}]*"team"[^}]*\})', text))
            if matches:
                try:
                    entries = [json.loads(m.group()) for m in matches]
                    if entries:
                        return self._parse_json_entries(entries)
                except json.JSONDecodeError:
                    pass

        return []

    def _parse_json_entries(self, entries: List[Dict]) -> List[Dict[str, str]]:
        results = []
        for entry in entries:
            row = {}
            name = entry.get('team') or entry.get('name') or entry.get('teamName') or ''
            if isinstance(name, dict):
                name = name.get('name', '')
            if not name:
                continue
            row['Squad'] = str(name)

            field_map = {
                'matchesPlayed': 'MP', 'mp': 'MP', 'played': 'MP',
                'wins': 'W', 'w': 'W', 'win': 'W',
                'draws': 'D', 'd': 'D', 'draw': 'D',
                'losses': 'L', 'l': 'L', 'loss': 'L',
                'goalsFor': 'GF', 'gf': 'GF', 'goalsScored': 'GF',
                'goalsAgainst': 'GA', 'ga': 'GA', 'goalsConceded': 'GA',
                'goalDifference': 'GD', 'gd': 'GD',
                'points': 'Pts', 'pts': 'Pts',
                'ppg': 'Pts/MP', 'pointsPerGame': 'Pts/MP',
                'position': 'Rk', 'pos': 'Rk', 'rank': 'Rk',
            }

            for json_key, target in field_map.items():
                val = entry.get(json_key)
                if val is not None:
                    row[target] = str(val)

            if 'Rk' not in row:
                row['Rk'] = str(entry.get('position', entry.get('pos', '')))

            if row.get('Squad'):
                results.append(row)

        return results

    def get_page(self, url: str, max_retries: int = 3) -> Optional[str]:
        for attempt in range(max_retries):
            try:
                resp = self.session.get(url, timeout=30, allow_redirects=True)
                if resp.status_code == 200:
                    return resp.text
                elif resp.status_code == 403:
                    time.sleep(2 * (attempt + 1))
                    self.session.headers['User-Agent'] = (
                        f'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                        f'AppleWebKit/537.36 (KHTML, like Gecko) '
                        f'Chrome/{131 + attempt}.0.0.0 Safari/537.36'
                    )
                    continue
                else:
                    time.sleep(1)
                    continue
            except requests.RequestException:
                time.sleep(2 * (attempt + 1))
                continue
        return None

    def scrape(self, url: str) -> Dict:
        html = self.get_page(url)
        if not html:
            return {'error': 'Não foi possível acessar o footystats.org após várias tentativas'}

        results = self._parse_table_from_html(html)
        if not results:
            results = self._parse_table_from_json_data(html)

        if not results:
            return {'error': 'Nenhuma tabela encontrada na página'}

        return {
            'tables': {
                'geral': results,
            },
            'missingTables': [],
        }


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            request_data = json.loads(body.decode('utf-8'))

            url = request_data.get('url', '')
            if not url or 'footystats.org' not in url:
                self._send_error(400, 'URL inválida. Apenas URLs do footystats.org são permitidas.')
                return

            scraper = FootyStatsScraper()
            result = scraper.scrape(url)

            if 'error' in result:
                self._send_response({
                    'success': False,
                    'error': result['error'],
                })
                return

            tables = result.get('tables', {})
            self._send_response({
                'success': True,
                'data': {
                    'tables': tables,
                    'missingTables': result.get('missingTables', []),
                },
            })

        except json.JSONDecodeError:
            self._send_error(400, 'JSON inválido no body da requisição')
        except Exception as e:
            self._send_error(500, f'Erro interno: {str(e)}')

    def _send_response(self, data: Dict, status_code: int = 200):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def _send_error(self, status_code: int, message: str):
        self._send_response({'success': False, 'error': message}, status_code)

    def log_message(self, format, *args):
        pass
