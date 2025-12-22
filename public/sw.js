// Service Worker para GoalScan Pro
const CACHE_NAME = 'goalscan-pro-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker: Erro ao fazer cache', error);
      })
  );
  self.skipWaiting();
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Removendo cache antigo', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Estratégia: Network First, fallback para Cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições que não podem ser cacheadas
  if (
    request.method !== 'GET' ||
    url.protocol === 'chrome-extension:' ||
    url.protocol === 'chrome:' ||
    url.protocol === 'moz-extension:' ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1'
  ) {
    // Apenas fazer fetch sem cachear
    event.respondWith(fetch(request));
    return;
  }

  // Ignorar requisições para APIs externas (Supabase, etc.)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('cdn.')) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Só cachear respostas válidas e GET
        if (response && response.status === 200 && request.method === 'GET') {
          // Verificar se é uma resposta que pode ser clonada
          if (response.type === 'basic' || response.type === 'cors') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                try {
                  cache.put(request, responseToCache);
                } catch (error) {
                  // Ignorar erros de cache silenciosamente
                  console.warn('Service Worker: Erro ao cachear', error);
                }
              })
              .catch(() => {
                // Ignorar erros de cache
              });
          }
        }
        return response;
      })
      .catch(() => {
        // Se falhar, tentar buscar do cache
        return caches.match(request)
          .then((response) => {
            if (response) {
              return response;
            }
            // Se não encontrar no cache, retornar página offline
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }
            // Para outros recursos, retornar erro
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

