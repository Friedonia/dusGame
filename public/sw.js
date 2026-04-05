// Simpler Service Worker für PWA-Installierbarkeit
self.addEventListener('install', (e) => {
    self.skipWaiting();
});
self.addEventListener('fetch', (e) => {
    // Lässt alle Anfragen normal durch, macht die App aber installierbar
});