"""
Leve proxy que retorna o HTML bruto do FBref para parse client-side (DOMParser).
Roda como Vercel Serverless Function.
"""
import json
import random
import time
from http.server import BaseHTTPRequestHandler
from urllib.parse import urljoin

try:
    import requests
except ImportError:
    pass


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
            data = json.loads(body.decode('utf-8'))
            url = data.get('url', '')

            if not url or 'fbref.com' not in url:
                self._send_error(400, 'URL inválida. Apenas URLs do fbref.com são permitidas.')
                return

            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'max-age=0',
            }

            last_error = None
            for attempt in range(3):
                if attempt > 0:
                    delay = (2 ** attempt) + random.uniform(0.5, 1.5)
                    time.sleep(delay)

                try:
                    resp = requests.get(url, headers=headers, timeout=30, allow_redirects=True)

                    if resp.status_code == 403:
                        last_error = '403: Acesso negado pelo FBref'
                        headers['Referer'] = 'https://fbref.com/'
                        continue

                    if resp.status_code >= 400:
                        last_error = f'HTTP {resp.status_code}'
                        continue

                    if resp.encoding is None or resp.encoding == 'ISO-8859-1':
                        resp.encoding = 'utf-8'

                    html = resp.text

                    if len(html) < 10000:
                        last_error = f'Resposta muito curta ({len(html)} bytes)'
                        continue

                    if 'stats_table' not in html and 'id="results' not in html:
                        last_error = 'HTML sem tabelas de estatísticas'
                        continue

                    self._send_response({'html': html})
                    return

                except requests.exceptions.Timeout:
                    last_error = 'Timeout'
                except requests.exceptions.ConnectionError:
                    last_error = 'Erro de conexão'

            self._send_error(502, f'Falha ao acessar FBref: {last_error}')

        except json.JSONDecodeError:
            self._send_error(400, 'JSON inválido')
        except Exception as e:
            self._send_error(500, f'Erro interno: {str(e)}')

    def _send_response(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def _send_error(self, status_code, message):
        self._send_response({'error': message}, status_code)

    def log_message(self, format, *args):
        pass
