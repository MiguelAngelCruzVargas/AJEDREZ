/**
 * ==========================================================================
 * STOCKFISH-WORKER.JS - Envoltorio del motor Stockfish real (Web Worker)
 * ==========================================================================
 * Este archivo es intencionalmente casi vacío: Stockfish.js ya está pensado
 * para ser TODO el contenido de su propio Worker (define su propio
 * self.onmessage y habla el protocolo UCI directo por postMessage). No se
 * puede crear `new Worker(urlDelCDN)` directo por seguridad del navegador
 * (bloquea workers de otro origen aunque el CDN mande CORS), así que este
 * archivo -que sí vive en nuestro propio origen- lo carga con importScripts,
 * que no tiene esa restricción.
 */
importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.min.js');
