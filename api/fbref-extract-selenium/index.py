"""
API route Python para extrair dados de tabelas do fbref.com usando Selenium
Formato Vercel Serverless Function
"""
import json
import time
import os
import re
from typing import Dict, List, Optional

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
from flask import Flask, request, jsonify
from flask_cors import CORS

# Tentar importar webdriver-manager, mas ter fallback para ambiente serverless
try:
    from webdriver_manager.chrome import ChromeDriverManager
    USE_WEBDRIVER_MANAGER = True
except ImportError:
    USE_WEBDRIVER_MANAGER = False

app = Flask(__name__)
CORS(app)


class FBrefSeleniumScraper:
    """Scraper usando Selenium para sites com JavaScript dinâmico"""

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
        'home_away': [
            'stats_results_2025-2026_111_home_away',
            'results_2025-2026_111_home_away',
            'stats_results_2025-2026111_home_away',
            'results2025-2026111_home_away',
            # Padrões genéricos
            r'stats_results_.*_home_away',
            r'results.*_home_away',
        ],
        'standard_for': [
            'stats_squads_standard_for',
            'standard_for'
        ]
    }

    def __init__(self, headless: bool = True):
        """
        Inicializa o driver Selenium
        
        Args:
            headless: Se True, executa o navegador em modo headless
        """
        chrome_options = Options()
        if headless:
            chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')
        
        # Para ambiente serverless (Vercel), pode precisar de configurações adicionais
        if os.environ.get('VERCEL'):
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--single-process')
            chrome_options.binary_location = os.environ.get('GOOGLE_CHROME_BIN', '/usr/bin/google-chrome-stable')
        
        # Configurar serviço do ChromeDriver
        if USE_WEBDRIVER_MANAGER and not os.environ.get('VERCEL'):
            # Em ambiente local, usa webdriver-manager
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
        else:
            # Em ambiente serverless ou sem webdriver-manager, tenta usar ChromeDriver do PATH
            try:
                self.driver = webdriver.Chrome(options=chrome_options)
            except Exception as e:
                # Fallback: tenta sem service
                self.driver = webdriver.Chrome(options=chrome_options)
        
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

    def get_page(self, url: str, wait_time: int = 10) -> tuple[Optional[BeautifulSoup], Optional[Dict]]:
        """
        Carrega a página e retorna o conteúdo parseado com informações de erro
        
        Args:
            url: URL completa
            wait_time: Tempo de espera em segundos
            
        Returns:
            Tupla (BeautifulSoup object ou None, dict com informações de erro ou None)
        """
        try:
            print(f"[FBrefSeleniumScraper] Acessando: {url}")
            self.driver.get(url)
            current_url = self.driver.current_url
            print(f"[FBrefSeleniumScraper] URL atual: {current_url}")
            
            # Verifica se foi redirecionado para página de erro
            page_title = self.driver.title.lower()
            if 'error' in page_title or 'not found' in page_title or '404' in page_title or '403' in page_title:
                error_info = {
                    "type": "page_error",
                    "status_code": None,
                    "message": f"Página retornou erro: {self.driver.title}",
                    "url": url,
                    "current_url": current_url,
                    "title": self.driver.title
                }
                print(f"[FBrefSeleniumScraper] Erro detectado no título: {error_info}")
                return (None, error_info)
            
            # Aguarda o carregamento da página
            time.sleep(3)
            
            # Tenta aceitar cookies se existir
            try:
                accept_button = WebDriverWait(self.driver, 5).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Accept') or contains(text(), 'Aceitar')]"))
                )
                accept_button.click()
                print("[FBrefSeleniumScraper] Cookies aceitos")
                time.sleep(1)
            except:
                pass  # Botão de cookies não encontrado ou já foi clicado
            
            # Aguarda tabelas carregarem
            try:
                WebDriverWait(self.driver, wait_time).until(
                    EC.presence_of_element_located((By.TAG_NAME, "table"))
                )
                print("[FBrefSeleniumScraper] Tabelas detectadas na página")
            except Exception as e:
                # Se não encontrou tabelas, ainda pode ser uma página válida
                print(f"[FBrefSeleniumScraper] Aviso: Nenhuma tabela encontrada após {wait_time}s: {e}")
                # Não retorna erro aqui, apenas loga o aviso
            
            # Obtém o HTML da página
            html = self.driver.page_source
            
            # Verifica se o HTML contém indicadores de erro
            if '403' in html or 'Forbidden' in html or 'Access Denied' in html:
                error_info = {
                    "type": "403",
                    "status_code": 403,
                    "message": "Acesso negado detectado no conteúdo da página",
                    "url": url,
                    "current_url": current_url
                }
                print(f"[FBrefSeleniumScraper] Erro 403 detectado no conteúdo: {error_info}")
                return (None, error_info)
            
            soup = BeautifulSoup(html, 'lxml')
            
            # Verifica se a página carregou corretamente pelo título
            title_tag = soup.find('title')
            if title_tag:
                title_text = title_tag.get_text().lower()
                if 'error' in title_text or 'not found' in title_text or '404' in title_text:
                    error_info = {
                        "type": "page_error",
                        "status_code": None,
                        "message": f"Página retornou erro: {title_tag.get_text()}",
                        "url": url,
                        "current_url": current_url,
                        "title": title_tag.get_text()
                    }
                    print(f"[FBrefSeleniumScraper] Erro detectado no título HTML: {error_info}")
                    return (None, error_info)
            
            print(f"[FBrefSeleniumScraper] Página carregada com sucesso (título: {title_tag.get_text() if title_tag else 'N/A'})")
            return (soup, None)
            
        except Exception as e:
            error_type = type(e).__name__
            error_message = str(e)
            
            # Identifica tipos específicos de erro do Selenium
            if 'TimeoutException' in error_type or 'timeout' in error_message.lower():
                error_info = {
                    "type": "timeout",
                    "status_code": None,
                    "message": f"Timeout ao aguardar elementos da página: {error_message}",
                    "url": url,
                    "exception_type": error_type,
                    "wait_time": wait_time
                }
            elif 'WebDriverException' in error_type:
                error_info = {
                    "type": "webdriver_error",
                    "status_code": None,
                    "message": f"Erro do WebDriver: {error_message}",
                    "url": url,
                    "exception_type": error_type
                }
            elif 'NoSuchElementException' in error_type:
                error_info = {
                    "type": "element_not_found",
                    "status_code": None,
                    "message": f"Elemento não encontrado: {error_message}",
                    "url": url,
                    "exception_type": error_type
                }
            else:
                error_info = {
                    "type": "selenium_exception",
                    "status_code": None,
                    "message": f"Erro ao carregar página: {error_message}",
                    "url": url,
                    "exception_type": error_type
                }
            
            print(f"[FBrefSeleniumScraper] Erro: {error_info}")
            return (None, error_info)

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
            elif table_type == 'home_away' and '_home_away' in table_id.lower():
                return table
            elif table_type == 'standard_for' and 'standard_for' in table_id.lower():
                return table

        return None

    def scrape_any_page(self, url: str, extract_all_tables: bool = True) -> Dict:
        """
        Extrai todas as tabelas de qualquer página web (FBref)
        """
        soup, error_info = self.get_page(url)
        
        if not soup:
            # Construir mensagem de erro específica baseada no tipo de erro
            if error_info:
                error_type = error_info.get("type", "unknown")
                
                if error_type == "403":
                    error_message = f"Erro 403: Acesso negado. O site está bloqueando requisições automatizadas.\nURL: {url}"
                elif error_type == "timeout":
                    error_message = f"Timeout: A requisição excedeu o tempo limite.\nURL: {url}\nTempo de espera: {error_info.get('wait_time', 'N/A')}s"
                elif error_type == "webdriver_error":
                    error_message = f"Erro do WebDriver: {error_info.get('message', 'Erro desconhecido')}\nURL: {url}"
                elif error_type == "element_not_found":
                    error_message = f"Elemento não encontrado: {error_info.get('message', 'Erro desconhecido')}\nURL: {url}"
                elif error_type == "page_error":
                    error_message = f"Erro na página: {error_info.get('message', 'Página retornou erro')}\nURL: {url}"
                elif error_type == "selenium_exception":
                    error_message = f"Erro do Selenium: {error_info.get('message', 'Erro desconhecido')}\nURL: {url}"
                else:
                    error_message = f"Erro ao acessar a página: {error_info.get('message', 'Erro desconhecido')}\nURL: {url}"
            else:
                error_message = "Não foi possível acessar a página. Erro desconhecido."
            
            return {
                "error": error_message,
                "error_details": error_info,
                "url": url,
                "tables": {}
            }
        
        results = {
            "url": url,
            "tables": {}
        }
        
        # Mapear tabelas por tipo
        table_types = ['geral', 'home_away', 'standard_for']
        
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

    def close(self):
        """Fecha o driver do navegador"""
        if hasattr(self, 'driver') and self.driver:
            try:
                self.driver.quit()
            except:
                pass


