/**
 * ==========================================================================
 * STOCKFISH-WORKER.JS - Envoltorio del motor Stockfish real (Web Worker)
 * ==========================================================================
 * Este archivo es intencionalmente casi vacío: Stockfish.js ya está pensado
 * para ser TODO el contenido de su propio Worker (define su propio
 * self.onmessage y habla el protocolo UCI directo por postMessage). No se
 * puede crear `new Worker(urlDelCDN)` directo por seguridad del navegador
 * (bloquea workers de otro origen aunque el CDN mande CORS), así que este
 * archivo -que sí vive en nuestro propio origen- lo carga con importScripts.
 *
 * Se auto-aloja en assets/vendor/ (en vez de tirar del CDN en caliente) para
 * que la app funcione sin conexión una vez instalada como PWA - ver
 * assets/vendor/README.md.
 */
importScripts('../assets/vendor/stockfish.min.js');
