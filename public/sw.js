// Versionsnummer v4 erzwingt einen Reset auf den Handys!
const CACHE_NAME = 'dusgame-cache-v4';

// Liste der Dateien, die sofort auf dem Handy gespeichert werden sollen
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/player.html',
    '/scan.html',
    '/info.html',
    '/player.css',
    '/player.js',
    '/scan.js',
    '/manifest.json',
    // 🎵 Audio-Dateien
    '/audio/success.mp3',
    '/audio/clump.mp3',
    '/audio/uium.mp3',
    '/audio/dudim.mp3',
    '/audio/crecers.mp3'
];

self.addEventListener('install', (e) => {
    self.skipWaiting(); // Zwingt den neuen Worker, sofort aktiv zu werden
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("[Service Worker] Caching Assets inkl. Audio");
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log("[Service Worker] Lösche alten, überfüllten Cache");
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const url = e.request.url;

    // 1. API-Calls & WebSockets ignorieren (Echtzeitdaten)
    if (url.includes('/api/') || url.includes('socket.io') || e.request.method !== 'GET') {
        return; // Direkt zum Server durchlassen
    }

    // 🚨 2. DER TRAFFIC-SAVER: Externe Dateien IGNORIEREN! 🚨
    // Keine Map-Tiles (Karten-Bilder) oder externe Fonts in unseren Cache lassen,
    // da diese sonst den Handyspeicher sprengen und einen Cache-Reset erzwingen.
    if (!url.startsWith(self.location.origin)) {
        return; // Leitet die Karten-Bilder normal ans Netz weiter
    }

    // 3. Eigene Website-Dateien cachen
    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            // Wenn es im Cache ist, gib es SOFORT zurück (0 Byte Traffic!)
            if (cachedResponse) {
                return cachedResponse;
            }
            
            // Falls nicht, lade es vom Server und speichere es ab
            return fetch(e.request).then((fetchResponse) => {
                // Nur erfolgreiche Ladevorgänge (200 OK) cachen, keine 404 Fehler
                if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
                    return fetchResponse;
                }

                let responseToCache = fetchResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(e.request, responseToCache);
                });

                return fetchResponse;
            }).catch(() => {
                console.log("[Service Worker] Offline und Datei fehlt.");
            });
        })
    );
});