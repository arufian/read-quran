// Service Worker for Quran Translation App
// Caches Surah data and serves from cache when available

const CACHE_NAME = 'quran-app-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/css/animations.css',
    '/js/app.js'
];

// API endpoints to cache
const SURAH_LIST_URL = 'https://api.quran.com/api/v4/chapters';
const TRANSLATION_BASE_URL = 'https://api.quran.com/api/v4/quran/translations/';

// Translation IDs
const TRANSLATION_IDS = {
    en: 85,   // Saheeh International
    id: 33,   // Indonesian Ministry of Religious Affairs
    ja: 218   // Saeed Sato
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        }).catch((err) => {
            console.error('[SW] Failed to cache static assets:', err);
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Handle API requests
    if (url.hostname === 'api.quran.com') {
        // Surah list endpoint
        if (url.pathname === '/api/v4/chapters') {
            event.respondWith(handleSurahListRequest(request));
            return;
        }

        // Translation endpoints
        if (url.pathname.startsWith('/api/v4/quran/translations/')) {
            event.respondWith(handleTranslationRequest(request, url));
            return;
        }
    }

    // Handle static assets with cache-first strategy
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // Return cached response and update cache in background
                fetch(request).then((networkResponse) => {
                    if (networkResponse.ok) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, networkResponse.clone());
                        });
                    }
                }).catch(() => {
                    // Network failed, but we have cached response
                });
                return cachedResponse;
            }

            // Not in cache, fetch from network
            return fetch(request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200) {
                    return networkResponse;
                }

                // Cache the new response
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseToCache);
                });

                return networkResponse;
            });
        }).catch(() => {
            // Network failed and not in cache
            console.error('[SW] Network failed and not in cache:', request.url);
            return new Response('Network error', { status: 503 });
        })
    );
});

// Handle Surah list requests
async function handleSurahListRequest(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        // Return cached and update in background
        fetch(request).then((networkResponse) => {
            if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
            }
        }).catch(() => {});
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('[SW] Failed to fetch Surah list:', error);
        return new Response(JSON.stringify({ error: 'Offline and not cached' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Handle translation requests
async function handleTranslationRequest(request, url) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        // Return cached and update in background
        fetch(request).then((networkResponse) => {
            if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
            }
        }).catch(() => {});
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('[SW] Failed to fetch translation:', error);
        return new Response(JSON.stringify({ error: 'Offline and not cached' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Background sync for pre-caching all Surah data
self.addEventListener('message', (event) => {
    if (event.data === 'precache-all-surahs') {
        console.log('[SW] Starting background pre-caching of all Surahs...');
        precacheAllSurahs();
    }
});

// Pre-cache all Surah translations in the background
async function precacheAllSurahs() {
    const cache = await caches.open(CACHE_NAME);

    // First get the Surah list
    let surahs = [];
    try {
        const response = await fetch(SURAH_LIST_URL);
        const data = await response.json();
        surahs = data.chapters || [];

        // Cache the Surah list
        await cache.put(SURAH_LIST_URL, response.clone());
        console.log('[SW] Cached Surah list');
    } catch (error) {
        console.error('[SW] Failed to fetch/cache Surah list:', error);
        return;
    }

    // Pre-cache translations for each Surah in all languages
    const translationsToCache = [];
    for (const surah of surahs) {
        for (const [lang, translationId] of Object.entries(TRANSLATION_IDS)) {
            const url = `${TRANSLATION_BASE_URL}${translationId}?chapter_number=${surah.id}`;
            translationsToCache.push({ url, surahId: surah.id, lang });
        }
    }

    console.log(`[SW] Pre-caching ${translationsToCache.length} translation requests...`);

    // Cache in batches to avoid overwhelming the network
    const batchSize = 5;
    for (let i = 0; i < translationsToCache.length; i += batchSize) {
        const batch = translationsToCache.slice(i, i + batchSize);
        await Promise.all(
            batch.map(async ({ url, surahId, lang }) => {
                try {
                    const cached = await cache.match(url);
                    if (cached) {
                        console.log(`[SW] Already cached: Surah ${surahId} (${lang})`);
                        return;
                    }

                    const response = await fetch(url);
                    if (response.ok) {
                        await cache.put(url, response.clone());
                        console.log(`[SW] Cached: Surah ${surahId} (${lang})`);
                    }
                } catch (error) {
                    console.error(`[SW] Failed to cache Surah ${surahId} (${lang}):`, error);
                }
            })
        );

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('[SW] Pre-caching complete!');
}

// Check if all Surahs are cached
async function checkCacheStatus() {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const surahTranslations = keys.filter(req => req.url.includes('/quran/translations/'));
    console.log(`[SW] Cached ${surahTranslations.length} translation requests`);
    return surahTranslations.length;
}
