"""
Scraper para extrair dados de estatísticas da Serie A do FBref.com
"""
import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import json
from typing import Dict, List, Optional
from urllib.parse import urljoin


class FBrefScraper:
    """Classe para fazer scraping de dados do FBref.com"""
    
    # Mapeamento de nomes de tabelas para IDs HTML possíveis
    TABLE_MAPPING = {
        'results2025-2026111_overall': [
            'stats_results_2025-2026_111_overall',
            'results_2025-2026_111_overall',
            'stats_results_2025-2026111_overall',
            'results2025-2026111_overall'
        ],
        'results2025-2026111_home_away': [
            'stats_results_2025-2026_111_home_away',
            'results_2025-2026_111_home_away',
            'stats_results_2025-2026111_home_away',
            'results2025-2026111_home_away'
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
                print(f"Status code: {response.status_code}")
                
                # Verifica se foi bloqueado
                if response.status_code == 403:
                    error_msg = f"Erro 403: Acesso negado. O site pode estar bloqueando requisições automatizadas."
                    print(error_msg)
                    print(f"URL tentada: {url}")
                    print(f"Headers enviados: {dict(self.session.headers)}")
                    if attempt < retries - 1:
                        # Tenta com headers diferentes
                        self.session.headers['Referer'] = url
                        time.sleep(2)
                        continue
                    else:
                        return None
                
                # Verifica outros códigos de erro
                if response.status_code >= 400:
                    error_msg = f"Erro HTTP {response.status_code}: {response.reason}"
                    print(error_msg)
                    if attempt < retries - 1:
                        continue
                    else:
                        return None
                
                response.raise_for_status()
                
                # FBref pode retornar diferentes encodings
                if response.encoding is None or response.encoding == 'ISO-8859-1':
                    response.encoding = 'utf-8'
                
                soup = BeautifulSoup(response.content, 'lxml')
                
                # Verifica se a página carregou corretamente (não é uma página de erro)
                title_tag = soup.find('title')
                if title_tag:
                    title_text = title_tag.get_text().lower()
                    print(f"Título da página: {title_text}")
                    if 'error' in title_text or 'not found' in title_text or '404' in title_text:
                        print("Página de erro detectada")
                        return None
                
                # Verifica se há conteúdo na página
                body = soup.find('body')
                if body:
                    body_text = body.get_text(strip=True)
                    if len(body_text) < 100:  # Página muito pequena pode ser erro
                        print(f"Aviso: Página parece ter pouco conteúdo ({len(body_text)} caracteres)")
                
                return soup
                
            except requests.exceptions.RequestException as e:
                error_msg = f"Erro na tentativa {attempt + 1}/{retries}: {e}"
                print(error_msg)
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)  # Backoff exponencial
                else:
                    return None
        
        return None
    
    def _normalize_header_name(self, header: str) -> str:
        """
        Normaliza nomes de cabeçalhos para garantir consistência
        
        Args:
            header: Nome do cabeçalho original
            
        Returns:
            Nome normalizado
        """
        if not header:
            return header
        
        # Remove espaços extras
        header = ' '.join(header.split())
        
        # Mapeamento de normalizações comuns (case-insensitive)
        header_lower = header.lower().strip()
        
        # Mapeamento direto de campos esperados
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
        
        # Verifica mapeamento direto
        if header_lower in field_mapping:
            return field_mapping[header_lower]
        
        # Verifica se contém algum padrão conhecido
        for key, value in field_mapping.items():
            if key in header_lower and len(key) > 2:  # Evita matches muito curtos
                # Se o header contém o padrão, tenta normalizar
                if header_lower.startswith(key) or header_lower.endswith(key):
                    return value
        
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
        # Primeira letra maiúscula, resto minúscula (exceto para abreviações)
        if header.isupper() or header.islower():
            # Se é tudo maiúsculo ou minúsculo, capitaliza palavras
            words = header.split()
            if len(words) > 1:
                return ' '.join(word.capitalize() for word in words)
            else:
                return header.capitalize()
        
        return header
    
    def extract_table_data(self, soup: BeautifulSoup, table_id: Optional[str] = None, table_name: Optional[str] = None) -> List[Dict]:
        """
        Extrai dados de uma tabela HTML processando célula-por-célula para garantir todas as colunas
        
        Args:
            soup: BeautifulSoup object
            table_id: ID da tabela específica (opcional)
            
        Returns:
            Lista de dicionários com os dados da tabela
        """
        if table_id:
            table = soup.find('table', {'id': table_id})
        else:
            # Tenta encontrar tabela por múltiplos critérios
            table = (soup.find('table', {'class': 'stats_table'}) or 
                    soup.find('table', {'id': lambda x: x and 'stats' in str(x).lower()}) or
                    soup.find('table'))
        
        if not table:
            print("Tabela não encontrada")
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
                    
                    # Combina: prioriza última linha (mais específica), ignora linhas superiores vazias ou genéricas
                    if unique_headers:
                        # Usa a última linha como primária (geralmente mais específica)
                        if len(unique_headers) > 1:
                            # Última linha é a mais específica
                            last_header = unique_headers[-1]
                            # Só adiciona linha superior se for relevante e não estiver vazia
                            first_header = unique_headers[0] if unique_headers else ''
                            
                            # Categorias conhecidas para incluir nos nomes das colunas
                            known_categories = ['Playing Time', 'Performance', 'Expected', 'Progression', 'Per 90 Minutes']
                            
                            # Se a última linha está vazia, usa a primeira
                            if not last_header.strip():
                                combined_header = first_header.strip() if first_header.strip() else f'col_{col_idx}'
                            # Se há duas linhas diferentes e ambas têm conteúdo, combina apenas se necessário
                            elif first_header.strip() and first_header != last_header and len(unique_headers) == 2:
                                # Para tabela standard_for, inclui categorias superiores
                                if table_name == 'standard_for' and first_header.strip() in known_categories and last_header.strip():
                                    combined_header = f"{first_header.strip()}_{last_header.strip()}"
                                # Para campos como "Expected" + "xG", usa apenas "xG" (se não for categoria conhecida)
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
            # Tenta encontrar headers na primeira linha do tbody ou na própria tabela
            first_row = table.find('tr')
            if not first_row:
                # Tenta encontrar qualquer linha com th ou td
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
            
            # Se ainda não encontrou headers, cria headers genéricos baseados no número de colunas
            if not headers:
                # Conta colunas da primeira linha de dados
                first_data_row = table.find('tbody')
                if first_data_row:
                    first_data_row = first_data_row.find('tr')
                if not first_data_row:
                    first_data_row = table.find('tr')
                
                if first_data_row:
                    num_cols = len(first_data_row.find_all(['td', 'th']))
                    headers = [f'col_{i}' for i in range(num_cols)]
        
        print(f"DEBUG: {len(headers)} colunas detectadas")
        print(f"DEBUG: Cabeçalhos: {headers}")  # Log todos os cabeçalhos para verificação
        
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
                    # Se há mais células que cabeçalhos, cria cabeçalhos adicionais
                    while col_idx >= len(headers):
                        headers.append(f'col_{len(headers)}')
                
                colspan = int(cell.get('colspan', 1))
                header = headers[col_idx] if col_idx < len(headers) else f'col_{col_idx}'
                
                # Extrai texto
                text = cell.get_text(strip=True)
                
                # Salva o valor na coluna principal
                row_data[header] = text
                
                # Se colspan > 1, também salva nas colunas seguintes (se necessário)
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
        
        print(f"DEBUG: {len(data)} linhas extraídas com {len(headers)} colunas")
        
        return data
    
    def scrape_any_page(self, url: str, extract_all_tables: bool = True) -> Dict:
        """
        Extrai todas as tabelas de qualquer página web (FBref, SoccerStats, Ogol, etc.)
        
        Args:
            url: URL completa da página para fazer scraping
            extract_all_tables: Se True, extrai todas as tabelas encontradas. Se False, usa apenas as do mapeamento.
            
        Returns:
            Dicionário com todas as tabelas encontradas na página
        """
        print(f"Fazendo scraping de: {url}")
        soup = self.get_page(url)
        
        if not soup:
            return {
                "error": "Não foi possível acessar a página. Possíveis causas:\n"
                        "- O site está bloqueando requisições automatizadas (erro 403)\n"
                        "- A URL está incorreta ou a página não existe (erro 404)\n"
                        "- Problemas de conexão ou timeout\n"
                        "- O site requer autenticação ou cookies específicos\n\n"
                        "💡 **Solução:** Tente usar o scraper com Selenium (marque 'Usar Selenium') que simula um navegador real.",
                "url": url,
                "tables": {}
            }
        
        results = {
            "url": url,
            "tables": {}
        }
        
        if extract_all_tables:
            # Encontra todas as tabelas na página - busca por múltiplos critérios
            all_tables = []
            seen_tables = set()
            
            # Busca por classe stats_table (FBref)
            tables_by_class = soup.find_all('table', {'class': 'stats_table'})
            for table in tables_by_class:
                table_id = id(table)
                if table_id not in seen_tables:
                    all_tables.append(table)
                    seen_tables.add(table_id)
            
            # Busca por ID que contenha 'stats'
            tables_by_id = soup.find_all('table', {'id': lambda x: x and 'stats' in str(x).lower()})
            for table in tables_by_id:
                table_id = id(table)
                if table_id not in seen_tables:
                    all_tables.append(table)
                    seen_tables.add(table_id)
            
            # Busca por qualquer tabela com classe que contenha 'table' ou 'stats'
            tables_by_class_generic = soup.find_all('table', class_=lambda x: x and ('table' in str(x).lower() or 'stats' in str(x).lower()))
            for table in tables_by_class_generic:
                table_id = id(table)
                if table_id not in seen_tables:
                    all_tables.append(table)
                    seen_tables.add(table_id)
            
            # Busca todas as tabelas (para sites como soccerstats.com)
            all_tables_found = soup.find_all('table')
            for table in all_tables_found:
                table_id = id(table)
                if table_id not in seen_tables:
                    all_tables.append(table)
                    seen_tables.add(table_id)
            
            print(f"Encontradas {len(all_tables)} tabelas na página")
            
            if len(all_tables) == 0:
                return {
                    "error": "Nenhuma tabela encontrada na página. Verifique se a URL está correta e se a página contém tabelas de estatísticas.",
                    "url": url,
                    "tables": {}
                }
            
            for idx, table in enumerate(all_tables):
                table_id = table.get('id', f'table_{idx}')
                table_name = table_id if table_id and table_id != f'table_{idx}' else f'table_{idx}'
                
                print(f"Extraindo tabela: {table_name}")
                data = self.extract_table_data(soup, table_id=table_id if table_id and table_id != f'table_{idx}' else None)
                
                if data:
                    # Remove todos os campos que terminam com _link
                    for row in data:
                        keys_to_remove = [key for key in row.keys() if key.endswith('_link')]
                        for key in keys_to_remove:
                            row.pop(key, None)
                    results["tables"][table_name] = data
            
            if len(results["tables"]) == 0:
                return {
                    "error": "Tabelas encontradas na página, mas nenhuma contém dados extraíveis. Pode ser necessário usar Selenium para páginas com JavaScript dinâmico.",
                    "url": url,
                    "tables": {}
                }
        else:
            # Usa apenas as tabelas do mapeamento
            tables_to_extract = list(self.TABLE_MAPPING.keys())
            
            for table_name in tables_to_extract:
                possible_ids = self.TABLE_MAPPING[table_name]
                table_found = False
                
                for table_id in possible_ids:
                    table = soup.find('table', {'id': table_id})
                    if table:
                        print(f"Extraindo tabela: {table_name} (ID: {table_id})")
                        data = self.extract_table_data(soup, table_id, table_name=table_name)
                        if data:
                            results["tables"][table_name] = data
                            table_found = True
                            break
                
                if not table_found:
                    print(f"Aviso: Tabela '{table_name}' não encontrada. IDs tentados: {possible_ids}")
        
        return results
    
    def scrape_serie_a_stats(self, season: Optional[str] = None, table_filter: Optional[List[str]] = None, url: Optional[str] = None) -> Dict:
        """
        Extrai estatísticas da Serie A
        
        Args:
            season: Temporada específica (formato: 2023-2024) ou None para temporada atual
            table_filter: Lista de nomes de tabelas para filtrar. Se None, usa as tabelas padrão do mapeamento.
                          Ex: ['standard_for', 'passing_for', 'gca_for']
            url: URL customizada para fazer scraping. Se fornecida, ignora season e usa esta URL diretamente.
            
        Returns:
            Dicionário com diferentes tipos de estatísticas
        """
        if url:
            # Usa URL customizada se fornecida
            final_url = url
        else:
            # Usa URL padrão baseada na temporada
            final_url = f"{self.base_url}/en/comps/11/Serie-A-Stats"
            if season:
                final_url = f"{self.base_url}/en/comps/11/{season}/Serie-A-Stats"
        
        print(f"Fazendo scraping de: {final_url}")
        soup = self.get_page(final_url)
        
        if not soup:
            return {
                "error": "Não foi possível acessar a página. O site pode estar bloqueando requisições automatizadas (erro 403). Tente usar o scraper com Selenium que simula um navegador real.",
                "url": final_url
            }
        
        results = {
            "url": final_url,
            "tables": {}
        }
        
        # Define quais tabelas extrair
        if table_filter is None:
            # Usa as tabelas padrão do mapeamento
            tables_to_extract = list(self.TABLE_MAPPING.keys())
        else:
            # Usa apenas as tabelas especificadas no filtro
            tables_to_extract = [t for t in table_filter if t in self.TABLE_MAPPING]
            if len(tables_to_extract) < len(table_filter):
                missing = set(table_filter) - set(tables_to_extract)
                print(f"Aviso: Algumas tabelas não estão no mapeamento: {missing}")
        
        # Busca cada tabela especificada
        for table_name in tables_to_extract:
            possible_ids = self.TABLE_MAPPING[table_name]
            table_found = False
            
            for table_id in possible_ids:
                table = soup.find('table', {'id': table_id})
                if table:
                    print(f"Extraindo tabela: {table_name} (ID: {table_id})")
                    data = self.extract_table_data(soup, table_id, table_name=table_name)
                    if data:
                        # Remove todos os campos que terminam com _link
                        for row in data:
                            keys_to_remove = [key for key in row.keys() if key.endswith('_link')]
                            for key in keys_to_remove:
                                row.pop(key, None)
                        
                        results["tables"][table_name] = data
                        table_found = True
                        break
            
            if not table_found:
                print(f"Aviso: Tabela '{table_name}' não encontrada. IDs tentados: {possible_ids}")
        
        return results
    
    def save_to_csv(self, data: Dict, output_dir: str = "output"):
        """
        Salva os dados extraídos em arquivos CSV
        
        Args:
            data: Dicionário com os dados extraídos
            output_dir: Diretório de saída
        """
        import os
        os.makedirs(output_dir, exist_ok=True)
        
        for table_name, table_data in data.get("tables", {}).items():
            if table_data:
                df = pd.DataFrame(table_data)
                filename = f"{output_dir}/{table_name}.csv"
                df.to_csv(filename, index=False, encoding='utf-8-sig')
                print(f"Dados salvos em: {filename}")
    
    def save_to_json(self, data: Dict, filename: str = "output/serie_a_stats.json"):
        """
        Salva os dados extraídos em arquivo JSON
        
        Args:
            data: Dicionário com os dados extraídos
            filename: Nome do arquivo de saída
        """
        import os
        os.makedirs(os.path.dirname(filename) if os.path.dirname(filename) else '.', exist_ok=True)
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"Dados salvos em: {filename}")


def main():
    """Função principal"""
    scraper = FBrefScraper()
    
    # Tabelas padrão para extrair
    default_tables = ['results2025-2026111_overall', 'results2025-2026111_home_away', 
                      'standard_for', 'passing_for', 'gca_for']
    
    print("Iniciando scraping da Serie A...")
    data = scraper.scrape_serie_a_stats(table_filter=default_tables)
    
    if "error" in data:
        print(f"Erro: {data['error']}")
        return
    
    # Salva os dados
    scraper.save_to_json(data)
    scraper.save_to_csv(data)
    
    print(f"\nScraping concluído!")
    print(f"Total de tabelas extraídas: {len(data.get('tables', {}))}")
    
    for table_name, table_data in data.get("tables", {}).items():
        print(f"  - {table_name}: {len(table_data)} linhas")


if __name__ == "__main__":
    main()

