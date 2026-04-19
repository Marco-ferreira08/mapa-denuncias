const CACHE_NAME = 'mapa-denuncias-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/style.css',
    '/dashboard.css',
    '/app.js',
    '/dashboard.js',
    '/indexeddb.js',
    '/canvas-chart.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// =========================================
// Instalação do Service Worker
// =========================================
self.addEventListener('install', (event) => {
    // Força o SW a se tornar ativo imediatamente
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] Fazendo pre-caching dos assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// =========================================
// Ativação e Limpeza de caches antigos
// =========================================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[ServiceWorker] Removendo cache antigo', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    // Controla os clientes imediatamente após ativar
    return self.clients.claim();
});

// =========================================
// Interceptação de Requisições (Network First, fallback to Cache)
// =========================================
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Estratégia para requisições na nossa API (FastAPI) - Network Only ou Background Sync
    if (url.origin.includes('localhost:8000') || url.origin.includes('supabase.co')) {
        // Para chamadas de API, tentar a rede primeiro.
        // O ideal é não fazer cache agressivo de POST/GET dinâmico aqui,
        // mas sim usar nosso IndexedDB no frontend.
        event.respondWith(fetch(event.request).catch((err) => {
            console.warn('[ServiceWorker] Falha de rede para API:', err);
            // Retorna um erro controlável para o front-end tratar.
            return new Response(JSON.stringify({ error: "offline" }), {
                headers: { 'Content-Type': 'application/json' },
                status: 503
            });
        }));
        return;
    }

    // Estratégia para Assets Estáticos (Stale-While-Revalidate)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Atualiza o cache sempre que a rede responder
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Se a rede falhar, simplesmente resolve falhando silenciosamente para usar o cache
                console.log('[ServiceWorker] Offline, usando cache local para:', event.request.url);
            });

            // Retorna o cache IMEDIATAMENTE se existir, enquanto a rede atualiza no fundo
            return cachedResponse || fetchPromise;
        })
    );
});

// =========================================
// Sincronização em Background (Se suportado pelo navegador)
// =========================================
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-denuncias') {
        console.log('[ServiceWorker] Sync ativado! Tentando enviar dados pendentes...');
        // Em um app completo, chamamos uma função do IndexedDB aqui
        // para ler denúncias pendentes e enviá-las ao servidor.
    }
});
