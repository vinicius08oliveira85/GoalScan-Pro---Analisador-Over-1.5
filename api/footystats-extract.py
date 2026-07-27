"""
API route Python para extrair dados do footystats.org
Suporta 3 paginas: classificacao (standings), jogos (fixtures), forma (form-table)
Usa cloudscraper para bypass de Cloudflare/bot detection
Parsing por classes CSS (td.position, td.team, td.mp, etc) em vez de indices de coluna
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
                    logger.warning(f'Resposta muito curta ({len(resp.text)} chars)')

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

    @staticmethod
    def _is_premium(el) -> bool:
        """Check if a td contains a premium lock icon."""
        return bool(el.select_one('i.fas.fa-lock, i.fa-lock, a[href*="/premium"]'))

    @staticmethod
    def _text(el) -> str:
        return el.get_text(strip=True) if el else ''

    def _get_standings_table(self, soup: BeautifulSoup):
        """Encontra a tabela de classificacao testando todas as tables."""
        tables = soup.select('table')
        candidates = []

        for table in tables:
            rows = table.select('tbody tr')
            if len(rows) < 3:
                continue
            thead = table.select_one('thead')
            header_texts = []
            if thead:
                header_texts = [th.get_text(strip=True).lower() for th in thead.select('th, td')]

            # Verifica se tem colunas tipicas de classificacao
            has_position = bool(table.select_one('td.position'))
            has_team = bool(table.select_one('td.team a, td.team'))
            has_pts = bool(table.select_one('td.points'))
            has_mp = bool(table.select_one('td.mp'))

            score = sum([has_position, has_team, has_pts, has_mp])
            td_count = len(table.select('tbody tr:first-child td')) if rows else 0
            candidates.append((score, td_count, table))

            if has_position and has_team and has_pts:
                logger.info(f'Tabela com classes position+team+points: {len(rows)} linhas, {td_count} colunas')
                return table

        # fallback: melhor candidato
        if candidates:
            candidates.sort(key=lambda x: (x[0], x[1]), reverse=True)
            best = candidates[0]
            logger.info(f'Fallback: melhor tabela tem score={best[0]}, {best[1]} colunas')
            return best[2]

        return None

    def _parse_standings(self, html: str) -> List[Dict[str, str]]:
        soup = BeautifulSoup(html, 'html.parser')
        table = self._get_standings_table(soup)
        if not table:
            logger.warning('Nenhuma tabela de classificacao encontrada')
            # fallback: full-league-table
            table = soup.select_one('table.full-league-table')
        if not table:
            return []

        rows = table.select('tbody tr')
        logger.info(f'Encontradas {len(rows)} linhas na tabela de classificacao')
        results = []

        for row in rows:
            entry = {}

            pos_el = row.select_one('td.position')
            if pos_el:
                entry['Rk'] = self._text(pos_el)

            team_el = row.select_one('td.team a')
            if not team_el:
                team_el = row.select_one('td.team')
            if team_el:
                name = self._text(team_el)
                if name and len(name) > 1:
                    entry['Squad'] = re.sub(r'\s+', ' ', name)

            if 'Squad' not in entry:
                continue

            for field, selector in [
                ('MP', 'td.mp'), ('W', 'td.win'), ('D', 'td.draw'),
                ('L', 'td.loss'), ('GF', 'td.gf'), ('GA', 'td.ga'),
                ('GD', 'td.gd'), ('Pts', 'td.points'),
            ]:
                el = row.select_one(selector)
                if el:
                    entry[field] = self._text(el)

            for field, selector in [
                ('PPG', 'td.ppg'), ('CS', 'td.cs'), ('BTTS', 'td.btts'),
                ('xG', 'td.fts'), ('Over 1.5', 'td.over15'),
                ('Over 2.5', 'td.over25'), ('AVG', 'td.avg'),
            ]:
                el = row.select_one(selector)
                if el and not self._is_premium(el):
                    val = self._text(el)
                    if val:
                        entry[field] = val

            results.append(entry)

        logger.info(f'Parseados {len(results)} times')
        return results

    def _parse_fixtures(self, html: str) -> Dict:
        soup = BeautifulSoup(html, 'html.parser')
        matches = []
        seen = set()

        # Tenta tr.match primeiro (formato comum footystats)
        for row in soup.select('tr.match'):
            home_el = row.select_one('.team-home a, .home a, td:first-child a')
            away_el = row.select_one('.team-away a, .away a, td:last-child a')
            if not home_el or not away_el:
                continue
            home = self._text(home_el)
            away = self._text(away_el)
            if not home or not away:
                continue
            key = f'{home}_{away}'
            if key in seen:
                continue
            seen.add(key)

            entry = {'homeTeam': home, 'awayTeam': away}
            text = row.get_text(' ', strip=True)

            score_match = re.search(r'(\d+)\s*[-–:]\s*(\d+)', text)
            if score_match:
                entry['score'] = f"{score_match.group(1)}-{score_match.group(2)}"

            date_match = re.search(r'(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2})', text)
            if date_match:
                entry['date'] = date_match.group(1)

            matches.append(entry)

        # Fallback: procurar linhas com 2 links de times
        if not matches:
            for row in soup.select('tr'):
                cells = row.select('td')
                if len(cells) < 3:
                    continue
                team_names = []
                for cell in cells:
                    a = cell.select_one('a')
                    if not a:
                        continue
                    name = self._text(a)
                    if name and len(name) > 2 and not re.match(r'^\d', name) and 'premium' not in name.lower():
                        team_names.append(name)
                if len(team_names) >= 2:
                    home = team_names[0]
                    away = team_names[-1]
                    key = f'{home}_{away}'
                    if key in seen:
                        continue
                    seen.add(key)
                    entry = {'homeTeam': home, 'awayTeam': away}
                    text = row.get_text(' ', strip=True)
                    score_match = re.search(r'(\d+)\s*[-–:]\s*(\d+)', text)
                    if score_match:
                        entry['score'] = f"{score_match.group(1)}-{score_match.group(2)}"
                    date_match = re.search(r'(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2})', text)
                    if date_match:
                        entry['date'] = date_match.group(1)
                    matches.append(entry)

        return {'matches': matches}

    def _parse_form_table(self, html: str) -> Dict:
        soup = BeautifulSoup(html, 'html.parser')
        tables = soup.select('table.full-league-table')

        form_tables = []
        for table in tables:
            parsed = self._parse_standings_from_table(table)
            if parsed and len(parsed) >= 3:
                form_tables.append(parsed)

        if len(form_tables) >= 2:
            return {'last5': form_tables[0], 'last10': form_tables[1]}
        elif len(form_tables) == 1:
            all_rows = form_tables[0]
            mid = len(all_rows) // 2
            return {'last5': all_rows[:mid], 'last10': all_rows[mid:]}

        parsed = self._parse_standings_from_table(soup)
        if parsed and len(parsed) >= 3:
            mid = len(parsed) // 2
            return {'last5': parsed[:mid], 'last10': parsed[mid:]}

        return {'last5': [], 'last10': []}

    def _parse_standings_from_table(self, table_soup) -> List[Dict[str, str]]:
        rows = table_soup.select('tbody tr') if table_soup.name == 'table' else table_soup.select('table.full-league-table tbody tr, table tbody tr')
        if not rows:
            return []

        results = []
        for row in rows:
            entry = {}
            pos_el = row.select_one('td.position')
            if pos_el:
                entry['Rk'] = self._text(pos_el)
            team_el = row.select_one('td.team a')
            if team_el:
                name = self._text(team_el)
                if name and len(name) > 1:
                    entry['Squad'] = re.sub(r'\s+', ' ', name)
            if 'Squad' not in entry:
                continue
            for field, selector in [
                ('MP', 'td.mp'), ('W', 'td.win'), ('D', 'td.draw'),
                ('L', 'td.loss'), ('GF', 'td.gf'), ('GA', 'td.ga'),
                ('GD', 'td.gd'), ('Pts', 'td.points'),
            ]:
                el = row.select_one(selector)
                if el:
                    entry[field] = self._text(el)
            results.append(entry)
        return results

    def scrape(self, url: str) -> Dict:
        html = self.get_page(url)
        if not html:
            return {'error': 'Nao foi possivel acessar o footystats.org apos varias tentativas.'}

        page_type = self._detect_page_type(url)
        logger.info(f'Tipo de pagina: {page_type}, HTML size: {len(html)}')

        # DEBUG: log parte do HTML para analise
        lines = html.split('\n')
        table_lines = [l for l in lines if 'full-league-table' in l or 'league-table' in l or '<table' in l.lower()]
        logger.info(f'Total lines: {len(lines)}, table lines found: {len(table_lines)}')
        for tl in table_lines[:5]:
            logger.info(f'  TABLE: {tl.strip()[:200]}')
        head_section = html[:3000]
        logger.info(f'HTML head/body start: {head_section[:500]}')

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
            return {'error': 'Nenhuma tabela de classificacao encontrada na pagina do FootyStats.'}
        return {'type': 'standings', 'data': {'table': result}}

    def _try_fixtures_from_json(self, html: str) -> Dict:
        soup = BeautifulSoup(html, 'html.parser')
        matches = []
        for script in soup.select('script'):
            text = script.string or ''
            if 'homeTeam' not in text and 'awayTeam' not in text:
                continue
            try:
                for item_match in re.finditer(r'\{[^{}]*(?:homeTeam|awayTeam)[^{}]*\}', text):
                    try:
                        item = json.loads(item_match.group())
                        home = item.get('home', item.get('homeTeam', item.get('home_team', '')))
                        away = item.get('away', item.get('awayTeam', item.get('away_team', '')))
                        if isinstance(home, dict):
                            home = home.get('name', '')
                        if isinstance(away, dict):
                            away = away.get('name', '')
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
                self._send_error(400, 'URL invalida. Apenas URLs do footystats.org sao permitidas.')
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
            self._send_error(400, 'JSON invalido no body da requisicao')
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
