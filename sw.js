/**
 * ==========================================================================
 * SW.JS - Service Worker: cachea el "app shell" para que Ajedrez 3D funcione
 * instalado y sin conexión.
 * ==========================================================================
 * Estrategia: cache-first para todo lo del propio origen. En la instalación
 * se precachea el juego completo (HTML, CSS, JS, librerías auto-alojadas en
 * assets/vendor/ e iconos) para que, una vez visitado una vez con red, deje
 * de necesitarla. Cualquier petición nueva al mismo origen que no estuviera
 * precacheada se cachea también al vuelo la primera vez que se pide.
 *
 * Las fuentes de Google Fonts (otro origen) NO se interceptan aquí: siguen
 * la red normal del navegador y su propia caché HTTP - si fallan, el CSS ya
 * tiene una familia de respaldo (serif/sans-serif), así que solo se pierde
 * la tipografía, nunca la funcionalidad.
 *
 * IMPORTANTE: si se añade o renombra algún archivo del proyecto, hay que
 * reflejarlo en APP_SHELL. Y si se hace un cambio que deba forzar a los
 * usuarios ya instalados a bajar la versión nueva, hay que subir
 * CACHE_VERSION - si no, seguirán viendo la caché vieja indefinidamente.
 */

const CACHE_VERSION = 'ajedrez3d-v6';

const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './css/main.css',
    './css/board-ui.css',
    './css/learning.css',
    './css/modal.css',
    './css/online.css',
    './js/audio.js',
    './js/board.js',
    './js/effects.js',
    './js/ai-fallback-core.js',
    './js/engine.js',
    './js/learning.js',
    './js/ui.js',
    './js/main.js',
    './js/multiplayer.js',
    './js/ai-worker.js',
    './js/stockfish-worker.js',
    './assets/vendor/three.min.js',
    './assets/vendor/OrbitControls.js',
    './assets/vendor/tween.umd.js',
    './assets/vendor/chess.min.js',
    './assets/vendor/stockfish.min.js',
    './assets/vendor/firebase/firebase-app.js',
    './assets/vendor/firebase/firebase-auth.js',
    './assets/vendor/firebase/firebase-firestore.js',
    './assets/card_ai.svg',
    './assets/card_pvp.svg',
    './assets/card_academy.svg',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './assets/icons/icon-512-maskable.png',
    './assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    // Solo interceptamos peticiones a nuestro propio origen; lo externo
    // (Google Fonts) sigue el camino normal del navegador.
    if (new URL(req.url).origin !== self.location.origin) return;

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;

            return fetch(req).then((res) => {
                // Solo cacheamos respuestas válidas (evita guardar 404s/errores)
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
                }
                return res;
            }).catch(() => cached); // sin red y sin caché: deja que la petición falle
        })
    );
});
