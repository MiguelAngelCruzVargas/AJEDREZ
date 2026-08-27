/**
 * ==========================================================================
 * AI-WORKER.JS - Cálculo de la jugada de la IA en un hilo aparte (Web Worker)
 * ==========================================================================
 * El motor casero (minimax + poda alfa-beta + quietud) puede tardar 1-2
 * segundos en una PC normal, y bastante más en un celular de gama baja. Si
 * ese cálculo corre en el hilo principal (como antes), TODA la pantalla se
 * congela mientras piensa: no se anima nada, no responde el tacto, y en
 * equipos lentos se siente "trabado".
 *
 * Este worker recibe la posición (FEN) y la dificultad, calcula la mejor
 * jugada de forma síncrona pero DENTRO de su propio hilo, y devuelve el
 * resultado por mensaje - el hilo principal (y la interfaz) nunca se
 * bloquea, sin importar cuánto tarde el cálculo.
 *
 * La lógica de evaluación/búsqueda en sí vive en ai-fallback-core.js,
 * compartida con el respaldo síncrono de engine.js, para que la IA piense
 * igual en las dos rutas (ver el comentario de ese archivo).
 */

importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');
importScripts('ai-fallback-core.js');

self.onmessage = function(e) {
    const { requestId, fen, aiDifficulty, adaptiveRating } = e.data;
    try {
        const game = new Chess(fen);
        const move = ChessAIFallback.findBestMoveForGame(game, aiDifficulty, adaptiveRating);
        self.postMessage({ requestId, move });
    } catch (err) {
        self.postMessage({ requestId, move: null, error: String(err && err.message || err) });
    }
};
