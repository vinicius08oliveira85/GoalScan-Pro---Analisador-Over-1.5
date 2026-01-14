"""
API route Python para extrair dados de tabelas do fbref.com
Baseado no repositório app-scraper/scraper.py
"""
import json
import time
from http.server import BaseHTTPRequestHandler
from typing import Dict, List, Optional
from urllib.parse import urljoin

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    # Fallback para desenvolvimento local
    pass


class FBrefScraper:
    """Classe para fazer scraping de dados do FBref.com"""

    # Mapeamento de nomes de tabelas para IDs HTML possíveis
    TABLE_MAPPING = {
        'geral': [
            'stats_results_2025-2026_111_overall',
            'results_2025-2026_111_overall',
            'stats_results_2025-2026111_overall',
            'results2025-2026111_overall',
            # Padrões genéricos
            r'stats_results_.*_overall',
            r'results.*_overall',
        ],
        'standard_for': [
            'stats_squads_standard_for',
            'standard_for'
        ],
        'passing_for': [
            'stats_squads_passing_for',
            'stats_squads_passing',
            'passing_for'
        ],
        'gca_for': [
            'stats_squads_gca_for',
            'stats_squads_gca',
            'gca_for',
            'stats_gca_for'
        ]
    }

    def __init__(self, base_url: str = "https://fbref.com"):
        self.base_url = base_url
        self.session = requests.Session()
        # Headers mais completos para evitar bloqueio 403
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
            'Referer': 'https://www.google.com/',
        })

    def get_page(self, url: str, retries: int = 3) -> Optional[BeautifulSoup]:
        """
        Faz requisição HTTP e retorna o conteúdo parseado

        Args:
            url: URL completa ou relativa
            retries: Número de tentativas em caso de falha

        Returns:
            BeautifulSoup object ou None em caso de erro
        """
        if not url.startswith('http'):
            url = urljoin(self.base_url, url)

        for attempt in range(retries):
            try:
                # Adiciona delay antes da requisição para parecer mais humano
                if attempt > 0:
                    time.sleep(2 ** attempt)
                else:
                    time.sleep(1)

                response = self.session.get(url, timeout=30, allow_redirects=True)

                # Verifica status code
                if response.status_code == 403:
                    error_msg = f"Erro 403: Acesso negado. O site pode estar bloqueando requisições automatizadas."
                    if attempt < retries - 1:
                        # Tenta com headers diferentes
                        self.session.headers['Referer'] = url
                        time.sleep(2)
                        continue
                    else:
                        return None

                # Verifica outros códigos de erro
                if response.status_code >= 400:
                    if attempt < retries - 1:
                        continue
                    else:
                        return None

                response.raise_for_status()

                # FBref pode retornar diferentes encodings
                if response.encoding is None or response.encoding == 'ISO-8859-1':
                    response.encoding = 'utf-8'

                soup = BeautifulSoup(response.content, 'lxml')

                # Verifica se a página carregou corretamente
                title_tag = soup.find('title')
                if title_tag:
                    title_text = title_tag.get_text().lower()
                    if 'error' in title_text or 'not found' in title_text or '404' in title_text:
                        return None

                return soup

            except requests.exceptions.RequestException as e:
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)  # Backoff exponencial
                else:
                    return None

        return None

    def _normalize_header_name(self, header: str) -> str:
        """
        Normaliza nomes de cabeçalhos para garantir consistência
        """
        if not header:
            return header

        # Remove espaços extras
        header = ' '.join(header.split())

        # Mapeamento de normalizações comuns (case-insensitive)
        header_lower = header.lower().strip()

        field_mapping = {
            'rk': 'Rk',
            'rank': 'Rk',
            'squad': 'Squad',
            'team': 'Squad',
            'mp': 'MP',
            'matches played': 'MP',
            'w': 'W',
            'wins': 'W',
            'd': 'D',
            'draws': 'D',
            'l': 'L',
            'losses': 'L',
            'gf': 'GF',
            'goals for': 'GF',
            'ga': 'GA',
            'goals against': 'GA',
            'gd': 'GD',
            'goal difference': 'GD',
            'pts': 'Pts',
            'points': 'Pts',
            'pts/mp': 'Pts/MP',
            'pts / mp': 'Pts/MP',
            'points per match': 'Pts/MP',
            'xg': 'xG',
            'expected goals': 'xG',
            'xga': 'xGA',
            'expected goals against': 'xGA',
            'xgd': 'xGD',
            'expected goal difference': 'xGD',
            'xgd/90': 'xGD/90',
            'xgd /90': 'xGD/90',
            'xgd / 90': 'xGD/90',
            'last 5': 'Last 5',
            'last5': 'Last 5',
            'last five': 'Last 5',
            'attendance': 'Attendance',
            'top team scorer': 'Top Team Scorer',
            'top scorer': 'Top Team Scorer',
            'goalkeeper': 'Goalkeeper',
            'gk': 'Goalkeeper',
        }

        if header_lower in field_mapping:
            return field_mapping[header_lower]

        # Normalizações específicas para campos compostos
        if 'pts' in header_lower and 'mp' in header_lower:
            return 'Pts/MP'
        if 'xgd' in header_lower and '90' in header_lower:
            return 'xGD/90'
        if 'last' in header_lower and '5' in header_lower:
            return 'Last 5'
        if 'top' in header_lower and 'scorer' in header_lower:
            return 'Top Team Scorer'

        # Mantém o header original capitalizado apropriadamente
        if header.isupper() or header.islower():
            words = header.split()
            if len(words) > 1:
                return ' '.join(word.capitalize() for word in words)
            else:
                return header.capitalize()

        return header

    def extract_table_data(self, soup: BeautifulSoup, table_id: Optional[str] = None, table_name: Optional[str] = None) -> List[Dict]:
        """
        Extrai dados de uma tabela HTML processando célula-por-célula para garantir todas as colunas
        """
        import re

        if table_id:
            table = soup.find('table', {'id': table_id})
        else:
            # Tenta encontrar tabela por múltiplos critérios
            table = (soup.find('table', {'class': 'stats_table'}) or
                    soup.find('table', {'id': lambda x: x and 'stats' in str(x).lower()}) or
                    soup.find('table'))

        if not table:
            return []

        # 1. Extrair cabeçalhos do thead
        headers = []
        thead = table.find('thead')

        if thead:
            header_rows = thead.find_all('tr')
            if header_rows:
                # Calcula número máximo de colunas
                max_cols = 0
                for row in header_rows:
                    cols = row.find_all(['th', 'td'])
                    col_count = 0
                    for col in cols:
                        colspan = int(col.get('colspan', 1))
                        col_count += colspan
                    max_cols = max(max_cols, col_count)

                # Cria matriz de cabeçalhos
                header_matrix = [[''] * max_cols for _ in range(len(header_rows))]

                # Preenche matriz considerando colspan e rowspan
                for row_idx, row in enumerate(header_rows):
                    col_idx = 0
                    for cell in row.find_all(['th', 'td']):
                        # Pula células já preenchidas por rowspan de linhas anteriores
                        while col_idx < max_cols and header_matrix[row_idx][col_idx]:
                            col_idx += 1

                        if col_idx >= max_cols:
                            break

                        colspan = int(cell.get('colspan', 1))
                        rowspan = int(cell.get('rowspan', 1))
                        cell_text = cell.get_text(strip=True)

                        # Preenche todas as células cobertas por colspan e rowspan
                        for r in range(row_idx, min(row_idx + rowspan, len(header_rows))):
                            for c in range(col_idx, min(col_idx + colspan, max_cols)):
                                if not header_matrix[r][c]:
                                    header_matrix[r][c] = cell_text

                        col_idx += colspan

                # Combina cabeçalhos de múltiplas linhas (última linha como primária)
                headers = []
                for col_idx in range(max_cols):
                    col_headers = []
                    for row_idx in range(len(header_rows)):
                        header_text = header_matrix[row_idx][col_idx]
                        if header_text:
                            col_headers.append(header_text)

                    # Remove duplicatas mantendo ordem
                    seen = set()
                    unique_headers = []
                    for h in col_headers:
                        if h and h not in seen:
                            seen.add(h)
                            unique_headers.append(h)

                    # Combina: prioriza última linha (mais específica)
                    if unique_headers:
                        if len(unique_headers) > 1:
                            last_header = unique_headers[-1]
                            first_header = unique_headers[0] if unique_headers else ''

                            known_categories = ['Playing Time', 'Performance', 'Expected', 'Progression', 'Per 90 Minutes']

                            if not last_header.strip():
                                combined_header = first_header.strip() if first_header.strip() else f'col_{col_idx}'
                            elif first_header.strip() and first_header != last_header and len(unique_headers) == 2:
                                if table_name == 'standard_for' and first_header.strip() in known_categories and last_header.strip():
                                    combined_header = f"{first_header.strip()}_{last_header.strip()}"
                                elif '/' in last_header or last_header in ['xG', 'xGA', 'xGD', 'xGD/90', 'Last 5']:
                                    combined_header = last_header.strip()
                                elif first_header in ['Expected', 'Goals', 'Points'] and first_header not in known_categories:
                                    combined_header = last_header.strip()
                                else:
                                    combined_header = f"{first_header} {last_header}".strip()
                            else:
                                combined_header = last_header.strip()
                        else:
                            combined_header = unique_headers[0].strip()

                        # Normaliza nomes de campos comuns
                        combined_header = self._normalize_header_name(combined_header)
                    else:
                        combined_header = f'col_{col_idx}'

                    headers.append(combined_header)

        # Se não encontrou headers no thead, tenta na primeira linha
        if not headers:
            first_row = table.find('tr')
            if not first_row:
                first_cell = table.find(['th', 'td'])
                if first_cell:
                    first_row = first_cell.find_parent('tr')

            if first_row:
                for th in first_row.find_all(['th', 'td']):
                    colspan = int(th.get('colspan', 1))
                    header_text = th.get_text(strip=True)
                    if not header_text:
                        header_text = f'col_{len(headers)}'
                    for _ in range(colspan):
                        headers.append(header_text if colspan == 1 else f'{header_text}_{len(headers)}')

            # Se ainda não encontrou headers, cria headers genéricos
            if not headers:
                first_data_row = table.find('tbody')
                if first_data_row:
                    first_data_row = first_data_row.find('tr')
                if not first_data_row:
                    first_data_row = table.find('tr')

                if first_data_row:
                    num_cols = len(first_data_row.find_all(['td', 'th']))
                    headers = [f'col_{i}' for i in range(num_cols)]

        # 2. Extrair dados do tbody
        data = []
        tbody = table.find('tbody')
        rows = tbody.find_all('tr') if tbody else table.find_all('tr')

        for row in rows:
            # Ignora linhas de cabeçalho repetidas
            if row.get('class') and 'thead' in ' '.join(row.get('class', [])):
                continue

            row_data = {}
            col_idx = 0
            cells = row.find_all(['td', 'th'])

            for cell in cells:
                if col_idx >= len(headers):
                    while col_idx >= len(headers):
                        headers.append(f'col_{len(headers)}')

                colspan = int(cell.get('colspan', 1))
                header = headers[col_idx] if col_idx < len(headers) else f'col_{col_idx}'

                # Extrai texto
                text = cell.get_text(strip=True)

                # Salva o valor na coluna principal
                row_data[header] = text

                # Se colspan > 1, também salva nas colunas seguintes
                for i in range(1, colspan):
                    if col_idx + i < len(headers):
                        row_data[headers[col_idx + i]] = text

                col_idx += colspan

            # Garante que todas as colunas estejam presentes (mesmo que vazias)
            for header in headers:
                if header not in row_data:
                    row_data[header] = ''

            if row_data:
                data.append(row_data)

        return data

    def find_table_by_type(self, soup: BeautifulSoup, table_type: str) -> Optional[BeautifulSoup]:
        """Encontra uma tabela pelo tipo (geral, standard_for, etc.)"""
        possible_ids = self.TABLE_MAPPING.get(table_type, [])
        import re

        for table_id_pattern in possible_ids:
            if isinstance(table_id_pattern, str) and not table_id_pattern.startswith('r'):
                # String literal
                table = soup.find('table', {'id': table_id_pattern})
                if table:
                    return table
            else:
                # Regex pattern
                pattern = table_id_pattern if isinstance(table_id_pattern, str) else table_id_pattern.pattern
                if isinstance(table_id_pattern, str) and table_id_pattern.startswith('r'):
                    pattern = table_id_pattern[1:]  # Remove 'r' prefix
                regex = re.compile(pattern, re.IGNORECASE)
                tables = soup.find_all('table', {'id': regex})
                if tables:
                    # Para 'geral', evitar home_away
                    if table_type == 'geral':
                        for t in tables:
                            table_id = t.get('id', '')
                            if 'home_away' not in table_id.lower():
                                return t
                    else:
                        return tables[0]

        # Fallback: busca por classe stats_table e verifica ID
        all_tables = soup.find_all('table', {'class': 'stats_table'})
        for table in all_tables:
            table_id = table.get('id', '')
            if table_type == 'geral' and '_overall' in table_id.lower() and 'home_away' not in table_id.lower():
                return table
            elif table_type == 'standard_for' and 'standard_for' in table_id.lower():
                return table
            elif table_type == 'passing_for' and 'passing_for' in table_id.lower():
                return table
            elif table_type == 'gca_for' and 'gca_for' in table_id.lower():
                return table

        return None

    def scrape_any_page(self, url: str, extract_all_tables: bool = True) -> Dict:
        """
        Extrai todas as tabelas de qualquer página web (FBref)
        """
        soup = self.get_page(url)

        if not soup:
            return {
                "error": "Não foi possível acessar a página. Possíveis causas:\n"
                        "- O site está bloqueando requisições automatizadas (erro 403)\n"
                        "- A URL está incorreta ou a página não existe (erro 404)\n"
                        "- Problemas de conexão ou timeout",
                "url": url,
                "tables": {}
            }

        results = {
            "url": url,
            "tables": {}
        }

        # Mapear tabelas por tipo
        table_types = ['geral', 'standard_for', 'passing_for', 'gca_for']

        for table_type in table_types:
            table = self.find_table_by_type(soup, table_type)
            if table:
                table_id = table.get('id', f'table_{table_type}')
                data = self.extract_table_data(soup, table_id=table_id, table_name=table_type)

                if data:
                    # Remove campos que terminam com _link
                    for row in data:
                        keys_to_remove = [key for key in row.keys() if key.endswith('_link')]
                        for key in keys_to_remove:
                            row.pop(key, None)
                    results["tables"][table_type] = data

        if len(results["tables"]) == 0:
            return {
                "error": "Nenhuma tabela encontrada na página. Verifique se a URL está correta e se a página contém tabelas de estatísticas.",
                "url": url,
                "tables": {}
            }

        return results


