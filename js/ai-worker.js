/**
 * ==========================================================================
 * AI-WORKER.JS - Cálculo de la jugada de la IA en un hilo aparte (Web Worker)
 * ==========================================================================
 * El minimax con poda alfa-beta puede tardar 1-2 segundos en una PC normal,
 * y bastante más en un celular de gama baja. Si ese cálculo corre en el hilo
 * principal (como antes), TODA la pantalla se congela mientras piensa: no se
 * anima nada, no responde el tacto, y en equipos lentos se siente "trabado".
 *
 * Este worker recibe la posición (FEN) y la dificultad, calcula la mejor
 * jugada de forma síncrona pero DENTRO de su propio hilo, y devuelve el
 * resultado por mensaje - el hilo principal (y la interfaz) nunca se bloquea,
 * sin importar cuánto tarde el cálculo.
 *
 * Nota: las tablas de valores (pst, pieceValues) y la lógica de evaluación
 * son una copia deliberada de las de engine.js. Si se ajustan ahí, hay que
 * reflejar el mismo cambio aquí para que la IA piense igual en ambos lados.
 */

importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');

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

function minimax(game, depth, alpha, beta, maximizing) {
    if (depth === 0 || game.game_over()) {
        return evaluatePosition(game);
    }
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

function getAdaptiveStrength(rating) {
    const depth = rating < 34 ? 1 : (rating < 67 ? 2 : 3);
    const blunderChance = Math.max(0.03, 0.45 - (rating / 100) * 0.42);
    return { depth, blunderChance };
}

function findBestMove(fen, aiDifficulty, adaptiveRating) {
    const game = new Chess(fen);
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    if (aiDifficulty === 'easy') {
        const captures = moves.filter(m => m.captured);
        if (captures.length > 0 && Math.random() < 0.7) {
            return captures[Math.floor(Math.random() * captures.length)];
        }
        return moves[Math.floor(Math.random() * moves.length)];
    }

    let depth;
    if (aiDifficulty === 'adaptive') {
        const strength = getAdaptiveStrength(adaptiveRating);
        if (Math.random() < strength.blunderChance) {
            return moves[Math.floor(Math.random() * moves.length)];
        }
        depth = strength.depth;
    } else {
        depth = (aiDifficulty === 'hard') ? 3 : 2;
    }

    const isWhite = game.turn() === 'w';
    let bestMove = null;
    let bestValue = isWhite ? -Infinity : Infinity;

    moves.sort(() => Math.random() - 0.5);

    for (const m of moves) {
        game.move(m);
        const val = minimax(game, depth - 1, -Infinity, Infinity, !isWhite);
        game.undo();

        if (isWhite ? (val > bestValue) : (val < bestValue)) {
            bestValue = val;
            bestMove = m;
        }
    }

    return bestMove || moves[0];
}

self.onmessage = function(e) {
    const { requestId, fen, aiDifficulty, adaptiveRating } = e.data;
    try {
        const move = findBestMove(fen, aiDifficulty, adaptiveRating);
        self.postMessage({ requestId, move });
    } catch (err) {
        self.postMessage({ requestId, move: null, error: String(err && err.message || err) });
    }
};
