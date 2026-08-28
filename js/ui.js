/**
 * ==========================================================================
 * UI.JS - Controlador de Interfaz de Usuario, HUD Cinemático y Modales Multi-Dispositivo
 * ==========================================================================
 */

const UIManager = {
    selectedSquare: null,
    validMoves: [],
    pendingPromotion: null,
    isHeatmapActive: false,
    isPvPMode: false,
    panelsVisibleMobile: false,
    _pendingAITimeout: null,
    _aiRequestToken: 0,
    _adaptiveResultRecorded: false,

    // =========================================================================
    // SISTEMA DE RELOJ DE AJEDREZ (CHESS CLOCK)
    // =========================================================================
    timeControl: 'none', // 'none', '1+0', '3+0', '3+2', '5+0', '10+0', '15+10'
    whiteTime: 300,
    blackTime: 300,
    incrementSeconds: 0,
    isClockRunning: false,
    _clockInterval: null,
    _lastClockTickTimestamp: null,
    _lastLowTimeSoundSecond: null,

    // Cancela cualquier jugada de la IA que haya quedado programada
    cancelPendingAIMove: function () {
        if (this._pendingAITimeout) {
            clearTimeout(this._pendingAITimeout);
            this._pendingAITimeout = null;
        }
        // Invalida cualquier cálculo del Worker que siga en curso: cuando
        // responda, el token ya no coincidirá y su jugada se descarta.
        this._aiRequestToken++;
        EngineManager.isAITurn = false;
        const badge = document.getElementById('ai-thinking-badge');
        if (badge) badge.style.display = 'none';
    },

    init: function () {
        this.bindEvents();
        this.renderLessonsCatalog();
        this.updateAdaptiveBadge();
        this.syncGraphicsQualityUI();
        this.setTimeControl('none');
    },

    syncGraphicsQualityUI: function() {
        const gSelect = document.getElementById('graphics-select');
        const modalGSelect = document.getElementById('modal-graphics-select');
        if (BoardManager.graphicsQuality) {
            if (gSelect) gSelect.value = BoardManager.graphicsQuality;
            if (modalGSelect) modalGSelect.value = BoardManager.graphicsQuality;
        }
    },

    bindEvents: function () {
        // Botón para Abrir Modal de Ajustes en Menú de Inicio
        const btnStartSettings = document.getElementById('btn-start-settings');
        const settingsModal = document.getElementById('settings-modal');
        const btnCloseSettingsModal = document.getElementById('btn-close-settings-modal');
        const btnSaveSettings = document.getElementById('btn-save-settings');

        const openSettingsModal = () => {
            if (!settingsModal) return;
            this.syncGraphicsQualityUI();
            const modalThemeSelect = document.getElementById('modal-theme-select');
            if (modalThemeSelect) {
                modalThemeSelect.value = BoardManager.currentTheme || 'elegance';
            }
            settingsModal.style.display = 'flex';
            AudioManager.playClick();
        };

        const closeSettingsModal = () => {
            if (!settingsModal) return;
            settingsModal.style.display = 'none';
            AudioManager.playClick();
        };

        if (btnStartSettings) btnStartSettings.addEventListener('click', openSettingsModal);
        if (btnCloseSettingsModal) btnCloseSettingsModal.addEventListener('click', closeSettingsModal);
        if (btnSaveSettings) btnSaveSettings.addEventListener('click', closeSettingsModal);

        // Selector de Control de Tiempo en Modal de Ajustes
        document.querySelectorAll('.settings-time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const timePreset = e.currentTarget.dataset.time || 'none';
                document.querySelectorAll('.settings-time-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.setTimeControl(timePreset);
                AudioManager.playClick();
            });
        });

        // Selector de Calidad Gráfica 3D (En Menú Opciones y en Modal)
        const graphicsSelect = document.getElementById('graphics-select');
        const modalGraphicsSelect = document.getElementById('modal-graphics-select');
        const handleGraphicsChange = (quality) => {
            BoardManager.setGraphicsQuality(quality);
            if (graphicsSelect) graphicsSelect.value = quality;
            if (modalGraphicsSelect) modalGraphicsSelect.value = quality;
            AudioManager.playClick();
        };

        if (graphicsSelect) {
            graphicsSelect.addEventListener('change', (e) => handleGraphicsChange(e.target.value));
        }
        if (modalGraphicsSelect) {
            modalGraphicsSelect.addEventListener('change', (e) => handleGraphicsChange(e.target.value));
        }

        // Selector de Tema en Modal
        const modalThemeSelect = document.getElementById('modal-theme-select');
        const themeSelect = document.getElementById('theme-select');
        const handleThemeChange = (theme) => {
            document.documentElement.setAttribute('data-theme', theme);
            BoardManager.setupEnvironment(theme);
            if (themeSelect) themeSelect.value = theme;
            if (modalThemeSelect) modalThemeSelect.value = theme;
            AudioManager.playClick();
        };

        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => handleThemeChange(e.target.value));
        }
        if (modalThemeSelect) {
            modalThemeSelect.addEventListener('change', (e) => handleThemeChange(e.target.value));
        }

        // Selector de Control de Tiempo en Opciones
        const timeControlSelect = document.getElementById('time-control-select');
        if (timeControlSelect) {
            timeControlSelect.addEventListener('change', (e) => {
                this.setTimeControl(e.target.value);
                AudioManager.playClick();
            });
        }

        // Botón "⚙️ Menú" que abre/cierra el panel desplegable de opciones
        const btnMenuToggle = document.getElementById('btn-menu-toggle');
        const optionsDropdown = document.getElementById('options-dropdown');
        if (btnMenuToggle && optionsDropdown) {
            btnMenuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = optionsDropdown.classList.toggle('open');
                btnMenuToggle.classList.toggle('active-tool', isOpen);
                AudioManager.playClick();
            });

            // Cerrar al hacer clic fuera del panel
            document.addEventListener('click', (e) => {
                if (!optionsDropdown.classList.contains('open')) return;
                if (optionsDropdown.contains(e.target) || e.target === btnMenuToggle) return;
                optionsDropdown.classList.remove('open');
                btnMenuToggle.classList.remove('active-tool');
            });

            // Cerrar el panel tras elegir un modo o volver al menú principal
            optionsDropdown.querySelectorAll('.mode-tab, #btn-menu-exit').forEach(el => {
                el.addEventListener('click', () => {
                    optionsDropdown.classList.remove('open');
                    btnMenuToggle.classList.remove('active-tool');
                });
            });
        }

        // Ícono "🎛️" que colapsa/expande la barra de controles (deshacer,
        // voltear, rastro, pista...) - mismo patrón que el panel de arriba,
        // para dejarle más pantalla al tablero cuando no se está usando.
        const btnControlsToggle = document.getElementById('btn-controls-toggle');
        const gameControlsBar = document.getElementById('game-controls-bar');
        if (btnControlsToggle && gameControlsBar) {
            btnControlsToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = gameControlsBar.classList.toggle('open');
                btnControlsToggle.classList.toggle('active-tool', isOpen);
                AudioManager.playClick();
            });

            // Cerrar al hacer clic fuera del panel
            document.addEventListener('click', (e) => {
                if (!gameControlsBar.classList.contains('open')) return;
                if (gameControlsBar.contains(e.target) || e.target === btnControlsToggle) return;
                gameControlsBar.classList.remove('open');
                btnControlsToggle.classList.remove('active-tool');
            });
        }

        // Selector de Dificultad de la IA
        const diffSelect = document.getElementById('difficulty-select');
        if (diffSelect) {
            diffSelect.addEventListener('change', (e) => {
                EngineManager.aiDifficulty = e.target.value;
                AudioManager.playClick();
                this.updateAdaptiveBadge();
            });
        }

        // Selector de Vistas de Cámara Cinemática
        const cameraSelect = document.getElementById('camera-select');
        if (cameraSelect) {
            cameraSelect.addEventListener('change', (e) => {
                const view = e.target.value;
                BoardManager.setCameraView(view);
            });
        }

        // Botón Modo Director Cinemático
        const btnDirector = document.getElementById('btn-director');
        if (btnDirector) {
            btnDirector.addEventListener('click', () => {
                BoardManager.directorMode = !BoardManager.directorMode;
                btnDirector.classList.toggle('active-gold', BoardManager.directorMode);
                AudioManager.playClick();
            });
        }

        // Botón Pantalla Completa (Fullscreen)
        const btnFullscreen = document.getElementById('btn-fullscreen');
        if (btnFullscreen) {
            btnFullscreen.addEventListener('click', () => {
                AudioManager.playClick();
                if (!document.fullscreenElement) {
                    if (document.documentElement.requestFullscreen) {
                        document.documentElement.requestFullscreen();
                    } else if (document.documentElement.webkitRequestFullscreen) {
                        document.documentElement.webkitRequestFullscreen();
                    }
                    btnFullscreen.textContent = '🗗';
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    }
                    btnFullscreen.textContent = '⛶';
                }
            });
        }

        // Botón Móvil / iPad para Alternar Paneles de Historial y Capturas
        const btnTogglePanels = document.getElementById('btn-toggle-panels');
        if (btnTogglePanels) {
            btnTogglePanels.addEventListener('click', () => {
                AudioManager.playClick();
                this.panelsVisibleMobile = !this.panelsVisibleMobile;
                const histPanel = document.getElementById('history-panel');
                const statsPanel = document.getElementById('stats-panel');
                if (histPanel) histPanel.classList.toggle('panel-visible', this.panelsVisibleMobile);
                if (statsPanel) statsPanel.classList.toggle('panel-visible', this.panelsVisibleMobile);
                btnTogglePanels.classList.toggle('active-gold', this.panelsVisibleMobile);
            });
        }

        // Control de Volumen y Silencio
        const btnAudio = document.getElementById('btn-audio');
        const volumeSlider = document.getElementById('volume-slider');

        if (btnAudio) {
            btnAudio.addEventListener('click', () => {
                const isMuted = AudioManager.toggleMute();
                btnAudio.textContent = isMuted ? '🔇' : '🔊';
                if (volumeSlider && isMuted) {
                    volumeSlider.value = 0;
                } else if (volumeSlider) {
                    volumeSlider.value = AudioManager.volume;
                }
            });
        }

        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                // Si el usuario sube el volumen estando silenciado, se entiende que
                // quiere oír sonido de nuevo; si no, el ícono quedaba en 🔊 aunque
                // el audio real seguía muteado por dentro.
                if (AudioManager.isMuted && val > 0) {
                    AudioManager.toggleMute();
                }
                AudioManager.setVolume(val);
                if (btnAudio) {
                    btnAudio.textContent = (val === 0 || AudioManager.isMuted) ? '🔇' : '🔊';
                }
            });
        }

        // Botón Volver al Menú Principal
        const btnMenuExit = document.getElementById('btn-menu-exit');
        if (btnMenuExit) {
            btnMenuExit.addEventListener('click', () => {
                AudioManager.playClick();
                this.cancelPendingAIMove();
                this.pauseClock();
                if (App.currentGameMode === 'online') {
                    MultiplayerManager.leaveRoom();
                }
                document.body.classList.add('menu-active');
                const startOverlay = document.getElementById('start-overlay');
                if (startOverlay) {
                    startOverlay.style.display = 'flex';
                    startOverlay.style.pointerEvents = 'auto';
                    setTimeout(() => {
                        startOverlay.style.opacity = '1';
                    }, 50);
                }
                App.state = 'MENU';
                this.setCleanPvPMode(false);
                this.setOnlineMode(false);
            });
        }

        // Pestañas de modo (Partida Clásica vs Academia vs Puzzles)
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');
                const mode = target.dataset.mode;

                if (mode === 'game') {
                    this.closeLearningDrawer();
                    LearningManager.endLearningSession();
                    this.setTimeControl(this.timeControl);
                } else if (mode === 'academy') {
                    this.pauseClock();
                    const clocksHUD = document.getElementById('chess-clocks-hud');
                    if (clocksHUD) clocksHUD.style.display = 'none';
                    this.openLearningDrawer();
                } else if (mode === 'puzzles') {
                    this.pauseClock();
                    const clocksHUD = document.getElementById('chess-clocks-hud');
                    if (clocksHUD) clocksHUD.style.display = 'none';
                    this.closeLearningDrawer();
                    LearningManager.startPuzzle(0);
                }
                AudioManager.playClick();
            });
        });

        // Botón Deshacer
        const btnUndo = document.getElementById('btn-undo');
        if (btnUndo) {
            btnUndo.addEventListener('click', () => {
                if (EngineManager.isAITurn || this.pendingPromotion) return;
                // En partidas online no se puede deshacer unilateralmente -
                // el tablero es compartido con el rival.
                if (App.currentGameMode === 'online') return;
                AudioManager.playClick();
                this.cancelPendingAIMove();
                EngineManager.undo();
                if (EngineManager.isPlayerVsAI && EngineManager.history().length > 0) {
                    EngineManager.undo();
                }
                BoardManager.renderBoardPieces(EngineManager.board());
                BoardManager.clearHighlights();
                BoardManager.clearCheckAlert();
                EffectsManager.clearMoveArc();
                this.updateAllUI();
                this.selectedSquare = null;
            });
        }

        // Botón Voltear Tablero
        const btnFlip = document.getElementById('btn-flip');
        if (btnFlip) {
            btnFlip.addEventListener('click', () => {
                AudioManager.playCameraTransition();
                BoardManager.flipBoard();
            });
        }

        // Botón Auto-Giro en Modo 2 Jugadores (Pass & Play)
        const btnAutoFlip = document.getElementById('btn-autoflip');
        if (btnAutoFlip) {
            btnAutoFlip.addEventListener('click', () => {
                App.autoFlip2Players = !App.autoFlip2Players;
                btnAutoFlip.textContent = App.autoFlip2Players ? '🔁 Auto-Giro: ON' : '🔁 Auto-Giro: OFF';
                btnAutoFlip.classList.toggle('active-tool', App.autoFlip2Players);
                AudioManager.playClick();
            });
        }

        // Botón Nueva Partida
        const btnNew = document.getElementById('btn-new');
        if (btnNew) {
            btnNew.addEventListener('click', () => {
                AudioManager.playClick();
                this.cancelPendingAIMove();
                this._adaptiveResultRecorded = false;
                EngineManager.reset();
                this.pendingPromotion = null;
                this.hidePromotionModal();
                this.hideGameOverModal();
                BoardManager.renderBoardPieces(EngineManager.board());
                BoardManager.clearHighlights();
                BoardManager.clearCheckAlert();
                EffectsManager.clearMoveArc();
                this.resetClock();
                this.updateAllUI();
                this.selectedSquare = null;
                LearningManager.endLearningSession();
            });
        }

        // Botón Pista Táctica (Hint)
        const btnHint = document.getElementById('btn-hint');
        const btnBannerHint = document.getElementById('btn-banner-hint');
        const triggerHint = async () => {
            if (LearningManager.currentMode === 'lesson') {
                LearningManager.showCurrentStepHint();
            } else if (LearningManager.currentMode === 'puzzle') {
                LearningManager.showPuzzleHint();
            } else {
                // Cálculo en segundo plano (Web Worker): la pista no congela la pantalla
                const best = await EngineManager.findBestAIMoveAsync();
                if (best) {
                    EffectsManager.drawMoveArc(best.from, best.to, 0x38bdf8);
                    AudioManager.playHint();
                    LearningManager.setCoachMessage(`💡 Pista de IA: Considera mover ${best.from} ➔ ${best.to}`);
                }
            }
        };

        if (btnHint) btnHint.addEventListener('click', triggerHint);
        if (btnBannerHint) btnBannerHint.addEventListener('click', triggerHint);

        // Botón Ocultar / Mostrar Rastro de Movimientos
        const btnTrail = document.getElementById('btn-trail');
        if (btnTrail) {
            btnTrail.addEventListener('click', () => {
                const isTrailOn = BoardManager.toggleTrail();
                btnTrail.textContent = isTrailOn ? '🎯 Rastro: ON' : '🎯 Rastro: OFF';
                btnTrail.classList.toggle('active-tool', isTrailOn);
                AudioManager.playClick();
                if (isTrailOn) {
                    const hist = EngineManager.history({ verbose: true });
                    if (hist.length > 0) {
                        const last = hist[hist.length - 1];
                        BoardManager.showLastMove(last.from, last.to);
                    }
                }
            });
        }

        // Botón Visión de Amenazas (Heatmap 3D)
        const btnHeatmap = document.getElementById('btn-heatmap');
        if (btnHeatmap) {
            btnHeatmap.addEventListener('click', () => {
                this.isHeatmapActive = !this.isHeatmapActive;
                btnHeatmap.classList.toggle('active-tool', this.isHeatmapActive);
                AudioManager.playClick();
                if (this.isHeatmapActive) {
                    const control = EngineManager.calculateSquareControl();
                    EffectsManager.renderControlHeatmap(control);
                } else {
                    EffectsManager.clearControlHeatmap();
                }
            });
        }

        // Botones de Coronación
        document.querySelectorAll('.promo-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!this.pendingPromotion) return;
                AudioManager.playClick();
                const piece = btn.dataset.piece;
                const { from, to } = this.pendingPromotion;
                this.pendingPromotion = null;
                this.hidePromotionModal();
                this.executeMove(from, to, piece);
            });
        });

        // Botón Cerrar Drawer de Academia
        const closeDrawerBtn = document.getElementById('close-drawer-btn');
        if (closeDrawerBtn) {
            closeDrawerBtn.addEventListener('click', () => this.closeLearningDrawer());
        }

        // Botones del modal de Lección Completada
        const btnLessonClose = document.getElementById('btn-lesson-complete-close');
        if (btnLessonClose) {
            btnLessonClose.addEventListener('click', () => {
                AudioManager.playClick();
                this.hideLessonCompleteModal();
            });
        }
        const btnLessonAcademy = document.getElementById('btn-lesson-complete-academy');
        if (btnLessonAcademy) {
            btnLessonAcademy.addEventListener('click', () => {
                AudioManager.playClick();
                this.hideLessonCompleteModal();
                this.openLearningDrawer();
            });
        }
    },

    setCleanPvPMode: function (isPvP) {
        this.isPvPMode = isPvP;
        const mainNavTabs = document.getElementById('main-nav-tabs');
        const aiCoachCard = document.getElementById('ai-coach-card');
        const lessonBanner = document.getElementById('lesson-banner');
        const diffSelect = document.getElementById('difficulty-select');
        const autoFlipBtn = document.getElementById('btn-autoflip');

        if (isPvP) {
            if (mainNavTabs) mainNavTabs.style.display = 'none';
            if (aiCoachCard) aiCoachCard.style.display = 'none';
            if (lessonBanner) lessonBanner.style.display = 'none';
            if (diffSelect) diffSelect.style.display = 'none';
            if (autoFlipBtn) autoFlipBtn.style.display = 'inline-flex';

            // En Jugador vs Jugador el tablero debe girar solo en cada turno
            // (pasar y jugar): por defecto activado, el jugador puede apagarlo.
            App.autoFlip2Players = true;
            if (autoFlipBtn) {
                autoFlipBtn.textContent = '🔁 Auto-Giro: ON';
                autoFlipBtn.classList.add('active-tool');
            }
        } else {
            if (mainNavTabs) mainNavTabs.style.display = 'flex';
            if (aiCoachCard && window.innerWidth > 768) aiCoachCard.style.display = 'block';
            if (diffSelect) diffSelect.style.display = 'inline-block';
            if (autoFlipBtn) autoFlipBtn.style.display = 'none';
        }
    },

    // Modo Online: parecido al PvP "limpio" (sin tutor IA ni dificultad),
    // pero SIN el auto-giro de "pasar y jugar" (cada quien tiene su propia
    // pantalla) y con Deshacer oculto (el tablero es compartido con el
    // rival) a cambio de Rendirse/Ofrecer tablas.
    setOnlineMode: function (isOnline) {
        this.isPvPMode = isOnline;
        const mainNavTabs = document.getElementById('main-nav-tabs');
        const aiCoachCard = document.getElementById('ai-coach-card');
        const lessonBanner = document.getElementById('lesson-banner');
        const diffSelect = document.getElementById('difficulty-select');
        const autoFlipBtn = document.getElementById('btn-autoflip');
        const btnUndo = document.getElementById('btn-undo');
        const onlineControls = document.querySelectorAll('.online-only-control');

        if (isOnline) {
            if (mainNavTabs) mainNavTabs.style.display = 'none';
            if (aiCoachCard) aiCoachCard.style.display = 'none';
            if (lessonBanner) lessonBanner.style.display = 'none';
            if (diffSelect) diffSelect.style.display = 'none';
            if (autoFlipBtn) autoFlipBtn.style.display = 'none';
            if (btnUndo) btnUndo.style.display = 'none';
        } else {
            if (btnUndo) btnUndo.style.display = 'inline-flex';
        }
        onlineControls.forEach(el => { el.style.display = isOnline ? 'inline-flex' : 'none'; });
    },

    openLearningDrawer: function () {
        const drawer = document.getElementById('learning-drawer');
        if (drawer) drawer.classList.add('open');
    },

    closeLearningDrawer: function () {
        const drawer = document.getElementById('learning-drawer');
        if (drawer) drawer.classList.remove('open');
    },

    renderLessonsCatalog: function () {
        const container = document.getElementById('lessons-container');
        if (!container) return;

        // Ficha de referencia "Conoce las Piezas": nombre, valor, para qué
        // sirve y cómo se mueve cada una. Va primero, antes del catálogo de
        // lecciones interactivas.
        let html = `
            <div class="lesson-category">
                <div class="category-title">Conoce las Piezas</div>
                <div class="piece-guide-grid">
                    ${LearningManager.pieceGuide.map(p => `
                        <div class="piece-guide-card">
                            <div class="piece-guide-glyph">${p.glyph}</div>
                            <div class="piece-guide-name">
                                <span>${p.name}</span>
                                <span class="piece-guide-value">${p.value}</span>
                            </div>
                            <div class="piece-guide-desc">${p.role}</div>
                            <div class="piece-guide-moves">♟️ ${p.moves}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        const categories = ['Fundamentos', 'Tácticas', 'Aperturas', 'Finales'];

        categories.forEach(cat => {
            const catLessons = LearningManager.lessons.filter(l => l.category === cat);
            if (catLessons.length === 0) return;

            html += `
                <div class="lesson-category">
                    <div class="category-title">${cat}</div>
                    ${catLessons.map(l => {
                        const done = LearningManager.completedLessons.includes(l.id);
                        return `
                        <div class="lesson-card${done ? ' completed' : ''}" data-lesson-id="${l.id}">
                            <div class="lesson-card-info">
                                <div class="lesson-name">${done ? '✅ ' : ''}${l.title}</div>
                                <div class="lesson-desc">${l.description}</div>
                            </div>
                            <span class="lesson-badge">${l.badge}</span>
                        </div>
                    `;
                    }).join('')}
                </div>
            `;
        });

        container.innerHTML = html;

        container.querySelectorAll('.lesson-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const lessonId = e.currentTarget.dataset.lessonId;
                this.closeLearningDrawer();
                LearningManager.startLesson(lessonId);
            });
        });

        this.updateAcademyProgressBadge();
    },

    updateAcademyProgressBadge: function () {
        const badge = document.getElementById('academy-progress-badge');
        if (!badge) return;
        const total = LearningManager.lessons.length;
        const done = LearningManager.completedLessons.length;
        badge.textContent = `${done}/${total} completadas`;
    },

    showLessonCompleteModal: function (lessonTitle) {
        const modal = document.getElementById('lesson-complete-modal');
        if (!modal) return;
        document.getElementById('lesson-complete-desc').textContent = `Has completado: "${lessonTitle}"`;
        modal.style.display = 'flex';
        this.renderLessonsCatalog();
    },

    hideLessonCompleteModal: function () {
        const modal = document.getElementById('lesson-complete-modal');
        if (modal) modal.style.display = 'none';
    },

    // =========================================================================
    // MÉTODOS DEL RELOJ DE AJEDREZ (CHESS CLOCK)
    // =========================================================================
    setTimeControl: function(preset) {
        this.timeControl = preset || 'none';

        const configs = {
            'none': { base: 0, inc: 0 },
            '1+0': { base: 60, inc: 0 },
            '3+0': { base: 180, inc: 0 },
            '3+2': { base: 180, inc: 2 },
            '5+0': { base: 300, inc: 0 },
            '10+0': { base: 600, inc: 0 },
            '15+10': { base: 900, inc: 10 }
        };

        const cfg = configs[this.timeControl] || configs['none'];
        this.whiteTime = cfg.base;
        this.blackTime = cfg.base;
        this.incrementSeconds = cfg.inc;
        this.pauseClock();

        // Sincronizar selectores en la UI
        const tcSelect = document.getElementById('time-control-select');
        if (tcSelect) tcSelect.value = this.timeControl;

        document.querySelectorAll('.settings-time-btn, .time-preset-btn').forEach(b => {
            b.classList.toggle('active', (b.dataset.time === this.timeControl));
        });

        // Mostrar u ocultar el HUD de relojes
        const clocksHUD = document.getElementById('chess-clocks-hud');
        if (clocksHUD) {
            if (this.timeControl !== 'none' && LearningManager.currentMode === 'none') {
                clocksHUD.style.display = 'flex';
            } else {
                clocksHUD.style.display = 'none';
            }
        }

        this.updateClockDisplays();
    },

    startClock: function() {
        if (this.timeControl === 'none' || EngineManager.gameOver() || LearningManager.currentMode !== 'none') return;
        if (this.isClockRunning) return;

        this.isClockRunning = true;
        this._lastClockTickTimestamp = Date.now();

        if (this._clockInterval) clearInterval(this._clockInterval);

        this._clockInterval = setInterval(() => {
            if (!this.isClockRunning || EngineManager.gameOver()) return;

            const now = Date.now();
            const deltaSec = (now - this._lastClockTickTimestamp) / 1000;
            this._lastClockTickTimestamp = now;

            const turn = EngineManager.turn();
            if (turn === 'w') {
                this.whiteTime = Math.max(0, this.whiteTime - deltaSec);
                if (this.whiteTime <= 0) {
                    this.handleTimeout('w');
                    return;
                }
            } else {
                this.blackTime = Math.max(0, this.blackTime - deltaSec);
                if (this.blackTime <= 0) {
                    this.handleTimeout('b');
                    return;
                }
            }

            this.updateClockDisplays();

            // Sonido de advertencia sutil cuando quedan menos de 10 segundos
            const activeTime = (turn === 'w') ? this.whiteTime : this.blackTime;
            const currentIntSec = Math.floor(activeTime);
            if (activeTime <= 10 && activeTime > 0 && currentIntSec !== this._lastLowTimeSoundSecond) {
                this._lastLowTimeSoundSecond = currentIntSec;
                AudioManager.playClockTick();
            }
        }, 100);
    },

    pauseClock: function() {
        this.isClockRunning = false;
        if (this._clockInterval) {
            clearInterval(this._clockInterval);
            this._clockInterval = null;
        }
    },

    resetClock: function() {
        this.pauseClock();
        this.setTimeControl(this.timeControl);
    },

    onMoveCompletedClock: function(colorThatMoved) {
        if (this.timeControl === 'none' || LearningManager.currentMode !== 'none') return;

        // Añadir incremento si existe
        if (this.incrementSeconds > 0) {
            if (colorThatMoved === 'w') {
                this.whiteTime += this.incrementSeconds;
            } else {
                this.blackTime += this.incrementSeconds;
            }
        }

        this.updateClockDisplays();

        if (!EngineManager.gameOver()) {
            this.startClock();
        } else {
            this.pauseClock();
        }
    },

    handleTimeout: function(color) {
        this.pauseClock();
        const winner = (color === 'w') ? 'Negras (Obsidiana)' : 'Blancas (Marfil)';
        this.showGameOverModal('¡Tiempo Agotado!', `Las ${winner} han ganado por caída de bandera.`);
        AudioManager.playVictory();
        this.recordAdaptiveOutcome(color === 'w' ? 'loss' : 'win');
    },

    formatTime: function(seconds) {
        if (seconds <= 0) return '00:00';
        const totalSec = Math.max(0, seconds);
        const m = Math.floor(totalSec / 60);
        const s = Math.floor(totalSec % 60);

        if (totalSec < 20) {
            const tenths = Math.floor((totalSec % 1) * 10);
            return `${m}:${s < 10 ? '0' : ''}${s}.${tenths}`;
        }
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    },

    updateClockDisplays: function() {
        const whiteTimerEl = document.getElementById('timer-white');
        const blackTimerEl = document.getElementById('timer-black');
        const whiteBadge = document.getElementById('clock-white');
        const blackBadge = document.getElementById('clock-black');

        if (!whiteTimerEl || !blackTimerEl || !whiteBadge || !blackBadge) return;

        whiteTimerEl.textContent = this.formatTime(this.whiteTime);
        blackTimerEl.textContent = this.formatTime(this.blackTime);

        const isWhiteTurn = (EngineManager.turn() === 'w');
        whiteBadge.classList.toggle('active', isWhiteTurn && this.isClockRunning);
        blackBadge.classList.toggle('active', !isWhiteTurn && this.isClockRunning);

        // Clases de advertencia
        whiteBadge.classList.toggle('warning', this.whiteTime <= 30 && this.whiteTime > 10);
        whiteBadge.classList.toggle('danger', this.whiteTime <= 10 && this.whiteTime > 0);

        blackBadge.classList.toggle('warning', this.blackTime <= 30 && this.blackTime > 10);
        blackBadge.classList.toggle('danger', this.blackTime <= 10 && this.blackTime > 0);
    },

    updateAllUI: function () {
        this.updateTurnStatus();
        this.updateMoveHistory();
        this.updateCapturedAndAdvantage();
        this.updateEvaluationBar();
        this.syncCheckAlert();
        this.updateClockDisplays();

        if (this.isHeatmapActive) {
            const control = EngineManager.calculateSquareControl();
            EffectsManager.renderControlHeatmap(control);
        }
    },

    updateTurnStatus: function () {
        // En lección o puzzle, el propio LearningManager controla el banner y los
        // mensajes del tutor. Las posiciones de lección suelen tener muy pocas
        // piezas (a veces sin reyes), así que el motor las detecta como "tablas
        // por material insuficiente" - sin este freno, el modal genérico de fin
        // de partida saltaba encima de la lección y la interrumpía por completo.
        if (LearningManager.currentMode !== 'none') return;

        const statusEl = document.getElementById('status-text');
        const orb = document.querySelector('.turn-orb');
        const isWhite = EngineManager.turn() === 'w';

        if (orb) {
            orb.className = isWhite ? 'turn-orb' : 'turn-orb black';
        }

        if (EngineManager.inCheckmate()) {
            const winner = isWhite ? 'Negras (Obsidiana)' : 'Blancas (Marfil)';
            statusEl.textContent = `¡JAQUE MATE! Ganan las ${winner}`;
            this.showGameOverModal(`¡JAQUE MATE!`, `Victoria épica para las ${winner}`);
            AudioManager.playVictory();
            App.triggerHaptic([100, 50, 100, 50, 200]);
            // isWhite === true significa que el bando en jaque mate es Blancas
            // (el humano), es decir, ganó la IA.
            this.recordAdaptiveOutcome(isWhite ? 'loss' : 'win');
        } else if (EngineManager.inDraw()) {
            statusEl.textContent = 'Tablas / Empate';
            this.showGameOverModal('Empate', 'La partida ha terminado en tablas.');
            this.recordAdaptiveOutcome('draw');
        } else if (EngineManager.inCheck()) {
            const playerLabel = EngineManager.isPlayerVsAI ? '' : (isWhite ? ' (Jugador 1)' : ' (Jugador 2)');
            statusEl.textContent = `¡JAQUE! Turno de las ${isWhite ? 'Blancas' : 'Negras'}${playerLabel}`;
            AudioManager.playCheck();
            App.triggerHaptic([60, 40, 60]);
        } else {
            const playerLabel = EngineManager.isPlayerVsAI ? '' : (isWhite ? ' (Jugador 1)' : ' (Jugador 2)');
            statusEl.textContent = `Turno de las ${isWhite ? 'Blancas' : 'Negras'}${playerLabel}`;
        }
    },

    // Registra el resultado de la partida en el Modo Adaptación una sola vez
    // por partida (updateTurnStatus se llama después de cada jugada, y el
    // tablero se queda en jaque mate/tablas mientras no se inicie otra).
    recordAdaptiveOutcome: function (outcome) {
        if (this._adaptiveResultRecorded) return;
        if (!EngineManager.isPlayerVsAI || EngineManager.aiDifficulty !== 'adaptive') return;
        this._adaptiveResultRecorded = true;
        EngineManager.recordAdaptiveResult(outcome);
        this.updateAdaptiveBadge();
    },

    updateAdaptiveBadge: function () {
        const badge = document.getElementById('adaptive-level-badge');
        if (!badge) return;
        if (EngineManager.aiDifficulty !== 'adaptive') {
            badge.style.display = 'none';
            return;
        }
        const a = EngineManager.adaptive;
        badge.style.display = 'inline-flex';
        badge.textContent = `🧠 Nivel IA: ${a.rating}/100 · ${a.gamesPlayed} partidas`;
    },

    syncCheckAlert: function () {
        if (EngineManager.inCheck() && !EngineManager.gameOver()) {
            const kingSq = EngineManager.findKingSquare(EngineManager.turn());
            BoardManager.showCheckAlert(kingSq);
        } else {
            BoardManager.clearCheckAlert();
        }
    },

    updateMoveHistory: function () {
        const hist = EngineManager.history();
        const container = document.getElementById('move-history');
        if (!container) return;

        let html = '';
        for (let i = 0; i < hist.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            html += `
                <div class="move-row">
                    <span class="move-num">${moveNum}.</span>
                    <span class="move-white">${hist[i] || ''}</span>
                    <span class="move-black">${hist[i + 1] || ''}</span>
                </div>
            `;
        }
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    },

    updateCapturedAndAdvantage: function () {
        const glyphs = {
            p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚'
        };
        const glyphsWhite = {
            p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔'
        };

        const data = EngineManager.getCapturedPieces();
        const whiteEl = document.getElementById('captured-by-white');
        const blackEl = document.getElementById('captured-by-black');

        if (whiteEl) {
            whiteEl.textContent = data.white.map(p => glyphs[p]).join(' ');
        }
        if (blackEl) {
            blackEl.textContent = data.black.map(p => glyphsWhite[p]).join(' ');
        }
    },

    updateEvaluationBar: function () {
        const evalWhiteEl = document.getElementById('eval-white');
        const evalBlackEl = document.getElementById('eval-black');
        if (!evalWhiteEl || !evalBlackEl) return;

        const score = EngineManager.evaluatePosition();
        let whitePct = 50 + Math.max(-45, Math.min(45, (score / 300) * 45));
        evalWhiteEl.style.width = `${whitePct}%`;
        evalBlackEl.style.width = `${100 - whitePct}%`;
    },

    showPromotionModal: function (color) {
        this.pauseClock();
        const modal = document.getElementById('promotion-modal');
        if (modal) modal.style.display = 'flex';
    },

    hidePromotionModal: function () {
        const modal = document.getElementById('promotion-modal');
        if (modal) modal.style.display = 'none';
    },

    showGameOverModal: function (title, desc) {
        const modal = document.getElementById('game-over-modal');
        if (!modal) return;
        document.getElementById('game-over-title').textContent = title;
        document.getElementById('game-over-desc').textContent = desc;
        modal.style.display = 'flex';
    },

    hideGameOverModal: function () {
        const modal = document.getElementById('game-over-modal');
        if (modal) modal.style.display = 'none';
    },

    // Ejecución de jugada con animaciones cinemáticas y auto-giro
    executeMove: function (from, to, promoPiece = 'q') {
        const move = EngineManager.move({ from, to, promotion: promoPiece });
        if (!move) return false;

        // Modo Online: subir la jugada al rival, salvo que esta misma llamada
        // sea la que está APLICANDO una jugada que ya llegó del rival (si no,
        // se la reenviaríamos de vuelta en un bucle infinito).
        if (App.currentGameMode === 'online' && !MultiplayerManager._isApplyingRemote) {
            MultiplayerManager.pushMove(move);
        }

        BoardManager.clearHighlights();
        EffectsManager.clearMoveArc();

        const pieceMesh = BoardManager.pieceMeshes[from];
        const targetPos = BoardManager.squaresMap[to].position;
        const soundPos = BoardManager.squaresMap[to].getWorldPosition(new THREE.Vector3());

        // Enfoque dinámico del Director
        if (move.captured || EngineManager.inCheck()) {
            BoardManager.focusOnMove(targetPos);
        }

        // Manejo de captura con onda de choque
        if (move.captured) {
            const capMesh = BoardManager.pieceMeshes[to];
            if (capMesh) {
                EffectsManager.createCaptureExplosion(capMesh.position, move.color !== 'w');
                BoardManager.piecesGroup.remove(capMesh);
            }
            AudioManager.playCapture(soundPos);
            App.triggerHaptic(35);
        } else {
            AudioManager.playMove(soundPos);
            App.triggerHaptic(15);
        }

        // Iniciar reloj en la primera jugada si no estaba corriendo
        if (!this.isClockRunning && this.timeControl !== 'none' && LearningManager.currentMode === 'none') {
            this.startClock();
        }

        // Animación de trayectoria física de la pieza
        if (pieceMesh) {
            new TWEEN.Tween(pieceMesh.position)
                .to({ x: targetPos.x, y: 1.7, z: targetPos.z }, 200)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onComplete(() => {
                    new TWEEN.Tween(pieceMesh.position)
                        .to({ y: 0.15 }, 200)
                        .easing(TWEEN.Easing.Bounce.Out)
                        .onComplete(() => {
                            BoardManager.renderBoardPieces(EngineManager.board());
                            BoardManager.showLastMove(from, to);
                            this.onMoveCompletedClock(move.color);
                            this.updateAllUI();

                            // Auto-giro de tablero en modo 2 jugadores si está activo
                            if (this.isPvPMode && App.autoFlip2Players && !EngineManager.gameOver()) {
                                setTimeout(() => {
                                    BoardManager.flipBoard();
                                    AudioManager.playCameraTransition();
                                }, 350);
                            }

                            // Análisis del Tutor IA (solo en partida normal vs IA).
                            if (!this.isPvPMode && LearningManager.currentMode === 'none') {
                                LearningManager.analyzePlayerMove(move);
                            }

                            // Turno de la IA si corresponde
                            if (EngineManager.isPlayerVsAI && EngineManager.turn() === 'b' && !EngineManager.gameOver()) {
                                EngineManager.isAITurn = true;
                                const badge = document.getElementById('ai-thinking-badge');
                                if (badge) badge.style.display = 'inline-flex';

                                // Token de esta petición de IA: si "Nueva Partida"/Deshacer
                                // cancelan mientras el Worker sigue calculando (puede tardar
                                // segundos), su respuesta llegaría tarde y aplicaría una
                                // jugada fantasma sobre el tablero ya reiniciado. Al volver,
                                // se compara este token contra el actual - si ya no coincide
                                // (se canceló), la respuesta se descarta.
                                const requestToken = ++this._aiRequestToken;

                                this._pendingAITimeout = setTimeout(async () => {
                                    this._pendingAITimeout = null;
                                    // Cálculo en Web Worker: no bloquea la interfaz aunque tarde
                                    const aiMove = await EngineManager.findBestAIMoveAsync();
                                    if (requestToken !== this._aiRequestToken) return; // cancelada mientras pensaba
                                    if (badge) badge.style.display = 'none';
                                    EngineManager.isAITurn = false;
                                    if (aiMove) {
                                        this.executeMove(aiMove.from, aiMove.to, aiMove.promotion || 'q');
                                    }
                                }, 550);
                            }
                        })
                        .start();
                })
                .start();
        } else {
            BoardManager.renderBoardPieces(EngineManager.board());
            BoardManager.showLastMove(from, to);
            this.onMoveCompletedClock(move.color);
            this.updateAllUI();
        }

        return true;
    }
};

window.UIManager = UIManager;
