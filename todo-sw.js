const CACHE_NAME = 'todo-cache-v2';
const ASSETS_TO_CACHE = [
    './todolist.html'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    
    const url = event.request.url;

    // Skip caching for Supabase API or other non-GET requests
    if (url.includes('supabase.co')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                // Cache valid responses (including opaque responses for CDNs/fonts)
                if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                    const clonedRes = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clonedRes);
                    });
                }
                return networkResponse;
            }).catch(err => {
                console.warn('Network fetch failed, serving from cache if available:', err);
            });

            // Return cached response immediately if available (stale-while-revalidate), else wait for network
            return cachedResponse || fetchPromise.then(res => {
                if (!res) throw new Error('Offline and not in cache');
                return res;
            });
        }).catch(() => {
            // Fallback for navigation requests if offline and not in cache
            if (event.request.mode === 'navigate' || url.includes('todolist.html')) {
                return caches.match('./todolist.html');
            }
            return new Response('Network error happened', { status: 408, headers: { 'Content-Type': 'text/plain' } });
        })
    );
});
