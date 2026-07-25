"""
Leve proxy que retorna o HTML bruto do FBref para parse client-side (DOMParser).
Usa headers anti-detecção idênticos ao fbref-extract.py para evitar 403.
Roda como Vercel Serverless Function.
"""
import json
import random
import time
from http.server import BaseHTTPRequestHandler

try:
    import requests
except ImportError:
    pass

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
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
    'Viewport-Width': '1920',
    'Width': '1920',
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
            data = json.loads(body.decode('utf-8'))
            url = data.get('url', '')

            if not url or 'fbref.com' not in url:
                self._send_error(400, 'URL inválida. Apenas URLs do fbref.com são permitidas.')
                return

            session = requests.Session()
            session.headers.update(HEADERS)
            last_error = None

            for attempt in range(3):
                try:
                    if attempt > 0:
                        delay = (2 ** attempt) + random.uniform(0.5, 1.5)
                        time.sleep(delay)
                    else:
                        time.sleep(random.uniform(1.0, 2.0))

                    resp = session.get(url, timeout=45, allow_redirects=True)

                    if resp.status_code == 403:
                        last_error = '403: Acesso negado pelo FBref'
                        session.headers['Referer'] = 'https://fbref.com/'
                        continue

                    if resp.status_code >= 400:
                        last_error = f'HTTP {resp.status_code}: {resp.reason}'
                        continue

                    if resp.encoding is None or resp.encoding == 'ISO-8859-1':
                        resp.encoding = 'utf-8'

                    html = resp.text

                    if len(html) < 10000:
                        last_error = f'Resposta curta ({len(html)} bytes)'
                        continue

                    if 'stats_table' not in html and 'id="results' not in html:
                        last_error = 'HTML sem tabelas de estatísticas'
                        continue

                    self._send_response({'html': html})
                    return

                except requests.exceptions.Timeout:
                    last_error = 'Timeout (45s)'
                except requests.exceptions.ConnectionError:
                    last_error = 'Erro de conexão'
                except requests.exceptions.RequestException as e:
                    last_error = str(e)

            self._send_error(502, f'Falha ao acessar FBref após 3 tentativas: {last_error}')

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
