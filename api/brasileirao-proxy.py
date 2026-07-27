"""
Proxy para buscar HTML da página de classificação do Brasileirão no ge.globo.com
Usado pela lib campeonato-brasileiro-api para extrair a tabela.
"""
import json
from http.server import BaseHTTPRequestHandler
from typing import Dict

try:
    import requests
except ImportError:
    pass


class BrasileiraoProxy:
    BASE_URL = 'https://ge.globo.com/futebol/brasileirao-serie-a/'

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://ge.globo.com/',
        })

    def fetch_html(self) -> str:
        resp = self.session.get(self.BASE_URL, timeout=30)
        resp.raise_for_status()
        return resp.text


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        try:
            proxy = BrasileiraoProxy()
            html = proxy.fetch_html()

            self._send_response({
                'success': True,
                'html': html,
            })
        except Exception as e:
            self._send_error(500, f'Erro ao buscar página do ge.globo: {str(e)}')

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
