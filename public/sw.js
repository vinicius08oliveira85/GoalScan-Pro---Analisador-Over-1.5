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

// Estratégia de cache baseada no tipo de recurso
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
    event.respondWith(fetch(request));
    return;
  }

  // APIs externas: Network Only (não cachear)
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('cdn.') ||
    url.hostname.includes('api.')
  ) {
    event.respondWith(
      fetch(request).catch(() => {
        // Silenciar erros de fetch para APIs externas
        return new Response('', { status: 503 });
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
              .catch(() => {});
          }
          return response;
        })
        .catch(() => {
          // Fallback para cache ou index.html
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/index.html');
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
          return fetch(request).then((response) => {
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              const cacheToUse =
                url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')
                  ? STATIC_CACHE
                  : RUNTIME_CACHE;
              caches
                .open(cacheToUse)
                .then((cache) => cache.put(request, responseToCache))
                .catch(() => {});
            }
            return response;
          });
        })
        .catch(() => {
          // Se tudo falhar, retornar resposta offline
          if (request.destination === 'image') {
            return new Response('', { status: 404 });
          }
          return new Response('Offline', { status: 503 });
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
            .catch(() => {});
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          return cachedResponse || new Response('Offline', { status: 503 });
        });
      })
      .catch(() => {
        // Silenciar erros finais para evitar poluição no console
        return new Response('', { status: 503 });
      })
  );
});
