"""
API route Python para extrair dados do footystats.org
Suporta 3 páginas: classificação, jogos, forma
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
            'Referer': 'https://footystats.org/',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
        })

    COLUMN_MAP = {
        'team': 'Squad', 'mp': 'MP', 'w': 'W', 'd': 'D', 'l': 'L',
        'gf': 'GF', 'ga': 'GA', 'gd': 'GD', 'pts': 'Pts',
        'ppg': 'Pts/MP', 'pointspergame': 'Pts/MP',
        'cs': 'CS', 'cleansheets': 'CS',
        'btts': 'BTTS', 'bothscore': 'BTTS',
        'xgf': 'xG', 'xgexpectedgoals': 'xG',
        'avg': 'AVG', 'avggoals': 'AVG',
        'win': 'Win%', 'winpercentage': 'Win%',
        'scored': 'Scored', 'conceded': 'Conceded',
        'over15': 'Over1.5', 'over25': 'Over2.5',
    }

    def _normalize_key(self, raw: str) -> str:
        key = re.sub(r'[^a-zA-Z0-9]', '', raw).strip().lower()
        return self.COLUMN_MAP.get(key, raw)

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

    def _parse_rows_from_table(self, soup: BeautifulSoup) -> List[Dict[str, str]]:
        table = soup.select_one('table.league-table') or soup.select_one('table')
        if not table:
            return []

        rows = table.select('tbody tr') or table.select('tr')[1:]

        headers = []
        thead = table.select_one('thead')
        if thead:
            for cell in thead.select('th'):
                text = cell.get_text(strip=True)
                if text:
                    headers.append(self._normalize_key(text))

        if not headers and rows:
            cells = rows[0].select('td, th')
            for i in range(len(cells)):
                headers.append(f'col_{i}')

        results = []
        for row in rows:
            cells = row.select('td')
            if len(cells) < 3:
                continue
            row_data = {}
            team_el = row.select_one('td.team-name a, td.team-name span, td a')
            if team_el:
                name = re.sub(r'\s+', ' ', team_el.get_text(strip=True))
                row_data['Squad'] = name
            for i, cell in enumerate(cells):
                text = cell.get_text(strip=True)
                if not text:
                    continue
                key = headers[i] if i < len(headers) else f'col_{i}'
                if key not in row_data or not row_data[key]:
                    row_data[key] = text
            if 'Rk' not in row_data and cells:
                row_data['Rk'] = cells[0].get_text(strip=True)
            if row_data.get('Squad'):
                results.append(row_data)
        return results

    def _detect_page_type(self, url: str) -> str:
        if '/form-table' in url:
            return 'form_table'
        if '/fixtures' in url:
            return 'fixtures'
        return 'standings'

    def _parse_standings(self, html: str) -> List[Dict[str, str]]:
        soup = BeautifulSoup(html, 'html.parser')
        results = self._parse_rows_from_table(soup)
        if results:
            return results
        tab_lines = []
        for line in html.split('\n'):
            stripped = line.strip()
            if not stripped:
                continue
            parts = stripped.split('\t')
            if len(parts) >= 10 and any(c.isdigit() for c in parts[0]):
                tab_lines.append(parts)
        if tab_lines:
            results = []
            for parts in tab_lines:
                row = {'Rk': parts[0].strip()}
                squad_idx = 1 if len(parts[0]) <= 3 else 0
                if squad_idx < len(parts):
                    row['Squad'] = parts[squad_idx].strip()
                col_names = ['MP', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts']
                for i, name in enumerate(col_names):
                    idx = squad_idx + 1 + i
                    if idx < len(parts):
                        row[name] = parts[idx].strip()
                if row.get('Squad'):
                    results.append(row)
            return results
        return self._fallback_json(html)

    def _parse_fixtures(self, html: str) -> Dict:
        soup = BeautifulSoup(html, 'html.parser')
        matches = []

        match_blocks = soup.select('[class*="match"], [class*="fixture"], tr, .card, [class*="row"]')
        seen = set()

        for block in soup.select('tr'):
            cells = block.select('td')
            if len(cells) < 3:
                continue
            text = block.get_text(' ', strip=True)
            if not text:
                continue
            match_data = self._extract_match_from_block(block)
            if match_data:
                key = f"{match_data.get('homeTeam', '')}_{match_data.get('awayTeam', '')}"
                if key not in seen and len(key) > 3:
                    seen.add(key)
                    matches.append(match_data)

        for block in soup.select('[class*="match"]:not(tr), [class*="fixture"]:not(tr)'):
            match_data = self._extract_match_from_block(block)
            if match_data:
                key = f"{match_data.get('homeTeam', '')}_{match_data.get('awayTeam', '')}"
                if key not in seen and len(key) > 3:
                    seen.add(key)
                    matches.append(match_data)

        if not matches:
            lines = html.split('\n')
            for i, line in enumerate(lines):
                stripped = line.strip()
                if not stripped:
                    continue
                parts = stripped.split('\t')
                if len(parts) >= 4:
                    has_score = False
                    for p in parts:
                        if re.match(r'^\d+-\d+$', p.strip()):
                            has_score = True
                            break
                    if has_score:
                        match_data = {'status': 'played'}
                        for p in parts:
                            p = p.strip()
                            if re.match(r'^\d+-\d+$', p):
                                match_data['score'] = p
                                ht = re.search(r'\(\s*(\d+-\d+)\s*\)', stripped)
                                if ht:
                                    match_data['htScore'] = ht.group(1)
                            elif re.match(r'^[A-Z]', p) and len(p) > 2:
                                if 'homeTeam' not in match_data:
                                    match_data['homeTeam'] = p
                                elif 'awayTeam' not in match_data:
                                    match_data['awayTeam'] = p
                        if 'homeTeam' in match_data and 'awayTeam' in match_data:
                            matches.append(match_data)

        for script in soup.select('script'):
            text = script.string or ''
            for m in re.finditer(r'"homeTeam"\s*:\s*"([^"]+)"', text):
                pass
            for m in re.finditer(r'"awayTeam"\s*:\s*"([^"]+)"', text):
                pass

        return {'matches': matches}

    def _extract_match_from_block(self, block) -> Optional[Dict]:
        text = block.get_text('|', strip=True)
        parts = [p.strip() for p in text.split('|') if p.strip()]
        if len(parts) < 3:
            return None

        match_data = {}
        for p in parts:
            if re.match(r'^\d+-\d+$', p):
                match_data['score'] = p
            elif re.match(r'^\d+:\d+$', p) or re.match(r'^\d+-\d+-\d+', p):
                match_data['date'] = p
            elif ':' in p and re.match(r'.*\d+:\d+', p):
                match_data['time'] = p

        teams = [p for p in parts if re.match(r'^[A-Z][a-z]', p) and not re.match(r'^\d', p) and len(p) > 2]
        if len(teams) >= 2:
            match_data['homeTeam'] = teams[0]
            match_data['awayTeam'] = teams[-1]

        ht = re.search(r'\(\s*(\d+-\d+)\s*\)', text)
        if ht:
            match_data['htScore'] = ht.group(1)

        if 'homeTeam' in match_data and 'awayTeam' in match_data:
            return match_data
        return None

    def _parse_form_table(self, html: str) -> Dict:
        soup = BeautifulSoup(html, 'html.parser')
        sections = html.split('<h')
        last5_rows = []
        last10_rows = []
        current_section = None

        for section in sections:
            lower = section.lower()
            if 'last 5' in lower or 'last5' in lower:
                current_section = 'last5'
            elif 'last 10' in lower or 'last10' in lower:
                current_section = 'last10'

            rows = self._parse_rows_from_table(BeautifulSoup(section, 'html.parser'))
            if rows:
                if current_section == 'last10':
                    last10_rows.extend(rows)
                else:
                    last5_rows.extend(rows)

        if not last5_rows and not last10_rows:
            all_rows = self._parse_rows_from_table(soup)
            if all_rows:
                mid = len(all_rows) // 2
                last5_rows = all_rows[:mid]
                last10_rows = all_rows[mid:]

        return {
            'last5': last5_rows,
            'last10': last10_rows,
        }

    def _parse_fixtures_from_json(self, html: str) -> Dict:
        soup = BeautifulSoup(html, 'html.parser')
        matches = []
        for script in soup.select('script'):
            text = script.string or ''
            patterns = [
                r'fixtures\s*=\s*(\[[\s\S]*?\])',
                r'matchData\s*=\s*(\[[\s\S]*?\])',
                r'upcomingMatches\s*=\s*(\[[\s\S]*?\])',
                r'results\s*=\s*(\[[\s\S]*?\])',
            ]
            for pat in patterns:
                m = re.search(pat, text)
                if m:
                    try:
                        data = json.loads(m.group(1))
                        if isinstance(data, list):
                            for item in data:
                                entry = {}
                                home = item.get('home', item.get('homeTeam', item.get('home_team', '')))
                                away = item.get('away', item.get('awayTeam', item.get('away_team', '')))
                                if isinstance(home, dict):
                                    home = home.get('name', '')
                                if isinstance(away, dict):
                                    away = away.get('name', '')
                                if home and away:
                                    entry['homeTeam'] = str(home)
                                    entry['awayTeam'] = str(away)
                                score = item.get('score', item.get('ftScore', ''))
                                if score:
                                    entry['score'] = str(score)
                                date = item.get('date', item.get('datetime', item.get('dateTime', '')))
                                if date:
                                    entry['date'] = str(date)
                                if entry.get('homeTeam') and entry.get('awayTeam'):
                                    matches.append(entry)
                        if matches:
                            return {'matches': matches}
                    except (json.JSONDecodeError, TypeError):
                        pass
        return {'matches': matches}

    def scrape(self, url: str) -> Dict:
        html = self.get_page(url)
        if not html:
            return {'error': 'Não foi possível acessar o footystats.org após várias tentativas'}

        page_type = self._detect_page_type(url)

        if page_type == 'fixtures':
            result = self._parse_fixtures(html)
            if not result.get('matches'):
                result = self._parse_fixtures_from_json(html)
            return {
                'type': 'fixtures',
                'data': result,
            }

        if page_type == 'form_table':
            result = self._parse_form_table(html)
            return {
                'type': 'form_table',
                'data': result,
            }

        result = self._parse_standings(html)
        return {
            'type': 'standings',
            'data': {'table': result},
        }

    def _fallback_json(self, html: str) -> List[Dict[str, str]]:
        soup = BeautifulSoup(html, 'html.parser')
        for script in soup.select('script'):
            text = script.string or ''
            for pat in [r'\[.*?\]', r'(\{[^{}]*"team"[^}]*\})']:
                for m in re.finditer(pat, text):
                    try:
                        data = json.loads(m.group())
                        entries = data if isinstance(data, list) else [data]
                        rows = []
                        for entry in entries:
                            name = entry.get('team') or entry.get('name') or ''
                            if isinstance(name, dict):
                                name = name.get('name', '')
                            if not name:
                                continue
                            row = {'Squad': str(name)}
                            fm = {
                                'matchesPlayed': 'MP', 'wins': 'W', 'draws': 'D', 'losses': 'L',
                                'goalsFor': 'GF', 'goalsAgainst': 'GA', 'goalDifference': 'GD',
                                'points': 'Pts', 'position': 'Rk',
                            }
                            for k, v in fm.items():
                                val = entry.get(k)
                                if val is not None:
                                    row[v] = str(val)
                            rows.append(row)
                        if rows:
                            return rows
                    except (json.JSONDecodeError, TypeError):
                        pass
        return []


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
                self._send_response({'success': False, 'error': result['error']})
                return
            self._send_response({'success': True, 'data': result.get('data', {}), 'type': result.get('type', 'standings')})
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
