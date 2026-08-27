/**
 * ==========================================================================
 * ENGINE.JS - Motor Chess.js, Inteligencia Artificial y Análisis de Tablero
 * ==========================================================================
 */

const ADAPTIVE_STORAGE_KEY = 'ajedrez3d_modoAdaptacion';

const EngineManager = {
    game: null,
    isPlayerVsAI: true,
    aiDifficulty: 'adaptive', // 'adaptive' (por defecto), 'easy', 'medium', 'hard'
    isAITurn: false,

    // =========================================================================
    // MODO ADAPTACIÓN: la IA sube o baja de nivel según qué tan bien juegues.
    // Se guarda en localStorage (memoria del propio navegador) porque este
    // proyecto no tiene servidor/base de datos - no hace falta una para esto,
    // el progreso simplemente vive en este equipo/navegador.
    // =========================================================================
    adaptive: {
        rating: 30,       // 0 (principiante) a 100 (Gran Maestro), progresa solo
        gamesPlayed: 0,
        wins: 0,          // partidas ganadas por el HUMANO
        losses: 0,        // partidas ganadas por la IA
        draws: 0
    },

    loadAdaptiveProgress: function() {
        try {
            const raw = localStorage.getItem(ADAPTIVE_STORAGE_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                Object.assign(this.adaptive, saved);
            }
        } catch (e) {
            console.warn('No se pudo leer el progreso del Modo Adaptación:', e);
        }
    },

    saveAdaptiveProgress: function() {
        try {
            localStorage.setItem(ADAPTIVE_STORAGE_KEY, JSON.stringify(this.adaptive));
        } catch (e) {
            console.warn('No se pudo guardar el progreso del Modo Adaptación:', e);
        }
    },

    // Traduce el rating (0-100) en fuerza real de juego: más profundidad de
    // cálculo y menos probabilidad de "error a propósito" cuanto más alto.
    getAdaptiveStrength: function() {
        const r = this.adaptive.rating;
        const depth = r < 34 ? 1 : (r < 67 ? 2 : 3);
        const blunderChance = Math.max(0.03, 0.45 - (r / 100) * 0.42);
        return { depth, blunderChance };
    },

    // Llamar cuando una partida vs IA termina en jaque mate o tablas, para que
    // el nivel adaptativo evolucione de una partida a la siguiente.
    recordAdaptiveResult: function(outcome) {
        if (outcome === 'win') {
            this.adaptive.wins++;
            this.adaptive.rating += 8;
        } else if (outcome === 'loss') {
            this.adaptive.losses++;
            this.adaptive.rating -= 5;
        } else if (outcome === 'draw') {
            this.adaptive.draws++;
            this.adaptive.rating += 2;
        }
        this.adaptive.gamesPlayed++;
        this.adaptive.rating = Math.max(0, Math.min(100, this.adaptive.rating));
        this.saveAdaptiveProgress();
    },

    // Tablas de valores posicionales de piezas para la IA (Piece-Square Tables)
    pst: {
        p: [
            [0,  0,  0,  0,  0,  0,  0,  0],
            [50, 50, 50, 50, 50, 50, 50, 50],
            [10, 10, 20, 30, 30, 20, 10, 10],
            [5,  5, 10, 25, 25, 10,  5,  5],
            [0,  0,  0, 20, 20,  0,  0,  0],
            [5, -5,-10,  0,  0,-10, -5,  5],
            [5, 10, 10,-20,-20, 10, 10,  5],
            [0,  0,  0,  0,  0,  0,  0,  0]
        ],
        n: [
            [-50,-40,-30,-30,-30,-30,-40,-50],
            [-40,-20,  0,  0,  0,  0,-20,-40],
            [-30,  0, 10, 15, 15, 10,  0,-30],
            [-30,  5, 15, 20, 20, 15,  5,-30],
            [-30,  0, 15, 20, 20, 15,  0,-30],
            [-30,  5, 10, 15, 15, 10,  5,-30],
            [-40,-20,  0,  5,  5,  0,-20,-40],
            [-50,-40,-30,-30,-30,-30,-40,-50]
        ],
        b: [
            [-20,-10,-10,-10,-10,-10,-10,-20],
            [-10,  0,  0,  0,  0,  0,  0,-10],
            [-10,  0,  5, 10, 10,  5,  0,-10],
            [-10,  5,  5, 10, 10,  5,  5,-10],
            [-10,  0, 10, 10, 10, 10,  0,-10],
            [-10, 10, 10, 10, 10, 10, 10,-10],
            [-10,  5,  0,  0,  0,  0,  5,-10],
            [-20,-10,-10,-10,-10,-10,-10,-20]
        ],
        r: [
            [0,  0,  0,  0,  0,  0,  0,  0],
            [5, 10, 10, 10, 10, 10, 10,  5],
            [-5,  0,  0,  0,  0,  0,  0, -5],
            [-5,  0,  0,  0,  0,  0,  0, -5],
            [-5,  0,  0,  0,  0,  0,  0, -5],
            [-5,  0,  0,  0,  0,  0,  0, -5],
            [-5,  0,  0,  0,  0,  0,  0, -5],
            [0,  0,  0,  5,  5,  0,  0,  0]
        ],
        q: [
            [-20,-10,-10, -5, -5,-10,-10,-20],
            [-10,  0,  0,  0,  0,  0,  0,-10],
            [-10,  0,  5,  5,  5,  5,  0,-10],
            [-5,  0,  5,  5,  5,  5,  0, -5],
            [0,  0,  5,  5,  5,  5,  0, -5],
            [-10,  5,  5,  5,  5,  5,  0,-10],
            [-10,  0,  5,  0,  0,  0,  0,-10],
            [-20,-10,-10, -5, -5,-10,-10,-20]
        ],
        k: [
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-20,-30,-30,-40,-40,-30,-30,-20],
            [-10,-20,-20,-20,-20,-20,-20,-10],
            [20, 20,  0,  0,  0,  0, 20, 20],
            [20, 30, 10,  0,  0, 10, 30, 20]
        ]
    },

    pieceValues: { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 },

    init: function() {
        this.game = new Chess();
        this.loadAdaptiveProgress();
    },

    // =========================================================================
    // CÁLCULO DE LA IA EN SEGUNDO PLANO (Web Worker)
    // =========================================================================
    // findBestAIMove() (más abajo) es síncrono y puede tardar segundos, lo que
    // congela toda la pantalla mientras calcula - muy notorio en celulares de
    // gama baja. findBestAIMoveAsync() delega ese cálculo a un Web Worker para
    // que la interfaz nunca deje de responder, sin importar cuánto tarde.
    _aiWorker: null,
    _aiWorkerRequestId: 0,
    _aiWorkerPending: {},
    _aiWorkerFailed: false,

    _getAIWorker: function() {
        if (this._aiWorker || this._aiWorkerFailed) return this._aiWorker;
        try {
            this._aiWorker = new Worker('js/ai-worker.js');
            this._aiWorker.onmessage = (e) => {
                const { requestId, move, error } = e.data;
                const resolver = this._aiWorkerPending[requestId];
                if (resolver) {
                    delete this._aiWorkerPending[requestId];
                    if (error) console.warn('El worker de la IA reportó un error:', error);
                    resolver(move);
                }
            };
            this._aiWorker.onerror = (err) => {
                console.warn('Web Worker de IA no disponible, se usará cálculo directo:', err.message);
                this._aiWorkerFailed = true;
                this._aiWorker = null;
                // Resolver cualquier solicitud pendiente con el respaldo síncrono
                Object.keys(this._aiWorkerPending).forEach(id => {
                    const resolver = this._aiWorkerPending[id];
                    delete this._aiWorkerPending[id];
                    resolver(this.findBestAIMove());
                });
            };
        } catch (e) {
            console.warn('No se pudo crear el Web Worker de IA, se usará cálculo directo:', e);
            this._aiWorkerFailed = true;
            this._aiWorker = null;
        }
        return this._aiWorker;
    },

    // =========================================================================
    // MOTOR REAL: STOCKFISH (el mismo motor de Chess.com/Lichess) vía UCI
    // =========================================================================
    // Reemplaza al minimax casero (que jugaba nivel "club", ~1200-1400) por
    // el motor de ajedrez real, corriendo 100% local en el navegador vía
    // WebAssembly/asm.js dentro de un Web Worker - sin servidor, sin costo,
    // y con una fuerza honesta desde principiante hasta imbatible.
    _sfWorker: null,
    _sfReady: false,
    _sfFailed: false,
    _sfInitPromise: null,
    _sfQueue: [],
    _sfBusy: false,
    _sfCurrentResolve: null,

    _initStockfish: function() {
        if (this._sfInitPromise) return this._sfInitPromise;

        this._sfInitPromise = new Promise((resolve, reject) => {
            let worker;
            try {
                worker = new Worker('js/stockfish-worker.js');
            } catch (e) {
                this._sfFailed = true;
                reject(e);
                return;
            }

            let sawUciOk = false;
            worker.onmessage = (e) => {
                const line = String(e.data || '');
                if (!sawUciOk && line.startsWith('uciok')) {
                    sawUciOk = true;
                    worker.postMessage('isready');
                } else if (!this._sfReady && line.startsWith('readyok')) {
                    this._sfReady = true;
                    resolve();
                } else if (line.startsWith('bestmove')) {
                    // "bestmove e2e4 ponder e7e5" o "bestmove (none)" si no hay jugadas
                    const parts = line.split(' ');
                    const uciMove = parts[1];
                    const resolver = this._sfCurrentResolve;
                    this._sfCurrentResolve = null;
                    this._sfBusy = false;
                    if (resolver) resolver(this._parseUciMove(uciMove));
                    this._sfProcessQueue();
                }
            };
            worker.onerror = (err) => {
                console.warn('Stockfish no se pudo cargar (¿sin conexión al CDN?), usando motor de respaldo:', err.message);
                this._sfFailed = true;
                this._sfWorker = null;
                if (!this._sfReady) reject(err);
                // Vaciar la cola pendiente para que cada llamada haga su propio fallback
                const pending = this._sfQueue.splice(0);
                pending.forEach(job => job.resolve(null));
                if (this._sfCurrentResolve) { this._sfCurrentResolve(null); this._sfCurrentResolve = null; }
            };

            this._sfWorker = worker;
            worker.postMessage('uci');
        });

        return this._sfInitPromise;
    },

    // Traduce dificultad/rating a parámetros reales de Stockfish. "Skill
    // Level" (0-20) es el propio control de fuerza del motor; a niveles muy
    // bajos se le suma una pequeña probabilidad de jugada aleatoria para que
    // el modo Adaptación siga siendo amable con un principiante absoluto.
    _getStockfishParams: function() {
        if (this.aiDifficulty === 'medium') return { skill: 8, movetimeMs: 700, blunderChance: 0 };
        if (this.aiDifficulty === 'hard') return { skill: 20, movetimeMs: 1800, blunderChance: 0 };

        const r = this.adaptive.rating;
        const skill = Math.max(0, Math.min(20, Math.round(r / 5)));
        const movetimeMs = Math.round(400 + (r / 100) * 1200);
        const blunderChance = Math.max(0, 0.22 - (r / 100) * 0.22);
        return { skill, movetimeMs, blunderChance };
    },

    _parseUciMove: function(uciMove) {
        if (!uciMove || uciMove === '(none)') return null;
        const move = {
            from: uciMove.slice(0, 2),
            to: uciMove.slice(2, 4)
        };
        if (uciMove.length > 4) move.promotion = uciMove[4];
        return move;
    },

    _sfProcessQueue: function() {
        if (this._sfBusy || this._sfQueue.length === 0 || !this._sfWorker) return;
        this._sfBusy = true;
        const job = this._sfQueue.shift();
        this._sfCurrentResolve = job.resolve;
        this._sfWorker.postMessage(`setoption name Skill Level value ${job.skill}`);
        this._sfWorker.postMessage(`position fen ${job.fen}`);
        this._sfWorker.postMessage(`go movetime ${job.movetimeMs}`);
    },

    findBestMoveViaStockfish: function() {
        if (this._sfFailed) return Promise.reject(new Error('Stockfish falló previamente'));

        const moves = this.game.moves();
        if (moves.length === 0) return Promise.resolve(null);

        const { skill, movetimeMs, blunderChance } = this._getStockfishParams();
        if (blunderChance > 0 && Math.random() < blunderChance) {
            const verboseMoves = this.game.moves({ verbose: true });
            return Promise.resolve(verboseMoves[Math.floor(Math.random() * verboseMoves.length)]);
        }

        const fen = this.game.fen();
        return this._initStockfish().then(() => {
            // Red de seguridad: si por lo que sea nunca llega "bestmove" (peor
            // caso improbable), esto evita que la partida se quede colgada
            // para siempre esperando y cae al motor de respaldo.
            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => reject(new Error('Stockfish tardó demasiado en responder')), 20000);
                const resolveOnce = (move) => { clearTimeout(timeoutId); resolve(move); };
                this._sfQueue.push({ fen, skill, movetimeMs, resolve: resolveOnce });
                this._sfProcessQueue();
            });
        }).then((move) => {
            if (!move) throw new Error('Stockfish no devolvió jugada');
            return move;
        });
    },

    // Respaldo con el minimax casero (vía su propio Worker, sin bloquear la
    // pantalla) cuando Stockfish no está disponible o falla al cargar.
    _findBestAIMoveViaFallbackWorker: function() {
        const worker = this._getAIWorker();
        if (!worker) {
            return Promise.resolve(this.findBestAIMove());
        }
        const requestId = ++this._aiWorkerRequestId;
        return new Promise((resolve) => {
            this._aiWorkerPending[requestId] = resolve;
            worker.postMessage({
                requestId,
                fen: this.game.fen(),
                aiDifficulty: this.aiDifficulty,
                adaptiveRating: this.adaptive.rating
            });
        });
    },

    findBestAIMoveAsync: function() {
        // Modo Fácil: se queda con jugadas aleatorias/capturas directas a
        // propósito - un motor real ya no se siente "fácil" ni en su nivel
        // más bajo, así que este primer escalón sigue siendo casero.
        if (this.aiDifficulty === 'easy') {
            return Promise.resolve(this.findBestAIMove());
        }
        return this.findBestMoveViaStockfish().catch((e) => {
            console.warn('Stockfish no disponible, se usa el motor casero de respaldo:', e);
            return this._findBestAIMoveViaFallbackWorker();
        });
    },

    reset: function(fen) {
        if (fen) {
            this.game.load(fen);
        } else {
            this.game.reset();
        }
        this.isAITurn = false;
    },

    board: function() {
        return this.game.board();
    },

    turn: function() {
        return this.game.turn();
    },

    moves: function(options) {
        return this.game.moves(options || {});
    },

    move: function(moveObj) {
        return this.game.move(moveObj);
    },

    undo: function() {
        return this.game.undo();
    },

    history: function(options) {
        return this.game.history(options || {});
    },

    inCheck: function() {
        return this.game.in_check();
    },

    inCheckmate: function() {
        return this.game.in_checkmate();
    },

    inDraw: function() {
        return this.game.in_draw() || this.game.in_stalemate() || this.game.in_threefold_repetition();
    },

    gameOver: function() {
        return this.game.game_over();
    },

    findKingSquare: function(color) {
        const b = this.game.board();
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const p = b[r][f];
                if (p && p.type === 'k' && p.color === color) {
                    return files[f] + ranks[r];
                }
            }
        }
        return null;
    },

    // Cálculo de capturas acumuladas
    getCapturedPieces: function() {
        const hist = this.game.history({ verbose: true });
        const capturedByWhite = [];
        const capturedByBlack = [];

        hist.forEach(m => {
            if (m.captured) {
                if (m.color === 'w') {
                    capturedByWhite.push(m.captured);
                } else {
                    capturedByBlack.push(m.captured);
                }
            }
        });

        // Ventaja de material
        let scoreWhite = capturedByWhite.reduce((acc, p) => acc + this.pieceValues[p], 0);
        let scoreBlack = capturedByBlack.reduce((acc, p) => acc + this.pieceValues[p], 0);
        let diff = Math.floor((scoreWhite - scoreBlack) / 100);

        return {
            white: capturedByWhite,
            black: capturedByBlack,
            materialAdvantage: diff // > 0 White advantage, < 0 Black advantage
        };
    },

    // Evaluación posicional avanzada del tablero
    evaluatePosition: function() {
        let total = 0;
        const b = this.game.board();

        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const p = b[r][f];
                if (p) {
                    const baseVal = this.pieceValues[p.type];
                    const pstVal = p.color === 'w' 
                        ? this.pst[p.type][r][f] 
                        : this.pst[p.type][7 - r][f];
                    const val = baseVal + pstVal;
                    total += (p.color === 'w') ? val : -val;
                }
            }
        }
        return total;
    },

    // Cálculo del mapa de control de casillas (Threat Vision Heatmap)
    calculateSquareControl: function() {
        const controlMap = {};
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

        // Inicializar mapa en 0
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                controlMap[files[f] + ranks[r]] = 0;
            }
        }

        // Obtener todas las jugadas posibles para el bando actual
        const currentTurn = this.game.turn();
        const currentMoves = this.game.moves({ verbose: true });
        currentMoves.forEach(m => {
            controlMap[m.to] += (currentTurn === 'w') ? 1 : -1;
        });

        return controlMap;
    },

    // MINIMAX CON PODA ALFA-BETA
    minimax: function(depth, alpha, beta, maximizing) {
        if (depth === 0 || this.game.game_over()) {
            return this.evaluatePosition();
        }

        const moves = this.game.moves({ verbose: true });
        if (maximizing) {
            let maxEval = -Infinity;
            for (const m of moves) {
                this.game.move(m);
                const ev = this.minimax(depth - 1, alpha, beta, false);
                this.game.undo();
                maxEval = Math.max(maxEval, ev);
                alpha = Math.max(alpha, ev);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const m of moves) {
                this.game.move(m);
                const ev = this.minimax(depth - 1, alpha, beta, true);
                this.game.undo();
                minEval = Math.min(minEval, ev);
                beta = Math.min(beta, ev);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    },

    // Encontrar la mejor jugada para la IA
    findBestAIMove: function() {
        const moves = this.game.moves({ verbose: true });
        if (moves.length === 0) return null;

        // Modo Fácil: jugadas aleatorias o capturas directas
        if (this.aiDifficulty === 'easy') {
            const captures = moves.filter(m => m.captured);
            if (captures.length > 0 && Math.random() < 0.7) {
                return captures[Math.floor(Math.random() * captures.length)];
            }
            return moves[Math.floor(Math.random() * moves.length)];
        }

        // Modo Adaptación: la fuerza (profundidad + probabilidad de error)
        // sale del rating guardado, que sube o baja según ganes o pierdas.
        let depth;
        if (this.aiDifficulty === 'adaptive') {
            const strength = this.getAdaptiveStrength();
            if (Math.random() < strength.blunderChance) {
                return moves[Math.floor(Math.random() * moves.length)];
            }
            depth = strength.depth;
        } else {
            // Modo Medio y Difícil: Minimax posicional
            depth = (this.aiDifficulty === 'hard') ? 3 : 2;
        }
        const isWhite = this.game.turn() === 'w';
        let bestMove = null;
        let bestValue = isWhite ? -Infinity : Infinity;

        // Barajar para que no juegue siempre igual ante valores idénticos
        moves.sort(() => Math.random() - 0.5);

        for (const m of moves) {
            this.game.move(m);
            const val = this.minimax(depth - 1, -Infinity, Infinity, !isWhite);
            this.game.undo();

            if (isWhite) {
                if (val > bestValue) {
                    bestValue = val;
                    bestMove = m;
                }
            } else {
                if (val < bestValue) {
                    bestValue = val;
                    bestMove = m;
                }
            }
        }

        return bestMove || moves[0];
    }
};

window.EngineManager = EngineManager;
