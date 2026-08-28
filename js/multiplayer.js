/**
 * ==========================================================================
 * MULTIPLAYER.JS - Modo Online: partidas privadas por código o enlace
 * ==========================================================================
 * Usa Firebase (Firestore + Auth anónima), auto-alojado en
 * assets/vendor/firebase/ igual que el resto de librerías del proyecto.
 *
 * No hay cuentas ni contraseñas: cada dispositivo entra con un usuario
 * anónimo de Firebase (un UID estable mientras no borres los datos del
 * sitio), y solo existen salas PRIVADAS identificadas por un código de 6
 * caracteres - no hay ningún listado público ni emparejamiento con
 * desconocidos. Quien crea la sala reparte el código o el enlace a quien
 * quiera invitar.
 *
 * Cada partida online es un documento en Firestore:
 *   ajedrez_rooms/{codigo} = {
 *     status: 'waiting' | 'playing',
 *     fen, moveCount, lastMove, turn,
 *     players: { white: {uid,...}, black: {uid,...} | null },
 *     resignedBy: 'w' | 'b' | null,
 *     drawOffer: 'w' | 'b' | 'agreed' | null
 *   }
 * Ver firestore.rules para las reglas de acceso.
 *
 * Este archivo se carga como <script type="module">, así que se ejecuta
 * DESPUÉS de los scripts clásicos (audio/board/engine/ui/main.js) pero
 * ANTES de DOMContentLoaded - EngineManager, UIManager, BoardManager y App
 * ya existen como globals cuando este módulo corre, y el HTML del modal
 * (estático en index.html) ya está parseado.
 */
import { initializeApp } from '../assets/vendor/firebase/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from '../assets/vendor/firebase/firebase-auth.js';
import {
    getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp
} from '../assets/vendor/firebase/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyA_nzgGfRA44aCYyPuF3Y7oN13iWD-pryk",
    authDomain: "ajedrez-3d-92e55.firebaseapp.com",
    projectId: "ajedrez-3d-92e55",
    storageBucket: "ajedrez-3d-92e55.firebasestorage.app",
    messagingSenderId: "321476567632",
    appId: "1:321476567632:web:a8fffc23870774e92e2755"
};

