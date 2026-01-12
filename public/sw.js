// Service Worker para GoalScan Pro
const CACHE_VERSION = 'v2';
const CACHE_NAME = `goalscan-pro-${CACHE_VERSION}`;
const RUNTIME_CACHE = 'goalscan-pro-runtime';
const STATIC_CACHE = 'goalscan-pro-static';

// Assets estáticos para cachear na instalação
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon.svg',
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Cacheando assets estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((error) => {
        console.error('Service Worker: Erro ao fazer cache', error);
      })
  );
  // Forçar ativação imediata
  self.skipWaiting();
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Remover caches antigos que não correspondem à versão atual
          if (
            cacheName !== STATIC_CACHE &&
            cacheName !== RUNTIME_CACHE &&
            cacheName.startsWith('goalscan-pro-')
          ) {
            console.log('Service Worker: Removendo cache antigo', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Assumir controle imediato de todas as páginas
  return self.clients.claim();
});

// Listener de mensagens para evitar erros de extensões
self.addEventListener('message', (event) => {
  // Responder imediatamente para evitar "message channel closed"
  try {
    if (event.data && typeof event.data === 'object') {
      // Responder com confirmação se houver port
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    }
  } catch (error) {
    // Silenciar erros de mensagens de extensões
  }
  // Para mensagens sem port, não fazer nada (evita erro)
});

// Estratégia de cache baseada no tipo de recurso
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  let url;
  try {
    url = new URL(request.url);
  } catch (urlError) {
    // Se houver erro ao processar URL, não interceptar a requisição
    return;
  }

  // Ignorar requisições que não podem ser cacheadas ou não devem ser interceptadas
  if (
    request.method !== 'GET' ||
    url.protocol === 'chrome-extension:' ||
    url.protocol === 'chrome:' ||
    url.protocol === 'moz-extension:' ||
    url.protocol === 'safari-extension:' ||
    url.protocol === 'ms-browser-extension:' ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname.includes('vercel.app') ||
    url.hostname.includes('vercel.com') ||
    url.hostname.includes('github.com') ||
    url.hostname.includes('githubusercontent.com') ||
    url.hostname.includes('google-analytics.com') ||
    url.hostname.includes('googletagmanager.com') ||
    url.hostname.includes('doubleclick.net') ||
    url.hostname.includes('facebook.com') ||
    url.hostname.includes('twitter.com') ||
    url.hostname.includes('linkedin.com') ||
    url.pathname.includes('_next') ||
    url.pathname.includes('__webpack') ||
    url.pathname.includes('hot-update')
  ) {
    // Não interceptar essas requisições - deixar o navegador lidar com elas
    return;
  }

  // APIs externas: Network Only (não cachear) - com tratamento de erro silencioso
  // Para Supabase: verificar cache de status do serviço antes de fazer requisição
  if (url.hostname.includes('supabase.co')) {
    // Verificar se o serviço está marcado como indisponível no cache
    // O cache é compartilhado via IndexedDB/localStorage, mas no Service Worker
    // precisamos usar uma estratégia diferente
    event.respondWith(
      (async () => {
        try {
          // Tentar fazer a requisição normalmente
          const response = await fetch(request);
          
          // Se a resposta for 503, marcar serviço como indisponível
          if (response.status === 503) {
            // Retornar resposta 503 silenciosamente (sem log no console)
            return new Response('', { 
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          return response;
        } catch (error) {
          // Silenciar erros de fetch para Supabase - retornar resposta vazia
          // sem logar no console
          return new Response('', { 
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })()
    );
    return;
  }
  
  // Outras APIs externas
  if (url.hostname.includes('cdn.') || url.hostname.includes('api.')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Silenciar erros de fetch para APIs externas - retornar resposta vazia
          return new Response('', { 
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // HTML: Network First, fallback para Cache
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cachear resposta válida
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches
              .open(RUNTIME_CACHE)
              .then((cache) => cache.put(request, responseToCache))
              .catch(() => {
                // Silenciar erros de cache
              });
          }
          return response;
        })
        .catch(() => {
          // Fallback para cache ou index.html
          return caches
            .match(request)
            .then((cachedResponse) => {
              return cachedResponse || caches.match('/index.html');
            })
            .catch(() => {
              // Se tudo falhar, retornar resposta vazia silenciosamente
              return new Response('', { 
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/html' }
              });
            });
        })
    );
    return;
  }

  // Assets estáticos (JS, CSS, imagens): Cache First, fallback para Network
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      caches
        .match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se não estiver no cache, buscar da rede e cachear
          return fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                const cacheToUse =
                  url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')
                    ? STATIC_CACHE
                    : RUNTIME_CACHE;
                caches
                  .open(cacheToUse)
                  .then((cache) => cache.put(request, responseToCache))
                  .catch(() => {
                    // Silenciar erros de cache
                  });
              }
              return response;
            })
            .catch(() => {
              // Se fetch falhar, retornar resposta vazia silenciosamente
              if (request.destination === 'image') {
                return new Response('', { 
                  status: 404,
                  statusText: 'Not Found',
                  headers: { 'Content-Type': 'image/png' }
                });
              }
              return new Response('', { 
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' }
              });
            });
        })
        .catch(() => {
          // Se cache.match falhar, retornar resposta vazia silenciosamente
          if (request.destination === 'image') {
            return new Response('', { 
              status: 404,
              statusText: 'Not Found',
              headers: { 'Content-Type': 'image/png' }
            });
          }
          return new Response('', { 
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // Outros recursos: Network First
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches
            .open(RUNTIME_CACHE)
            .then((cache) => cache.put(request, responseToCache))
            .catch(() => {
              // Silenciar erros de cache
            });
        }
        return response;
      })
      .catch(() => {
        return caches
          .match(request)
          .then((cachedResponse) => {
            return cachedResponse || new Response('', { 
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            });
          })
          .catch(() => {
            // Silenciar erros finais para evitar poluição no console
            return new Response('', { 
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
      .catch(() => {
        // Último fallback - silenciar completamente
        return new Response('', { 
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});
