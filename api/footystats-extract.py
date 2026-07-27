"""
API route Python para extrair dados do footystats.org
Suporta 3 páginas: classificação, jogos, forma
Usa cloudscraper para bypass de Cloudflare/bot detection
"""
import json
import logging
import random
import re
import sys
import time
from http.server import BaseHTTPRequestHandler
from typing import Dict, List, Optional

logging.basicConfig(level=logging.INFO, stream=sys.stderr)
logger = logging.getLogger('footystats')

try:
    import cloudscraper
    HAS_CLOUDSCRAPER = True
    logger.info('cloudscraper disponivel')
except ImportError:
    HAS_CLOUDSCRAPER = False
    logger.warning('cloudscraper nao disponivel, usando requests')

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    pass

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
]


class FootyStatsScraper:
    def __init__(self):
        self.session = self._create_session()

    def _create_session(self):
        ua = random.choice(USER_AGENTS)
        if HAS_CLOUDSCRAPER:
            sess = cloudscraper.create_scraper(
                browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False},
                delay=5,
            )
            sess.headers.update({'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8'})
        else:
            sess = requests.Session()
            sess.headers.update({
                'User-Agent': ua,
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
        return sess

    def get_page(self, url: str, max_retries: int = 5) -> Optional[str]:
        for attempt in range(max_retries):
            try:
                ua = random.choice(USER_AGENTS)
                self.session.headers.update({'User-Agent': ua})
                if attempt > 0:
                    wait = 3 * (attempt + 1) + random.uniform(0, 2)
                    logger.info(f'Tentativa {attempt + 1}/{max_retries}, aguardando {wait:.1f}s...')
                    time.sleep(wait)
                    self.session = self._create_session()

                logger.info(f'GET {url} (attempt {attempt + 1})')
                resp = self.session.get(url, timeout=45, allow_redirects=True)
                logger.info(f'Status: {resp.status_code}, size: {len(resp.text)}')

                if resp.status_code == 200:
                    if len(resp.text) > 500:
                        return resp.text
                    logger.warning(f'Resposta muito curta ({len(resp.text)} chars), possivel bloqueio')

                elif resp.status_code == 403:
                    logger.warning(f'403 Forbidden (attempt {attempt + 1})')
                    continue

                elif resp.status_code == 429:
                    retry_after = resp.headers.get('Retry-After', '10')
                    logger.warning(f'429 Rate limited, retry-after: {retry_after}')
                    time.sleep(int(retry_after) + 2)
                    continue

                elif resp.status_code in (502, 503):
                    logger.warning(f'{resp.status_code} Server error')
                    time.sleep(5)
                    continue

                else:
                    logger.warning(f'Status inesperado: {resp.status_code}')
                    time.sleep(2)
                    continue

            except requests.exceptions.Timeout:
                logger.warning(f'Timeout (attempt {attempt + 1})')
                time.sleep(3)

            except requests.exceptions.ConnectionError as e:
                logger.warning(f'Erro de conexao: {e}')
                time.sleep(5)

            except Exception as e:
                logger.error(f'Erro inesperado: {e}')
                time.sleep(3)

        logger.error('Todas as tentativas falharam')
        return None

    def _detect_page_type(self, url: str) -> str:
        if '/form-table' in url:
            return 'form_table'
        if '/fixtures' in url:
            return 'fixtures'
        return 'standings'

    def _parse_table_from_html(self, soup: BeautifulSoup) -> List[Dict[str, str]]:
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
                    headers.append(text)

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
                row_data['Squad'] = re.sub(r'\s+', ' ', team_el.get_text(strip=True))
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

    def _parse_standings(self, html: str) -> List[Dict[str, str]]:
        soup = BeautifulSoup(html, 'html.parser')
        results = self._parse_table_from_html(soup)

        if not results:
            soup2 = BeautifulSoup(html, 'lxml')
            results = self._parse_table_from_html(soup2)

        if not results:
            for line in html.split('\n'):
                stripped = line.strip()
                if not stripped:
                    continue
                parts = [p for p in re.split(r'\t{2,}|\s{3,}', stripped) if p.strip()]
                if len(parts) >= 8 and any(c.isdigit() for c in parts[0]):
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

    def _parse_fixtures(self, html: str) -> Dict:
        soup = BeautifulSoup(html, 'html.parser')
        matches = []
        seen = set()

        for row in soup.select('tr'):
            cells = row.select('td')
            if len(cells) < 3:
                continue
            text = row.get_text(' ', strip=True)
            if not text:
                continue

            parts = [p.strip() for p in re.split(r'\s{3,}|\t+', text) if p.strip()]
            match_data = self._extract_teams_from_parts(parts)
            if match_data:
                key = f"{match_data.get('homeTeam', '')}_{match_data.get('awayTeam', '')}"
                if key not in seen and len(key) > 3:
                    seen.add(key)
                    score_match = re.search(r'(\d+)\s*[-–:]\s*(\d+)', text)
                    if score_match:
                        match_data['score'] = f"{score_match.group(1)}-{score_match.group(2)}"
                    ht_match = re.search(r'\((\d+)[-–:](\d+)\)', text)
                    if ht_match:
                        match_data['htScore'] = f"{ht_match.group(1)}-{ht_match.group(2)}"
                    date_match = re.search(r'(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2})', text)
                    if date_match:
                        match_data['date'] = date_match.group(1)
                    matches.append(match_data)

        if not matches:
            match_data = self._try_fixtures_from_json(html)
            if match_data.get('matches'):
                return match_data

        return {'matches': matches}

    def _extract_teams_from_parts(self, parts: List[str]) -> Optional[Dict]:
        teams = [p for p in parts if re.match(r'^[A-Z][a-zA-ZáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ\s]{2,}', p) and len(p) > 2]
        if len(teams) >= 2:
            return {'homeTeam': teams[0], 'awayTeam': teams[-1]}
        if len(parts) >= 2:
            p1, p2 = parts[0], parts[-1]
            if len(p1) > 2 and len(p2) > 2 and not re.match(r'^\d', p1) and not re.match(r'^\d', p2):
                return {'homeTeam': p1, 'awayTeam': p2}
        return None

    def _try_fixtures_from_json(self, html: str) -> Dict:
        soup = BeautifulSoup(html, 'html.parser')
        matches = []
        for script in soup.select('script'):
            text = script.string or ''
            if 'homeTeam' not in text and 'awayTeam' not in text:
                continue
            for m in re.finditer(r'"homeTeam"\s*:\s*"([^"]+)"', text):
                pass
            try:
                for item_match in re.finditer(r'\{[^{}]*(?:homeTeam|awayTeam)[^{}]*\}', text):
                    try:
                        item = json.loads(item_match.group())
                        home = item.get('home', item.get('homeTeam', item.get('home_team', '')))
                        away = item.get('away', item.get('awayTeam', item.get('away_team', '')))
                        if isinstance(home, dict): home = home.get('name', '')
                        if isinstance(away, dict): away = away.get('name', '')
                        if home and away:
                            matches.append({
                                'homeTeam': str(home),
                                'awayTeam': str(away),
                                'score': str(item.get('score', item.get('ftScore', ''))) or None,
                                'date': str(item.get('date', item.get('datetime', ''))) or None,
                            })
                    except (json.JSONDecodeError, TypeError):
                        pass
            except Exception:
                pass
        return {'matches': matches}

    def _parse_form_table(self, html: str) -> Dict:
        soup = BeautifulSoup(html, 'html.parser')
        tables = soup.select('table')
        form_tables = []

        for table in tables:
            rows = self._parse_table_from_html(table)
            if rows:
                form_tables.append(rows)

        if len(form_tables) >= 2:
            return {'last5': form_tables[0], 'last10': form_tables[1]}
        elif len(form_tables) == 1:
            all_rows = form_tables[0]
            mid = len(all_rows) // 2
            return {'last5': all_rows[:mid], 'last10': all_rows[mid:]}

        rows = self._parse_table_from_html(soup)
        if rows:
            mid = len(rows) // 2
            return {'last5': rows[:mid], 'last10': rows[mid:]}

        return {'last5': [], 'last10': []}

    def scrape(self, url: str) -> Dict:
        html = self.get_page(url)
        if not html:
            return {'error': 'Não foi possível acessar o footystats.org após várias tentativas. O site pode estar bloqueando acessos automatizados.'}

        page_type = self._detect_page_type(url)
        logger.info(f'Tipo de pagina: {page_type}, HTML size: {len(html)}')

        if page_type == 'fixtures':
            result = self._parse_fixtures(html)
            if not result.get('matches'):
                result = self._try_fixtures_from_json(html)
            return {'type': 'fixtures', 'data': result}

        if page_type == 'form_table':
            result = self._parse_form_table(html)
            return {'type': 'form_table', 'data': result}

        result = self._parse_standings(html)
        if not result:
            return {'error': 'Nenhuma tabela de classificação encontrada na página do FootyStats.'}
        return {'type': 'standings', 'data': {'table': result}}


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
            self._send_response({
                'success': True,
                'data': result.get('data', {}),
                'type': result.get('type', 'standings'),
            })
        except json.JSONDecodeError:
            self._send_error(400, 'JSON inválido no body da requisição')
        except Exception as e:
            logger.exception('Erro interno no handler')
            self._send_error(500, f'Erro interno: {str(e)}')

    def _send_response(self, data: Dict, status_code: int = 200):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def _send_error(self, status_code: int, message: str):
        self._send_response({'success': False, 'error': message}, status_code)

    def log_message(self, format, *args):
        pass
