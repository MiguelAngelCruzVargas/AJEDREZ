/**
 * ==========================================================================
 * MAIN.JS - Orquestador Principal, Soporte Táctil Multi-Dispositivo y Cinemáticas
 * ==========================================================================
 */

const App = {
    state: 'MENU', // 'MENU', 'PLAYING'
    currentGameMode: 'ai', // 'ai', 'pvp', 'academy', 'puzzles'
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    clock: new THREE.Clock(),
    menuOrbitAngle: 0,
    isCinematicIntroRunning: false,
    autoFlip2Players: false, // Auto-giro de tablero en modo 2 jugadores

    init: function () {
        // 1. Inicializar Motores
        EngineManager.init();
        BoardManager.init('canvas-container');
        EffectsManager.init();
        UIManager.init();

        // 2. Render inicial de piezas y UI
        BoardManager.renderBoardPieces(EngineManager.board());
        UIManager.updateAllUI();

        // 3. Vincular eventos de interacción del ratón y táctiles
        this.bindInteraction();
        this.bindStartMenu();
        this.bindTouchAudioUnlock();

        // 4. Iniciar bucle de renderizado 3D
        this.animate();
    },

    // Desbloqueo de AudioContext en el primer toque/clic, y arranque de la
    // música ambiental desde la propia pantalla de inicio (no hasta jugar).
    // Ningún navegador permite sonido sin un gesto real del usuario primero,
    // así que además de escuchar ese primer gesto por varias vías (por si el
    // dispositivo no dispara alguna), se muestra un aviso breve en pantalla
    // para confirmar que el audio ya quedó activo.
    bindTouchAudioUnlock: function () {
        const unlock = () => {
            AudioManager.init();
            AudioManager.startBackgroundMusic();
            this.showAudioReadyToast();
            window.removeEventListener('touchstart', unlock, true);
            window.removeEventListener('touchend', unlock, true);
            window.removeEventListener('pointerdown', unlock, true);
            window.removeEventListener('click', unlock, true);
            window.removeEventListener('keydown', unlock, true);
        };
        window.addEventListener('touchstart', unlock, true);
        window.addEventListener('touchend', unlock, true);
        window.addEventListener('pointerdown', unlock, true);
        window.addEventListener('click', unlock, true);
        window.addEventListener('keydown', unlock, true);
    },

    showAudioReadyToast: function () {
        const toast = document.createElement('div');
        toast.textContent = '🔊 Sonido activado';
        toast.style.cssText = `
            position: fixed; top: 18px; left: 50%; transform: translateX(-50%) translateY(-10px);
            background: rgba(16, 21, 34, 0.92); color: #e2c056; border: 1px solid rgba(212, 175, 55, 0.5);
            padding: 8px 18px; border-radius: 999px; font-family: 'Montserrat', sans-serif;
            font-size: 0.78rem; letter-spacing: 0.5px; z-index: 999; pointer-events: none;
            opacity: 0; transition: opacity 0.35s ease, transform 0.35s ease;
        `;
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-10px)';
            setTimeout(() => toast.remove(), 400);
        }, 2200);
    },

    // Feedback háptico de vibración en dispositivos móviles y tablets compatibles
    triggerHaptic: function (pattern = 15) {
        if (navigator.vibrate) {
            try {
                navigator.vibrate(pattern);
            } catch (e) { }
        }
    },

    bindStartMenu: function () {
        const startOverlay = document.getElementById('start-overlay');
        const heroButtons = document.querySelectorAll('.btn-hero');

        const launchGame = (mode) => {
            if (this.isCinematicIntroRunning) return;
            this.isCinematicIntroRunning = true;
            this.currentGameMode = mode;

            // Iniciar Audio Cinemático Envolvente
            AudioManager.init();
            AudioManager.playCinematicIntro();
            AudioManager.startBackgroundMusic();
            this.triggerHaptic([20, 30, 20]);

            EngineManager.isPlayerVsAI = (mode === 'ai');
            this.state = 'PLAYING';

            // Configuración según el modo elegido
            if (mode === 'pvp') {
                document.body.classList.add('mode-pvp-active');
                document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
                const gameTab = document.querySelector('.mode-tab[data-mode="game"]');
                if (gameTab) gameTab.classList.add('active');
                UIManager.setCleanPvPMode(true);
                UIManager.setTimeControl(UIManager.timeControl);
                UIManager.resetClock();
            } else if (mode === 'academy') {
                document.body.classList.remove('mode-pvp-active');
                UIManager.setCleanPvPMode(false);
                document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
                const academyTab = document.querySelector('.mode-tab[data-mode="academy"]');
                if (academyTab) academyTab.classList.add('active');
                UIManager.pauseClock();
                UIManager.openLearningDrawer();
            } else {
                document.body.classList.remove('mode-pvp-active');
                UIManager.setCleanPvPMode(false);
                document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
                const gameTab = document.querySelector('.mode-tab[data-mode="game"]');
                if (gameTab) gameTab.classList.add('active');
                UIManager.setTimeControl(UIManager.timeControl);
                UIManager.resetClock();
            }

            UIManager.updateTurnStatus();

            // Desvanecer el Menú Hero y revelar el HUD de partida
            document.body.classList.remove('menu-active');
            if (startOverlay) {
                startOverlay.style.opacity = '0';
                startOverlay.style.pointerEvents = 'none';
                setTimeout(() => {
                    startOverlay.style.display = 'none';
                }, 800);
            }

            // Cinemática de entrada aérea estilo película
            BoardManager.controls.enabled = false;
            BoardManager.camera.position.set(-14, 5, -14);
            BoardManager.controls.target.set(0, 0.5, 0);

            new TWEEN.Tween(BoardManager.camera.position)
                .to({ x: 12, y: 8, z: 12 }, 1200)
                .easing(TWEEN.Easing.Cubic.InOut)
                .onComplete(() => {
                    new TWEEN.Tween(BoardManager.camera.position)
                        .to({ x: 0, y: 24, z: 9 }, 1400)
                        .easing(TWEEN.Easing.Cubic.Out)
                        .onComplete(() => {
                            BoardManager.controls.enabled = true;
                            this.isCinematicIntroRunning = false;
                        })
                        .start();
                })
                .start();
        };

        heroButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode || 'ai';
                launchGame(mode);
            });
        });
    },

    getRaycastTarget: function (clientX, clientY) {
        if (!BoardManager.renderer || !BoardManager.camera) return null;
        const dom = BoardManager.renderer.domElement;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, BoardManager.camera);

        const listToIntersect = [
            ...BoardManager.boardGroup.children,
            ...BoardManager.piecesGroup.children,
            ...BoardManager.highlightGroup.children,
            ...BoardManager.lastMoveGroup.children
        ];

        const intersects = this.raycaster.intersectObjects(listToIntersect, true);
        if (intersects.length === 0) return null;

        let obj = intersects[0].object;
        while (obj.parent && obj.parent !== BoardManager.scene && !obj.userData.isSquare && !obj.userData.isPiece) {
            obj = obj.parent;
        }

        if (obj.userData.isPiece) {
            return {
                type: 'piece',
                color: obj.userData.color,
                square: obj.userData.square,
                pieceType: obj.userData.type,
                mesh: obj
            };
        } else if (obj.userData.isSquare) {
            return {
                type: 'square',
                square: obj.userData.id,
                mesh: obj
            };
        }
        return null;
    },

    bindInteraction: function () {
        let pointerDownTarget = null;
        let startX = 0;
        let startY = 0;

        const onPointerDown = (event) => {
            if (this.state !== 'PLAYING' || EngineManager.isAITurn || EngineManager.gameOver() || UIManager.pendingPromotion || this.isCinematicIntroRunning) {
                return;
            }

            if (event.target && event.target.closest('#top-bar, #history-panel, #stats-panel, #bottom-bar, #ai-coach-card, #learning-drawer, .modal-overlay, #start-overlay, button, select, input, a')) {
                return;
            }

            const clientX = event.changedTouches ? event.changedTouches[0].clientX : event.clientX;
            const clientY = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;
            startX = clientX;
            startY = clientY;

            pointerDownTarget = this.getRaycastTarget(clientX, clientY);

            if (pointerDownTarget && pointerDownTarget.type === 'piece') {
                if (pointerDownTarget.color === EngineManager.turn()) {
                    UIManager.selectedSquare = pointerDownTarget.square;
                    UIManager.validMoves = EngineManager.moves({ square: pointerDownTarget.square, verbose: true });
                    BoardManager.showValidMoves(UIManager.validMoves);
                    BoardManager.showSelectedSquare(pointerDownTarget.square);

                    new TWEEN.Tween(pointerDownTarget.mesh.position)
                        .to({ y: 0.45 }, 120)
                        .easing(TWEEN.Easing.Quadratic.Out)
                        .yoyo(true)
                        .repeat(1)
                        .start();

                    AudioManager.playClick();
                    this.triggerHaptic(12);
                }
            }
        };

        const onPointerUp = (event) => {
            if (this.state !== 'PLAYING' || EngineManager.isAITurn || EngineManager.gameOver() || UIManager.pendingPromotion || this.isCinematicIntroRunning) {
                return;
            }

            if (event.target && event.target.closest('#top-bar, #history-panel, #stats-panel, #bottom-bar, #ai-coach-card, #learning-drawer, .modal-overlay, #start-overlay, button, select, input, a')) {
                return;
            }

            const clientX = event.changedTouches ? event.changedTouches[0].clientX : event.clientX;
            const clientY = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;

            // Si el usuario estaba arrastrando para rotar la cámara (gran desplazamiento), ignorar
            const dist = Math.hypot(clientX - startX, clientY - startY);
            if (dist > 15 && !UIManager.selectedSquare) {
                return;
            }

            const upTarget = this.getRaycastTarget(clientX, clientY);

            if (!UIManager.selectedSquare) {
                return;
            }

            if (!upTarget) {
                BoardManager.clearHighlights();
                UIManager.selectedSquare = null;
                return;
            }

            const fromSquare = UIManager.selectedSquare;
            const toSquare = upTarget.square;

            if (toSquare === fromSquare) {
                return;
            }

            const moved = this.handlePlayerMoveAttempt(fromSquare, toSquare);
            if (!moved) {
                if (upTarget.type === 'piece' && upTarget.color === EngineManager.turn()) {
                    UIManager.selectedSquare = upTarget.square;
                    UIManager.validMoves = EngineManager.moves({ square: upTarget.square, verbose: true });
                    BoardManager.showValidMoves(UIManager.validMoves);
                    BoardManager.showSelectedSquare(upTarget.square);
                    AudioManager.playClick();
                    this.triggerHaptic(12);
                } else {
                    BoardManager.clearHighlights();
                    UIManager.selectedSquare = null;
                }
            }
        };

        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointerup', onPointerUp);
    },

    handlePlayerMoveAttempt: function (from, to) {
        if (!from || !to) return false;

        // Modo Lección
        if (LearningManager.currentMode === 'lesson') {
            const success = LearningManager.handleLessonMove(from, to);
            if (success) {
                UIManager.executeMove(from, to);
            }
            BoardManager.clearHighlights();
            UIManager.selectedSquare = null;
            return success;
        }

        // Modo Puzzle
        if (LearningManager.currentMode === 'puzzle') {
            const success = LearningManager.handlePuzzleMove(from, to);
            if (success) {
                UIManager.executeMove(from, to);
            }
            BoardManager.clearHighlights();
            UIManager.selectedSquare = null;
            return success;
        }

        // Modo Partida (PvP o Vs IA)
        const movesForSquare = EngineManager.moves({ square: from, verbose: true });
        const matching = movesForSquare.filter(m => m.to === to);

        if (matching.length === 0) {
            return false;
        }

        if (matching[0].flags.includes('p')) {
            UIManager.pendingPromotion = { from, to };
            UIManager.showPromotionModal(matching[0].color);
        } else {
            UIManager.executeMove(from, to);
        }

        BoardManager.clearHighlights();
        UIManager.selectedSquare = null;
        return true;
    },

    animate: function () {
        requestAnimationFrame(() => App.animate());

        const delta = App.clock.getDelta();
        const time = App.clock.getElapsedTime();

        TWEEN.update();
        EffectsManager.update(delta);
        AudioManager.updateListener(BoardManager.camera);

        if (App.state === 'MENU') {
            App.menuOrbitAngle += delta * 0.08;

            // Órbita cinematográfica suave del tablero 3D de fondo
            BoardManager.camera.position.x = Math.sin(App.menuOrbitAngle) * 20;
            BoardManager.camera.position.z = Math.cos(App.menuOrbitAngle) * 20;
            BoardManager.camera.position.y = 11.5 + Math.sin(time * 0.35) * 1.2;
            BoardManager.camera.lookAt(0, 0.5, 0);
        } else {
            BoardManager.controls.update();
        }

        BoardManager.renderer.render(BoardManager.scene, BoardManager.camera);
    }
};

window.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Registro del Service Worker (PWA instalable + juego funcional sin
// conexión). Va aparte de App.init() y no bloquea el arranque: si falla
// (navegador viejo, servido por file:// en vez de http(s), etc.) el juego
// sigue funcionando normal, solo sin caché offline.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch((err) => {
            console.warn('No se pudo registrar el Service Worker (¿servido por file://?):', err.message);
        });
    });
}
