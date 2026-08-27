/**
 * ==========================================================================
 * AI-FALLBACK-CORE.JS - Motor casero de respaldo (evaluación + búsqueda)
 * ==========================================================================
 * Única fuente de verdad para el motor "de emergencia" que se usa cuando
 * Stockfish real no está disponible (sin conexión al CDN, worker bloqueado,
 * etc.). Antes esta lógica vivía duplicada en engine.js (hilo principal) y
 * en ai-worker.js (Web Worker) - si se ajustaba una copia y no la otra, la
 * IA "pensaba distinto" según cuál de las dos rutas se usara. Ahora ambos
 * archivos cargan ESTE módulo y llaman a las mismas funciones.
 *
 * Funciona tanto en el hilo principal (window) como dentro de un Worker
 * (self) - no toca el DOM ni nada específico de una de las dos rutas, solo
 * recibe una instancia de Chess (chess.js) ya cargada con la posición.
 */
(function (root) {
    'use strict';

    // Tablas de valores posicionales de piezas (Piece-Square Tables)
    const pst = {
        p: [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [50, 50, 50, 50, 50, 50, 50, 50],
            [10, 10, 20, 30, 30, 20, 10, 10],
            [5, 5, 10, 25, 25, 10, 5, 5],
            [0, 0, 0, 20, 20, 0, 0, 0],
            [5, -5, -10, 0, 0, -10, -5, 5],
            [5, 10, 10, -20, -20, 10, 10, 5],
            [0, 0, 0, 0, 0, 0, 0, 0]
        ],
        n: [
            [-50, -40, -30, -30, -30, -30, -40, -50],
            [-40, -20, 0, 0, 0, 0, -20, -40],
            [-30, 0, 10, 15, 15, 10, 0, -30],
            [-30, 5, 15, 20, 20, 15, 5, -30],
            [-30, 0, 15, 20, 20, 15, 0, -30],
            [-30, 5, 10, 15, 15, 10, 5, -30],
            [-40, -20, 0, 5, 5, 0, -20, -40],
            [-50, -40, -30, -30, -30, -30, -40, -50]
        ],
        b: [
            [-20, -10, -10, -10, -10, -10, -10, -20],
            [-10, 0, 0, 0, 0, 0, 0, -10],
            [-10, 0, 5, 10, 10, 5, 0, -10],
            [-10, 5, 5, 10, 10, 5, 5, -10],
            [-10, 0, 10, 10, 10, 10, 0, -10],
            [-10, 10, 10, 10, 10, 10, 10, -10],
            [-10, 5, 0, 0, 0, 0, 5, -10],
            [-20, -10, -10, -10, -10, -10, -10, -20]
        ],
        r: [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [5, 10, 10, 10, 10, 10, 10, 5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [0, 0, 0, 5, 5, 0, 0, 0]
        ],
        q: [
            [-20, -10, -10, -5, -5, -10, -10, -20],
            [-10, 0, 0, 0, 0, 0, 0, -10],
            [-10, 0, 5, 5, 5, 5, 0, -10],
            [-5, 0, 5, 5, 5, 5, 0, -5],
            [0, 0, 5, 5, 5, 5, 0, -5],
            [-10, 5, 5, 5, 5, 5, 0, -10],
            [-10, 0, 5, 0, 0, 0, 0, -10],
            [-20, -10, -10, -5, -5, -10, -10, -20]
        ],
        k: [
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-20, -30, -30, -40, -40, -30, -30, -20],
            [-10, -20, -20, -20, -20, -20, -20, -10],
            [20, 20, 0, 0, 0, 0, 20, 20],
            [20, 30, 10, 0, 0, 10, 30, 20]
        ]
    };

    const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

    function evaluatePosition(game) {
        let total = 0;
        const b = game.board();
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const p = b[r][f];
                if (p) {
                    const baseVal = pieceValues[p.type];
                    const pstVal = p.color === 'w' ? pst[p.type][r][f] : pst[p.type][7 - r][f];
                    const val = baseVal + pstVal;
                    total += (p.color === 'w') ? val : -val;
                }
            }
        }
        return total;
    }

    // Cuántos plies extra, solo de capturas, se exploran al final de cada
    // rama antes de aceptar la evaluación como definitiva.
    const QUIESCENCE_MAX_PLIES = 4;

    // BÚSQUEDA DE QUIETUD (quiescence search)
    // Al llegar al límite de profundidad, un minimax "seco" evalúa la
    // posición tal cual - aunque justo se acabe de ofrecer una dama gratis
    // que se recapturaría un ply más allá del límite (el clásico "efecto
    // horizonte"). Aquí, en vez de cortar en seco, se sigue explorando
    // SOLO capturas hasta que la posición esté "quieta" (o se agoten los
    // plies de quietud), con su propia poda alfa-beta y "stand pat"
    // (opción de no capturar si ya es la mejor jugada).
    function quiescence(game, alpha, beta, maximizing, qDepth) {
        const standPat = evaluatePosition(game);
        if (qDepth <= 0) return standPat;

        if (maximizing) {
            if (standPat >= beta) return standPat;
            if (standPat > alpha) alpha = standPat;
        } else {
            if (standPat <= alpha) return standPat;
            if (standPat < beta) beta = standPat;
        }

        const captures = game.moves({ verbose: true }).filter(m => m.captured);
        for (const m of captures) {
            game.move(m);
            const ev = quiescence(game, alpha, beta, !maximizing, qDepth - 1);
            game.undo();

            if (maximizing) {
                if (ev > alpha) alpha = ev;
                if (alpha >= beta) break;
            } else {
                if (ev < beta) beta = ev;
                if (beta <= alpha) break;
            }
        }

        return maximizing ? alpha : beta;
    }

    // MINIMAX CON PODA ALFA-BETA (con quietud al llegar al horizonte)
    function minimax(game, depth, alpha, beta, maximizing) {
        if (game.game_over()) return evaluatePosition(game);
        if (depth === 0) return quiescence(game, alpha, beta, maximizing, QUIESCENCE_MAX_PLIES);

        const moves = game.moves({ verbose: true });
        if (maximizing) {
            let maxEval = -Infinity;
            for (const m of moves) {
                game.move(m);
                const ev = minimax(game, depth - 1, alpha, beta, false);
                game.undo();
                maxEval = Math.max(maxEval, ev);
                alpha = Math.max(alpha, ev);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const m of moves) {
                game.move(m);
                const ev = minimax(game, depth - 1, alpha, beta, true);
                game.undo();
                minEval = Math.min(minEval, ev);
                beta = Math.min(beta, ev);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    // Traduce el rating (0-100) del Modo Adaptación en fuerza real:
    // profundidad máxima, presupuesto de tiempo y probabilidad de "error a
    // propósito", todo creciendo con el rating.
    function getAdaptiveStrength(rating) {
        const maxDepth = rating < 34 ? 2 : (rating < 67 ? 3 : 4);
        const blunderChance = Math.max(0.03, 0.45 - (rating / 100) * 0.42);
        const timeBudgetMs = Math.round(250 + (rating / 100) * 900);
        return { maxDepth, blunderChance, timeBudgetMs };
    }

    // PROFUNDIZACIÓN ITERATIVA: en vez de calcular a una profundidad fija
    // (que en un equipo lento puede tardar de más, y en uno rápido
    // desperdicia margen), busca a profundidad 1, luego 2, luego 3... y se
    // queda con la mejor jugada de la última iteración COMPLETA antes de
    // que se agote el presupuesto de tiempo. Como esto corre dentro de su
    // propio Worker, nunca bloquea la interfaz - como mucho tarda un poco
    // más en responder.
    function searchBestMove(game, maxDepth, timeBudgetMs) {
        const moves = game.moves({ verbose: true });
        if (moves.length === 0) return null;

        // Barajar para que no juegue siempre igual ante valores idénticos
        moves.sort(() => Math.random() - 0.5);

        const isWhite = game.turn() === 'w';
        const deadline = Date.now() + timeBudgetMs;
        let bestMove = moves[0];

        for (let depth = 1; depth <= maxDepth; depth++) {
            let iterBest = null;
            let iterBestValue = isWhite ? -Infinity : Infinity;

            for (const m of moves) {
                game.move(m);
                const val = minimax(game, depth - 1, -Infinity, Infinity, !isWhite);
                game.undo();

                if (isWhite ? (val > iterBestValue) : (val < iterBestValue)) {
                    iterBestValue = val;
                    iterBest = m;
                }
            }

            if (iterBest) bestMove = iterBest;
            if (Date.now() >= deadline) break;
        }

        return bestMove;
    }

    // Punto de entrada único: recibe una posición YA cargada en `game`
    // (una instancia de Chess) y decide la jugada según la dificultad.
    function findBestMoveForGame(game, aiDifficulty, adaptiveRating) {
        const moves = game.moves({ verbose: true });
        if (moves.length === 0) return null;

        // Modo Fácil: jugadas aleatorias o capturas directas a propósito -
        // incluso la búsqueda más floja ya no se siente "fácil".
        if (aiDifficulty === 'easy') {
            const captures = moves.filter(m => m.captured);
            if (captures.length > 0 && Math.random() < 0.7) {
                return captures[Math.floor(Math.random() * captures.length)];
            }
            return moves[Math.floor(Math.random() * moves.length)];
        }

        let maxDepth, timeBudgetMs;
        if (aiDifficulty === 'adaptive') {
            const strength = getAdaptiveStrength(adaptiveRating);
            if (Math.random() < strength.blunderChance) {
                return moves[Math.floor(Math.random() * moves.length)];
            }
            maxDepth = strength.maxDepth;
            timeBudgetMs = strength.timeBudgetMs;
        } else {
            maxDepth = (aiDifficulty === 'hard') ? 4 : 3;
            timeBudgetMs = (aiDifficulty === 'hard') ? 1800 : 900;
        }

        return searchBestMove(game, maxDepth, timeBudgetMs) || moves[0];
    }

    const ChessAIFallback = {
        pst,
        pieceValues,
        evaluatePosition,
        quiescence,
        minimax,
        getAdaptiveStrength,
        searchBestMove,
        findBestMoveForGame
    };

    root.ChessAIFallback = ChessAIFallback;
})(typeof self !== 'undefined' ? self : this);
