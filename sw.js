/* =============================================
   FASO TEEDO - SERVICE WORKER DÉSACTIVÉ
   Mode développement - Ne stocke rien en cache
   ============================================= */

console.log('⚠️ Service Worker désactivé - Mode développement');

// ✅ Ne rien mettre en cache
// ✅ Ne pas intercepter les requêtes
// ✅ Se désenregistrer automatiquement

self.addEventListener('install', function(event) {
    console.log('📴 SW installation - Désactivation immédiate');
    event.waitUntil(
        Promise.resolve()
            .then(function() {
                return self.registration.unregister();
            })
            .then(function() {
                console.log('✅ Service Worker désenregistré');
                return self.skipWaiting();
            })
    );
});

self.addEventListener('activate', function(event) {
    console.log('📴 SW activation - Nettoyage des caches');
    event.waitUntil(
        caches.keys()
            .then(function(cacheNames) {
                return Promise.all(
                    cacheNames.map(function(cacheName) {
                        console.log('🗑️ Suppression du cache:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            })
            .then(function() {
                console.log('✅ Tous les caches supprimés');
                return self.clients.claim();
            })
    );
});

// ✅ Ne pas intercepter les requêtes - toujours aller sur le réseau
self.addEventListener('fetch', function(event) {
    event.respondWith(fetch(event.request));
});

self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'UNREGISTER') {
        self.registration.unregister()
            .then(function(success) {
                console.log('📴 Service Worker désenregistré sur demande');
            });
    }
});

console.log('✅ Service Worker désactivé - Toutes les requêtes vont au réseau');