@app.route('/', methods=['POST', 'OPTIONS'])
def handler():
    """
    Handler para Vercel Serverless Function usando Flask
    """
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        return '', 200

    # Apenas aceita POST
    if request.method != 'POST':
        return jsonify({
            'success': False,
            'error': 'Método não permitido. Use POST.'
        }), 405

    scraper = None
    try:
        # Ler body
        request_data = request.get_json()

        if not request_data:
            return jsonify({
                'success': False,
                'error': 'JSON inválido no body da requisição'
            }), 400
        
        # Validar request
        championship_url = request_data.get('championshipUrl', '')
        championship_id = request_data.get('championshipId', '')
        extract_types = request_data.get('extractTypes', ['table'])
        
        if not championship_url or 'fbref.com' not in championship_url:
            return jsonify({
                'success': False,
                'error': 'URL inválida. Apenas URLs do fbref.com são permitidas.'
            }), 400
        
        # Inicializar scraper
        scraper = FBrefSeleniumScraper(headless=True)
        
        # Extrair tabelas
        result = scraper.scrape_any_page(championship_url, extract_all_tables=True)
        
        if 'error' in result:
            response_data = {
                'success': False,
                'error': result['error']
            }
            # Incluir detalhes do erro se disponível (para debug)
            if 'error_details' in result:
                response_data['error_details'] = result['error_details']
            return jsonify(response_data), 200
        
        # Mapear tabelas para formato esperado
        tables = result.get('tables', {})
        mapped_tables = {
            'geral': tables.get('geral', []),
            'home_away': tables.get('home_away', []),
            'standard_for': tables.get('standard_for', [])
        }
        
        # Identificar tabelas faltantes
        missing_tables = []
        for table_type in ['geral', 'home_away', 'standard_for']:
            if not mapped_tables[table_type] or len(mapped_tables[table_type]) == 0:
                missing_tables.append(table_type)
        
        # Retornar resposta
        return jsonify({
            'success': True,
            'data': {
                'tables': mapped_tables,
                'missingTables': missing_tables
            }
        }), 200
        
    except json.JSONDecodeError:
        return jsonify({
            'success': False,
            'error': 'JSON inválido no body da requisição'
        }), 400
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        return jsonify({
            'success': False,
            'error': f'Erro interno: {str(e)}',
            'traceback': error_trace
        }), 500
    finally:
        # Sempre fecha o driver
        if scraper:
            scraper.close()