class handler(BaseHTTPRequestHandler):
    """Handler HTTP para Vercel Serverless Function"""

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        """Handle POST request"""
        try:
            # Ler body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            request_data = json.loads(body.decode('utf-8'))

            # Validar request
            championship_url = request_data.get('championshipUrl', '')
            championship_id = request_data.get('championshipId', '')
            extract_types = request_data.get('extractTypes', ['table'])

            if not championship_url or 'fbref.com' not in championship_url:
                self._send_error(400, 'URL inválida. Apenas URLs do fbref.com são permitidas.')
                return

            # Inicializar scraper
            scraper = FBrefScraper()

            # Extrair tabelas
            result = scraper.scrape_any_page(championship_url, extract_all_tables=True)

            if 'error' in result:
                self._send_response({
                    'success': False,
                    'error': result['error']
                })
                return

            # Mapear tabelas para formato esperado
            tables = result.get('tables', {})
            mapped_tables = {
                'geral': tables.get('geral', []),
                'standard_for': tables.get('standard_for', []),
                'passing_for': tables.get('passing_for', []),
                'gca_for': tables.get('gca_for', [])
            }

            # Identificar tabelas faltantes
            missing_tables = []
            for table_type in ['geral', 'standard_for', 'passing_for', 'gca_for']:
                if not mapped_tables[table_type] or len(mapped_tables[table_type]) == 0:
                    missing_tables.append(table_type)

            # Retornar resposta
            self._send_response({
                'success': True,
                'data': {
                    'tables': mapped_tables,
                    'missingTables': missing_tables
                }
            })

        except json.JSONDecodeError:
            self._send_error(400, 'JSON inválido no body da requisição')
        except Exception as e:
            self._send_error(500, f'Erro interno: {str(e)}')

    def _send_response(self, data: Dict, status_code: int = 200):
        """Envia resposta JSON"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def _send_error(self, status_code: int, message: str):
        """Envia erro"""
        self._send_response({
            'success': False,
            'error': message
        }, status_code)

    def log_message(self, format, *args):
        """Suprime logs padrão"""
        pass

