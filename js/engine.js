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
    // (delega en ai-fallback-core.js, compartido con el Worker de respaldo)
    getAdaptiveStrength: function() {
        return ChessAIFallback.getAdaptiveStrength(this.adaptive.rating);
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

    // Tablas de valores posicionales y de piezas: viven en ai-fallback-core.js
    // (compartidas con el Worker de respaldo) - aquí solo se referencian para
    // no duplicarlas. Ver getCapturedPieces() y evaluatePosition() más abajo.
    get pst() { return ChessAIFallback.pst; },
    get pieceValues() { return ChessAIFallback.pieceValues; },

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

    // Evaluación posicional avanzada del tablero (delega en ai-fallback-core.js)
    evaluatePosition: function() {
        return ChessAIFallback.evaluatePosition(this.game);
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

    // MINIMAX CON PODA ALFA-BETA - delega en ai-fallback-core.js (con
    // quietud/quiescence incluida al llegar al límite de profundidad).
    minimax: function(depth, alpha, beta, maximizing) {
        return ChessAIFallback.minimax(this.game, depth, alpha, beta, maximizing);
    },

    // Encontrar la mejor jugada para la IA - último recurso 100% síncrono
    // (se usa solo si ni Stockfish ni siquiera el Worker de respaldo pudieron
    // crearse). Misma lógica de búsqueda que el Worker, vía ai-fallback-core.js.
    findBestAIMove: function() {
        return ChessAIFallback.findBestMoveForGame(this.game, this.aiDifficulty, this.adaptive.rating);
    }
};

window.EngineManager = EngineManager;
