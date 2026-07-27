"""
API route Python para extrair dados de tabelas do fbref.com
Baseado no repositório app-scraper/scraper.py
"""
import json
import random
import time
from typing import Dict, List, Optional
from urllib.parse import urljoin

from starlette.requests import Request
from starlette.responses import Response

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    pass


class FBrefScraper:
    """Classe para fazer scraping de dados do FBref.com"""

    TABLE_MAPPING = {
        'geral': [
            'stats_results_2025-2026_111_overall',
            'results_2025-2026_111_overall',
            'stats_results_2025-2026111_overall',
            'results2025-2026111_overall',
            r'stats_results_.*_overall',
            r'results.*_overall',
        ],
    }

    def __init__(self, base_url: str = "https://fbref.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
        })

    def _fetch_page(self, url: str, retries: int = 3) -> tuple:
        for attempt in range(retries):
            try:
                if attempt > 0:
                    delay = (2 ** attempt) + random.uniform(0.5, 1.5)
                    time.sleep(delay)
                else:
                    time.sleep(random.uniform(1.0, 2.0))

                resp = self.session.get(url, timeout=30, allow_redirects=True)

                if resp.status_code == 403:
                    self.session.headers['Referer'] = 'https://fbref.com/'
                    continue

                if resp.status_code >= 400:
                    continue

                if resp.encoding is None or resp.encoding == 'ISO-8859-1':
                    resp.encoding = 'utf-8'

                return BeautifulSoup(resp.text, 'html.parser'), None

            except requests.exceptions.Timeout:
                if attempt == retries - 1:
                    return None, {'type': 'timeout', 'message': 'Timeout após 3 tentativas', 'attempt': attempt + 1, 'retries': retries}
            except requests.exceptions.ConnectionError:
                if attempt == retries - 1:
                    return None, {'type': 'connection_error', 'message': 'Erro de conexão'}
            except requests.exceptions.RequestException as e:
                if attempt == retries - 1:
                    return None, {'type': 'http_error', 'message': str(e)}

        return None, {'type': 'unknown', 'message': 'Falha após todas as tentativas'}

    def scrape_any_page(self, url: str, extract_all_tables: bool = True) -> Dict:
        soup, error_info = self._fetch_page(url)

        if not soup:
            if error_info:
                error_type = error_info.get("type", "unknown")
                status_code = error_info.get("status_code")
                if error_type == "403":
                    error_message = f"Erro 403: Acesso negado. O site está bloqueando requisições automatizadas.\nURL: {url}"
                elif error_type == "http_error" and status_code == 404:
                    error_message = f"Erro 404: A URL está incorreta ou a página não existe.\nURL: {url}"
                elif error_type == "http_error":
                    error_message = f"Erro HTTP {status_code}: {error_info.get('message', 'Erro desconhecido')}\nURL: {url}"
                elif error_type == "timeout":
                    error_message = f"Timeout: A requisição excedeu o tempo limite (30s).\nURL: {url}"
                else:
                    error_message = f"Erro ao acessar a página: {error_info.get('message', 'Erro desconhecido')}\nURL: {url}"
            else:
                error_message = "Não foi possível acessar a página. Erro desconhecido."
            return {"error": error_message, "error_details": error_info, "url": url, "tables": {}}

        results = {"url": url, "tables": {}}
        table_types = ['geral']

        for table_type in table_types:
            table = self._find_table_by_type(soup, table_type)
            if table:
                table_id = table.get('id', f'table_{table_type}')
                data = self._extract_table_data(soup, table_id=table_id, table_name=table_type)
                if data:
                    for row in data:
                        keys_to_remove = [key for key in row.keys() if key.endswith('_link')]
                        for key in keys_to_remove:
                            row.pop(key, None)
                    results["tables"][table_type] = data

        if len(results["tables"]) == 0:
            return {"error": "Nenhuma tabela encontrada na página.", "url": url, "tables": {}}

        return results

    def _find_table_by_type(self, soup, table_type):
        all_tables = soup.find_all('table', {'class': 'stats_table'})
        for table in all_tables:
            table_id = table.get('id', '')
            if table_type == 'geral' and '_overall' in table_id.lower() and 'home_away' not in table_id.lower():
                return table
        fallback = soup.find('table', {'class': 'stats_table'})
        return fallback if table_type == 'geral' else None

    def _extract_table_data(self, soup, table_id=None, table_name='geral'):
        if table_id:
            table = soup.find('table', {'id': table_id})
        else:
            table = soup.find('table', {'class': 'stats_table'})

        if not table:
            return None

        rows = []
        tbody = table.find('tbody') or table
        trs = tbody.find_all('tr')

        for tr in trs:
            row = {}
            th = tr.find('th')
            if th and th.get('data-stat'):
                row['Rk'] = th.get_text(strip=True)

            tds = tr.find_all('td')
            for td in tds:
                stat = td.get('data-stat', '')
                if stat:
                    val = td.get_text(strip=True)
                    if val in ('', '-', '—'):
                        val = None
                    row[stat] = val

            if row:
                rows.append(row)

        return rows if rows else None


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
        championship_url = body.get('championshipUrl', '')
        championship_id = body.get('championshipId', '')
        extract_types = body.get('extractTypes', ['table'])

        if not championship_url or 'fbref.com' not in championship_url:
            return _send_error(400, 'URL inválida. Apenas URLs do fbref.com são permitidas.')

        scraper = FBrefScraper()
        result = scraper.scrape_any_page(championship_url, extract_all_tables=True)

        if 'error' in result:
            response_data = {'success': False, 'error': result['error']}
            if 'error_details' in result:
                response_data['error_details'] = result['error_details']
            return _send_response(response_data)

        tables = result.get('tables', {})
        mapped_tables = {'geral': tables.get('geral', [])}
        missing_tables = [t for t in ['geral'] if not mapped_tables.get(t) or len(mapped_tables[t]) == 0]

        return _send_response({
            'success': True,
            'data': {'tables': mapped_tables, 'missingTables': missing_tables},
        })

    except json.JSONDecodeError:
        return _send_error(400, 'JSON inválido no body da requisição')
    except Exception as e:
        return _send_error(500, f'Erro interno: {str(e)}')


def _send_response(data: Dict, status_code: int = 200) -> Response:
    return Response(
        content=json.dumps(data, ensure_ascii=False),
        status_code=status_code,
        headers={
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
    )


def _send_error(status_code: int, message: str) -> Response:
    return _send_response({'success': False, 'error': message}, status_code)