// Sin 0/O/1/I/L: se pueden confundir al dictar el código en voz alta o al leerlo rápido.
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const MultiplayerManager = {
    app: null,
    auth: null,
    db: null,
    uid: null,
    authReady: null,

    roomCode: null,
    myColor: null, // 'w' | 'b'
    unsubscribe: null,
    lastAppliedMoveCount: 0,
    _isApplyingRemote: false,
    _gameStarted: false,
    _resultShown: false,
    _drawPromptShown: false,
    _pendingAutoJoinCode: null,

    init: function () {
        this.app = initializeApp(firebaseConfig);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);

        this.authReady = new Promise((resolve) => {
            onAuthStateChanged(this.auth, (user) => {
                if (user) {
                    this.uid = user.uid;
                    resolve(user.uid);
                }
            });
            signInAnonymously(this.auth).catch((err) => {
                console.warn('No se pudo iniciar el acceso anónimo del modo online:', err);
            });
        });

        const urlCode = new URLSearchParams(window.location.search).get('sala');
        if (urlCode) this._pendingAutoJoinCode = urlCode.toUpperCase();

        this.bindUI();
    },

    generateRoomCode: function () {
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
        }
        return code;
    },

    buildShareLink: function (code) {
        const url = new URL(window.location.href);
        url.search = '';
        url.hash = '';
        url.searchParams.set('sala', code);
        return url.toString();
    },

    // Crea una sala nueva y queda como jugador de Blancas, a la espera del rival.
    createRoom: async function () {
        await this.authReady;
        const code = this.generateRoomCode();
        const roomRef = doc(this.db, 'ajedrez_rooms', code);
        await setDoc(roomRef, {
            code,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: 'waiting',
            fen: null,
            moveCount: 0,
            lastMove: null,
            turn: 'w',
            players: {
                white: { uid: this.uid, joinedAt: Date.now() },
                black: null
            },
            resignedBy: null,
            drawOffer: null
        });
        this.roomCode = code;
        this.myColor = 'w';
        return code;
    },

    // Se une a una sala existente como Negras (o reconecta si ya eras parte de ella).
    joinRoom: async function (code) {
        await this.authReady;
        code = (code || '').trim().toUpperCase();
        if (!code) throw new Error('Escribe un código de sala.');

        const roomRef = doc(this.db, 'ajedrez_rooms', code);
        const snap = await getDoc(roomRef);
        if (!snap.exists()) throw new Error('No existe ninguna sala con ese código.');

        const data = snap.data();

        // Reconexión: ya eras uno de los dos jugadores de esta sala (p. ej. recargaste la página).
        if (data.players.white && data.players.white.uid === this.uid) {
            this.roomCode = code;
            this.myColor = 'w';
            return code;
        }
        if (data.players.black && data.players.black.uid === this.uid) {
            this.roomCode = code;
            this.myColor = 'b';
            return code;
        }

        if (data.players.black) {
            throw new Error('Esa sala ya tiene dos jugadores.');
        }

        await updateDoc(roomRef, {
            'players.black': { uid: this.uid, joinedAt: Date.now() },
            status: 'playing',
            updatedAt: serverTimestamp()
        });

        this.roomCode = code;
        this.myColor = 'b';
        return code;
    },

    // Escucha cambios en tiempo real de la sala: jugadas del rival, rival
    // uniéndose, rendición, ofertas de tablas...
    listenToRoom: function (onUpdate) {
        if (this.unsubscribe) this.unsubscribe();
        const roomRef = doc(this.db, 'ajedrez_rooms', this.roomCode);
        this.unsubscribe = onSnapshot(roomRef, (snap) => {
            if (!snap.exists()) return;
            onUpdate(snap.data());
        }, (err) => {
            console.warn('Se perdió la conexión con la sala online:', err);
        });
    },

    leaveRoom: function () {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.roomCode = null;
        this.myColor = null;
        this.lastAppliedMoveCount = 0;
        this._gameStarted = false;
        this._resultShown = false;
        this._drawPromptShown = false;
    },

    // Sube al servidor la jugada que ACABA de hacer el jugador local.
    pushMove: async function (move) {
        if (!this.roomCode) return;
        const moveCount = EngineManager.history().length;
        this.lastAppliedMoveCount = moveCount;
        const roomRef = doc(this.db, 'ajedrez_rooms', this.roomCode);
        try {
            await updateDoc(roomRef, {
                fen: EngineManager.game.fen(),
                moveCount,
                lastMove: { from: move.from, to: move.to, promotion: move.promotion || null, san: move.san },
                turn: EngineManager.turn(),
                updatedAt: serverTimestamp()
            });
        } catch (err) {
            console.warn('No se pudo sincronizar tu jugada con el rival:', err);
        }
    },

    resign: async function () {
        if (!this.roomCode || !this.myColor) return;
        const roomRef = doc(this.db, 'ajedrez_rooms', this.roomCode);
        await updateDoc(roomRef, { resignedBy: this.myColor, updatedAt: serverTimestamp() });
    },

    offerDraw: async function () {
        if (!this.roomCode || !this.myColor) return;
        const roomRef = doc(this.db, 'ajedrez_rooms', this.roomCode);
        await updateDoc(roomRef, { drawOffer: this.myColor, updatedAt: serverTimestamp() });
    },

    respondDraw: async function (accept) {
        if (!this.roomCode) return;
        const roomRef = doc(this.db, 'ajedrez_rooms', this.roomCode);
        await updateDoc(roomRef, { drawOffer: accept ? 'agreed' : null, updatedAt: serverTimestamp() });
    },

    // Procesa cada actualización en vivo de la sala (propia o del rival).
    handleRoomUpdate: function (data) {
        // Sigo esperando rival (soy quien creó la sala).
        if (this.myColor === 'w' && data.status === 'waiting') {
            return;
        }

        // El rival se acaba de unir - arrancar la partida en ambos lados.
        if (!this._gameStarted) {
            this._gameStarted = true;
            this.lastAppliedMoveCount = data.moveCount || 0;
            if (data.fen) {
                EngineManager.reset(data.fen);
            } else {
                EngineManager.reset();
            }
            this.closeOnlineModal();
            App.launchGame('online');
            if (this.myColor === 'b') {
                setTimeout(() => BoardManager.flipBoard(), 900);
            }
            return;
        }

        // Aplicar una jugada remota nueva.
        if (typeof data.moveCount === 'number' && data.moveCount > this.lastAppliedMoveCount) {
            this._isApplyingRemote = true;
            if (data.moveCount === this.lastAppliedMoveCount + 1 && data.lastMove) {
                UIManager.executeMove(data.lastMove.from, data.lastMove.to, data.lastMove.promotion || 'q');
            } else if (data.fen) {
                // Salto mayor a una jugada (reconexión, etc.) - resincronizar posición completa.
                EngineManager.reset(data.fen);
                BoardManager.renderBoardPieces(EngineManager.board());
                BoardManager.clearHighlights();
                UIManager.updateAllUI();
            }
            this.lastAppliedMoveCount = data.moveCount;
            this._isApplyingRemote = false;
        }

        // Rendición (propia o del rival, reflejada de vuelta desde el servidor).
        if (data.resignedBy && !this._resultShown) {
            this._resultShown = true;
            const loserLabel = data.resignedBy === 'w' ? 'Blancas' : 'Negras';
            const winnerLabel = data.resignedBy === 'w' ? 'Negras' : 'Blancas';
            UIManager.showGameOverModal('Rendición', `${loserLabel} se han rendido. Ganan las ${winnerLabel}.`);
        }

        // Tablas: acordadas, u ofrecidas por el rival y pendientes de mi respuesta.
        if (data.drawOffer === 'agreed' && !this._resultShown) {
            this._resultShown = true;
            UIManager.showGameOverModal('Tablas', 'Ambos jugadores acordaron las tablas.');
        } else if (data.drawOffer && data.drawOffer !== 'agreed' && data.drawOffer !== this.myColor && !this._drawPromptShown) {
            this._drawPromptShown = true;
            const accept = window.confirm('Tu rival ofrece tablas. ¿Aceptas?');
            this.respondDraw(accept).finally(() => { this._drawPromptShown = false; });
        }
    },

    // =========================================================================
    // INTERFAZ: modal de crear/unirse a sala
    // =========================================================================
    openCreateJoinModal: function () {
        const modal = document.getElementById('online-modal');
        if (!modal) return;
        this._showChooseView();
        modal.style.display = 'flex';

        if (this._pendingAutoJoinCode) {
            const input = document.getElementById('online-join-code-input');
            if (input) input.value = this._pendingAutoJoinCode;
            this._pendingAutoJoinCode = null;
        }
    },

    closeOnlineModal: function () {
        const modal = document.getElementById('online-modal');
        if (modal) modal.style.display = 'none';
    },

    _showChooseView: function () {
        const choose = document.getElementById('online-choose-view');
        const waiting = document.getElementById('online-waiting-view');
        if (choose) choose.style.display = 'flex';
        if (waiting) waiting.style.display = 'none';
    },

    _showWaitingView: function (code) {
        const choose = document.getElementById('online-choose-view');
        const waiting = document.getElementById('online-waiting-view');
        const codeEl = document.getElementById('online-room-code-display');
        if (choose) choose.style.display = 'none';
        if (waiting) waiting.style.display = 'flex';
        if (codeEl) codeEl.textContent = code;
    },

    bindUI: function () {
        const btnCreate = document.getElementById('btn-online-create');
        const btnJoin = document.getElementById('btn-online-join');
        const btnCopyLink = document.getElementById('btn-online-copy-link');
        const btnCloseModal = document.getElementById('btn-close-online-modal');
        const joinInput = document.getElementById('online-join-code-input');
        const btnResign = document.getElementById('btn-resign');
        const btnOfferDraw = document.getElementById('btn-offer-draw');

        if (btnCreate) {
            btnCreate.addEventListener('click', async () => {
                btnCreate.disabled = true;
                try {
                    const code = await this.createRoom();
                    this._gameStarted = false;
                    this._resultShown = false;
                    this.listenToRoom((data) => this.handleRoomUpdate(data));
                    this._showWaitingView(code);
                } catch (err) {
                    alert('No se pudo crear la sala: ' + err.message);
                } finally {
                    btnCreate.disabled = false;
                }
            });
        }

        if (btnJoin) {
            btnJoin.addEventListener('click', async () => {
                const code = joinInput ? joinInput.value : '';
                btnJoin.disabled = true;
                try {
                    await this.joinRoom(code);
                    this._gameStarted = false;
                    this._resultShown = false;
                    this.listenToRoom((data) => this.handleRoomUpdate(data));
                } catch (err) {
                    alert(err.message || 'No se pudo unir a la sala.');
                } finally {
                    btnJoin.disabled = false;
                }
            });
        }

        if (joinInput) {
            joinInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && btnJoin) btnJoin.click();
            });
        }

        if (btnCopyLink) {
            btnCopyLink.addEventListener('click', async () => {
                if (!this.roomCode) return;
                const link = this.buildShareLink(this.roomCode);
                try {
                    await navigator.clipboard.writeText(link);
                    const original = btnCopyLink.textContent;
                    btnCopyLink.textContent = '✓ Enlace copiado';
                    setTimeout(() => { btnCopyLink.textContent = original; }, 1800);
                } catch (e) {
                    prompt('Copia el enlace manualmente:', link);
                }
            });
        }

        if (btnCloseModal) {
            btnCloseModal.addEventListener('click', () => {
                this.closeOnlineModal();
                if (this.roomCode && !this._gameStarted) {
                    this.leaveRoom();
                }
            });
        }

        if (btnResign) {
            btnResign.addEventListener('click', () => {
                if (App.currentGameMode !== 'online') return;
                if (confirm('¿Seguro que quieres rendirte?')) {
                    this.resign();
                }
            });
        }

        if (btnOfferDraw) {
            btnOfferDraw.addEventListener('click', () => {
                if (App.currentGameMode !== 'online') return;
                this.offerDraw();
                AudioManager.playClick();
            });
        }
    }
};

window.MultiplayerManager = MultiplayerManager;
MultiplayerManager.init();
