/**
 * ==========================================================================
 * LEARNING.JS - Sistema de Academia, Lecciones Interactivas, Puzzles y Tutor IA
 * ==========================================================================
 */

const ACADEMY_PROGRESS_KEY = 'ajedrez3d_leccionesCompletadas';

const LearningManager = {
    currentMode: 'none', // 'lesson', 'puzzle', 'live-coach'
    activeLesson: null,
    activeLessonStep: 0,
    activePuzzle: null,
    puzzleIndex: 0,
    puzzleStreak: 0,
    puzzleScore: 0,
    completedLessons: [], // ids de lecciones terminadas, persistido en este navegador

    loadLessonProgress: function() {
        try {
            const raw = localStorage.getItem(ACADEMY_PROGRESS_KEY);
            if (raw) this.completedLessons = JSON.parse(raw);
        } catch (e) {
            console.warn('No se pudo leer el progreso de la Academia:', e);
        }
    },

    saveLessonProgress: function() {
        try {
            localStorage.setItem(ACADEMY_PROGRESS_KEY, JSON.stringify(this.completedLessons));
        } catch (e) {
            console.warn('No se pudo guardar el progreso de la Academia:', e);
        }
    },

    markLessonComplete: function(lessonId) {
        if (!this.completedLessons.includes(lessonId)) {
            this.completedLessons.push(lessonId);
            this.saveLessonProgress();
        }
    },

    // ==========================================================================
    // CONOCE LAS PIEZAS - ficha de referencia rápida (nombre, valor, para qué
    // sirve y cómo se mueve). No es una lección interactiva como las de abajo,
    // es la introducción antes de practicar el movimiento de cada una en las
    // lecciones de "Fundamentos".
    // ==========================================================================
    pieceGuide: [
        {
            glyph: '♔',
            name: 'Rey',
            value: 'Invaluable',
            role: 'La pieza que hay que proteger siempre. Si la dejan en jaque mate, pierdes la partida.',
            moves: 'Se mueve una sola casilla en cualquier dirección (horizontal, vertical o diagonal).'
        },
        {
            glyph: '♕',
            name: 'Dama',
            value: '9 puntos',
            role: 'La pieza más poderosa del tablero: combina el alcance de la torre y el alfil.',
            moves: 'Se mueve en línea recta o en diagonal, tantas casillas como quieras.'
        },
        {
            glyph: '♖',
            name: 'Torre',
            value: '5 puntos',
            role: 'Clave en los finales de partida y en el enroque con el rey.',
            moves: 'Se mueve en línea recta, horizontal o vertical, cualquier número de casillas.'
        },
        {
            glyph: '♗',
            name: 'Alfil',
            value: '3 puntos',
            role: 'Cada bando tiene dos: uno de casillas claras y otro de oscuras.',
            moves: 'Se desliza en diagonal, siempre por casillas del mismo color.'
        },
        {
            glyph: '♘',
            name: 'Caballo',
            value: '3 puntos',
            role: 'La única pieza capaz de saltar por encima de las demás.',
            moves: 'Se mueve en forma de "L": dos casillas en una dirección y una en perpendicular.'
        },
        {
            glyph: '♙',
            name: 'Peón',
            value: '1 punto',
            role: 'El más numeroso (8 por bando). Si llega a la última fila, corona y se convierte en otra pieza.',
            moves: 'Avanza una casilla al frente (dos en su primer movimiento) y captura en diagonal.'
        }
    ],

    // ==========================================================================
    // CATÁLOGO DE LECCIONES INTERACTIVAS 3D
    // ==========================================================================
    lessons: [
        // CATEGORÍA: MOVIMIENTOS Y GEMAS
        {
            id: 'knight-gems',
            category: 'Fundamentos',
            title: 'El Salto Mágico del Caballo',
            description: 'Aprende el movimiento en "L" del caballo recolectando gemas luminosas.',
            badge: 'Básico',
            fen: '8/8/8/8/8/8/8/4N3 w - - 0 1', // Caballo en e1
            // Antes tenía d3->f5 como segundo salto, que NO es un movimiento
            // de caballo válido (2+2 en vez de 1+2) - con eso el reto era
            // imposible de completar. Ruta nueva verificada salto a salto.
            gems: ['d3', 'e5', 'g6', 'e7'],
            steps: [
                {
                    instruction: 'Mueve tu Caballo a d3 para recoger la primera gema.',
                    expectedMove: { from: 'e1', to: 'd3' },
                    hintFrom: 'e1', hintTo: 'd3',
                    explanation: '¡Genial! El caballo salta dos casillas en una dirección y una en perpendicular.'
                },
                {
                    instruction: 'Ahora salta con tu Caballo a e5, hacia el centro.',
                    expectedMove: { from: 'd3', to: 'e5' },
                    hintFrom: 'd3', hintTo: 'e5',
                    explanation: '¡Excelente! El caballo es la única pieza capaz de saltar sobre otras piezas.'
                },
                {
                    instruction: 'Salta a g6 para capturar la tercera gema.',
                    expectedMove: { from: 'e5', to: 'g6' },
                    hintFrom: 'e5', hintTo: 'g6',
                    explanation: '¡Perfecto! Dominas las bifurcaciones y esquinas del caballo.'
                },
                {
                    instruction: 'Completa el entrenamiento saltando a e7.',
                    expectedMove: { from: 'g6', to: 'e7' },
                    hintFrom: 'g6', hintTo: 'e7',
                    explanation: '¡Reto completado! El caballo siempre cambia el color de su casilla en cada salto.'
                }
            ]
        },

        {
            id: 'rook-gems',
            category: 'Fundamentos',
            title: 'La Fuerza de la Torre',
            description: 'Domina el movimiento en línea recta -horizontal y vertical- de la torre.',
            badge: 'Básico',
            fen: '8/8/8/8/8/8/8/4R3 w - - 0 1', // Torre en e1
            gems: ['e5', 'a5', 'a8', 'h8'],
            steps: [
                {
                    instruction: 'Mueve tu Torre en línea recta hacia arriba, a e5.',
                    expectedMove: { from: 'e1', to: 'e5' },
                    hintFrom: 'e1', hintTo: 'e5',
                    explanation: '¡Así es! La torre avanza cualquier número de casillas en línea recta.'
                },
                {
                    instruction: 'Ahora desplázate en horizontal hasta a5.',
                    expectedMove: { from: 'e5', to: 'a5' },
                    hintFrom: 'e5', hintTo: 'a5',
                    explanation: '¡Perfecto! También se mueve libremente a los lados, mientras no haya piezas en el camino.'
                },
                {
                    instruction: 'Sube de nuevo en vertical hasta a8.',
                    expectedMove: { from: 'a5', to: 'a8' },
                    hintFrom: 'a5', hintTo: 'a8',
                    explanation: '¡Bien! Nunca se mueve en diagonal, solo horizontal o vertical.'
                },
                {
                    instruction: 'Completa el recorrido cruzando hasta h8.',
                    expectedMove: { from: 'a8', to: 'h8' },
                    hintFrom: 'a8', hintTo: 'h8',
                    explanation: '¡Reto completado! Las torres son piezas clave al final de la partida y en el enroque.'
                }
            ]
        },
        {
            id: 'bishop-gems',
            category: 'Fundamentos',
            title: 'El Alfil y las Diagonales',
            description: 'Aprende cómo el alfil se desliza por las diagonales sin cambiar de color de casilla.',
            badge: 'Básico',
            fen: '8/8/8/8/8/8/8/4B3 w - - 0 1', // Alfil en e1
            gems: ['a5', 'd8', 'h4', 'f2'],
            steps: [
                {
                    instruction: 'Desliza tu Alfil en diagonal hasta a5.',
                    expectedMove: { from: 'e1', to: 'a5' },
                    hintFrom: 'e1', hintTo: 'a5',
                    explanation: '¡Exacto! El alfil se mueve en línea diagonal, cualquier número de casillas.'
                },
                {
                    instruction: 'Ahora sube por la otra diagonal hasta d8.',
                    expectedMove: { from: 'a5', to: 'd8' },
                    hintFrom: 'a5', hintTo: 'd8',
                    explanation: '¡Muy bien! Fíjate que siempre permanece en casillas del mismo color.'
                },
                {
                    instruction: 'Cruza el tablero en diagonal hasta h4.',
                    expectedMove: { from: 'd8', to: 'h4' },
                    hintFrom: 'd8', hintTo: 'h4',
                    explanation: '¡Gran alcance! Por eso conviene desarrollarlo temprano hacia diagonales abiertas.'
                },
                {
                    instruction: 'Termina el recorrido en f2.',
                    expectedMove: { from: 'h4', to: 'f2' },
                    hintFrom: 'h4', hintTo: 'f2',
                    explanation: '¡Reto completado! Cada bando tiene un alfil de casillas claras y otro de oscuras.'
                }
            ]
        },
        {
            id: 'queen-gems',
            category: 'Fundamentos',
            title: 'La Dama, la Pieza Más Poderosa',
            description: 'Combina línea recta y diagonal: la dama mueve como torre y alfil a la vez.',
            badge: 'Básico',
            fen: '8/8/8/8/8/8/8/4Q3 w - - 0 1', // Dama en e1
            gems: ['e8', 'a8', 'h1', 'h8'],
            steps: [
                {
                    instruction: 'Mueve tu Dama en vertical hasta e8.',
                    expectedMove: { from: 'e1', to: 'e8' },
                    hintFrom: 'e1', hintTo: 'e8',
                    explanation: '¡Así es! Como la torre, la dama domina filas y columnas completas.'
                },
                {
                    instruction: 'Desplázate en horizontal hasta a8.',
                    expectedMove: { from: 'e8', to: 'a8' },
                    hintFrom: 'e8', hintTo: 'a8',
                    explanation: '¡Perfecto! Ninguna otra pieza controla tantas casillas a la vez.'
                },
                {
                    instruction: 'Ahora cruza toda la diagonal larga hasta h1.',
                    expectedMove: { from: 'a8', to: 'h1' },
                    hintFrom: 'a8', hintTo: 'h1',
                    explanation: '¡Excelente! Como el alfil, también domina diagonales completas.'
                },
                {
                    instruction: 'Sube en vertical para terminar en h8.',
                    expectedMove: { from: 'h1', to: 'h8' },
                    hintFrom: 'h1', hintTo: 'h8',
                    explanation: '¡Reto completado! Por su poder, evita sacarla demasiado pronto: puede volverse un blanco fácil.'
                }
            ]
        },
        {
            id: 'pawn-gems',
            category: 'Fundamentos',
            title: 'El Peón: Avance y Captura',
            description: 'El peón avanza de frente pero solo captura en diagonal. Aprende su regla especial.',
            badge: 'Básico',
            fen: '8/8/8/3p4/8/8/4P3/8 w - - 0 1', // Peón blanco en e2, peón negro en d5
            steps: [
                {
                    instruction: 'En su primer movimiento, el peón puede avanzar dos casillas: juega e2 a e4.',
                    expectedMove: { from: 'e2', to: 'e4' },
                    hintFrom: 'e2', hintTo: 'e4',
                    explanation: '¡Bien! Solo en su primera jugada el peón puede avanzar dos casillas de un salto.'
                },
                {
                    instruction: 'El peón negro de d5 está a tu alcance en diagonal. ¡Cáptúralo!',
                    expectedMove: { from: 'e4', to: 'd5' },
                    hintFrom: 'e4', hintTo: 'd5',
                    explanation: '¡Captura perfecta! El peón nunca captura de frente, solo en diagonal hacia adelante.'
                }
            ]
        },
        {
            id: 'king-castling',
            category: 'Fundamentos',
            title: 'El Rey y el Enroque',
            description: 'El movimiento más importante para la seguridad de tu Rey: el enroque.',
            badge: 'Básico',
            fen: '8/8/8/8/8/8/8/4K2R w K - 0 1', // Rey en e1, Torre en h1, con derecho a enrocar corto
            steps: [
                {
                    instruction: 'Enroca corto moviendo tu Rey dos casillas hacia la Torre: juega e1 a g1.',
                    expectedMove: { from: 'e1', to: 'g1' },
                    hintFrom: 'e1', hintTo: 'g1',
                    explanation: '¡Enroque completado! El Rey y la Torre se mueven juntos en una sola jugada: el Rey queda protegido y la Torre entra en acción.'
                }
            ]
        },

        // CATEGORÍA: TÁCTICAS FUNDAMENTALES
        {
            id: 'tactic-fork',
            category: 'Tácticas',
            title: 'La Horquilla o Doble Ataque',
            description: 'Ataca dos piezas enemigas al mismo tiempo con una sola jugada.',
            badge: 'Táctica',
            fen: 'r3k3/8/8/4N3/8/8/8/4K3 w - - 0 1', // Caballo en e5, Rey en e8, Torre en a8
            steps: [
                {
                    instruction: 'Mueve el Caballo a c6 para hacer jaque al Rey y atacar a la Torre a la vez.',
                    expectedMove: { from: 'e5', to: 'c6' },
                    hintFrom: 'e5', hintTo: 'c6',
                    explanation: '¡Horquilla devastadora! Las Negras están obligadas a mover su Rey, perdiendo la Torre.'
                }
            ]
        },
        {
            id: 'tactic-pin',
            category: 'Tácticas',
            title: 'La Clavada (The Pin)',
            description: 'Inmoviliza una pieza rival porque detrás de ella hay un objetivo de mayor valor.',
            badge: 'Táctica',
            fen: '4k3/8/8/3n4/8/8/8/B3K3 w - - 0 1', // Alfil en a1, Caballo en d5, Rey en e8
            steps: [
                {
                    instruction: 'Mueve tu Alfil a e5 para clavar al Caballo contra el Rey negro.',
                    expectedMove: { from: 'a1', to: 'e5' },
                    hintFrom: 'a1', hintTo: 'e5',
                    explanation: '¡Clavada absoluta! El caballo no puede moverse legalmente porque dejaría al Rey en jaque.'
                }
            ]
        },
        {
            id: 'tactic-backrank',
            category: 'Tácticas',
            title: 'Mate del Pasillo (Back-Rank Mate)',
            description: 'Aprovecha que los peones del rival atrapan a su propio Rey en la octava fila.',
            badge: 'Jaque Mate',
            fen: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', // Torre en a1, Rey negro en g8 con peones f7,g7,h7
            steps: [
                {
                    instruction: 'Lleva tu Torre a la octava fila (a8) para dar jaque mate.',
                    expectedMove: { from: 'a1', to: 'a8' },
                    hintFrom: 'a1', hintTo: 'a8',
                    explanation: '¡Jaque Mate! Los propios peones negros le impiden al Rey escapar del ataque frontal.'
                }
            ]
        },

        {
            id: 'opening-italian',
            category: 'Aperturas',
            title: 'Apertura Italiana',
            description: 'Domina el centro del tablero y desarrolla tus piezas rápidamente hacia el punto débil f7.',
            badge: 'Apertura',
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            steps: [
                {
                    instruction: 'Abre con el Peón de Rey a e4 para controlar el centro.',
                    expectedMove: { from: 'e2', to: 'e4' },
                    hintFrom: 'e2', hintTo: 'e4',
                    autoResponse: { from: 'e7', to: 'e5' },
                    explanation: 'Controlas el centro (d5 y f5) y abres paso para tu Alfil y Dama.'
                },
                {
                    instruction: 'Desarrolla tu Caballo a f3 atacando el peón de e5.',
                    expectedMove: { from: 'g1', to: 'f3' },
                    hintFrom: 'g1', hintTo: 'f3',
                    autoResponse: { from: 'b8', to: 'c6' },
                    explanation: 'Desarrollo con amenaza: obligas a las negras a defender su peón.'
                },
                {
                    instruction: 'Coloca tu Alfil en c4 apuntando a la casilla vulnerable f7.',
                    expectedMove: { from: 'f1', to: 'c4' },
                    hintFrom: 'f1', hintTo: 'c4',
                    explanation: '¡Posición de la Apertura Italiana completada! Tienes control central y miras a f7.'
                }
            ]
        },
        {
            id: 'opening-sicilian',
            category: 'Aperturas',
            title: 'Defensa Siciliana (Variante Abierta)',
            description: 'La respuesta más combativa contra 1. e4: lucha asimétrica e intensa por el centro.',
            badge: 'Apertura',
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            steps: [
                {
                    instruction: 'Inicia con 1. e4 para reclamar el centro.',
                    expectedMove: { from: 'e2', to: 'e4' },
                    hintFrom: 'e2', hintTo: 'e4',
                    autoResponse: { from: 'c7', to: 'c5' },
                    explanation: 'Las Negras responden con c5 (Defensa Siciliana), evitando la simetría.'
                },
                {
                    instruction: 'Juega 2. Cf3 preparando el avance central d4.',
                    expectedMove: { from: 'g1', to: 'f3' },
                    hintFrom: 'g1', hintTo: 'f3',
                    autoResponse: { from: 'd7', to: 'd6' },
                    explanation: 'Preparas la ruptura en d4 con apoyo de tu caballo.'
                },
                {
                    instruction: 'Abre el centro con 3. d4 para abrir diagonales y columnas.',
                    expectedMove: { from: 'd2', to: 'd4' },
                    hintFrom: 'd2', hintTo: 'd4',
                    autoResponse: { from: 'c5', to: 'd4' },
                    explanation: 'Ruptura central clásica. Las Negras capturan en d4.'
                },
                {
                    instruction: 'Recaptura con el Caballo en d4.',
                    expectedMove: { from: 'f3', to: 'd4' },
                    hintFrom: 'f3', hintTo: 'd4',
                    explanation: '¡Variante Abierta de la Siciliana completada! Tu caballo centralizado domina casillas clave.'
                }
            ]
        },
        {
            id: 'opening-queens-gambit',
            category: 'Aperturas',
            title: 'Gambito de Dama',
            description: 'Ofrece un peón de flanco para lograr el control absoluto de las casillas centrales.',
            badge: 'Apertura',
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            steps: [
                {
                    instruction: 'Abre con 1. d4 para establecer tu peón en el centro.',
                    expectedMove: { from: 'd2', to: 'd4' },
                    hintFrom: 'd2', hintTo: 'd4',
                    autoResponse: { from: 'd7', to: 'd5' },
                    explanation: 'Las Negras replican con d5 en sólida defensa central.'
                },
                {
                    instruction: 'Ofrece el Gambito de Dama con 2. c4 desafiando el peón negro.',
                    expectedMove: { from: 'c2', to: 'c4' },
                    hintFrom: 'c2', hintTo: 'c4',
                    autoResponse: { from: 'e7', to: 'e6' },
                    explanation: 'Las Negras rehúsan el gambito protegiendo su peón con e6.'
                },
                {
                    instruction: 'Desarrolla tu Caballo a c3 incrementando la presión central.',
                    expectedMove: { from: 'b1', to: 'c3' },
                    hintFrom: 'b1', hintTo: 'c3',
                    explanation: '¡Estructura del Gambito de Dama dominada! Controlas el centro con piezas activas.'
                }
            ]
        },
        {
            id: 'opening-french',
            category: 'Aperturas',
            title: 'Defensa Francesa',
            description: 'Estructura sólida de peones y contraataque sobre el flanco de dama blanco.',
            badge: 'Apertura',
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            steps: [
                {
                    instruction: 'Juega 1. e4.',
                    expectedMove: { from: 'e2', to: 'e4' },
                    hintFrom: 'e2', hintTo: 'e4',
                    autoResponse: { from: 'e7', to: 'e6' },
                    explanation: 'Las Negras responden con e6, la clásica Defensa Francesa.'
                },
                {
                    instruction: 'Ocupa el centro total con 2. d4.',
                    expectedMove: { from: 'd2', to: 'd4' },
                    hintFrom: 'd2', hintTo: 'd4',
                    autoResponse: { from: 'd7', to: 'd5' },
                    explanation: 'Las Negras desafían tu centro inmediatamente con d5.'
                },
                {
                    instruction: 'Defiende tu peón central desarrollando el Caballo a c3.',
                    expectedMove: { from: 'b1', to: 'c3' },
                    hintFrom: 'b1', hintTo: 'c3',
                    explanation: '¡Defensa Francesa variante principal establecida! Juego rico en planes estratégicos.'
                }
            ]
        },

        // CATEGORÍA: TÁCTICAS AVANZADAS
        {
            id: 'tactic-discovered',
            category: 'Tácticas',
            title: 'Ataque a la Descubierta',
            description: 'Mueve una pieza intermedia para liberar un rayo fulminante de una torre o alfil.',
            badge: 'Táctica',
            fen: '4k3/8/8/3N4/8/8/8/R3K3 w - - 0 1', // Caballo en d5, Torre en a1, Rey en e8
            steps: [
                {
                    instruction: 'Mueve el Caballo a c7 para dar jaque doble con el Caballo y la Torre descubierta.',
                    expectedMove: { from: 'd5', to: 'c7' },
                    hintFrom: 'd5', hintTo: 'c7',
                    explanation: '¡Ataque a la descubierta devastador! Al mover el caballo, la Torre de a1 da jaque directo.'
                }
            ]
        },
        {
            id: 'tactic-deflection',
            category: 'Tácticas',
            title: 'Desviación y Atracción',
            description: 'Obliga a la pieza guardiana enemiga a abandonar la casilla que custodia.',
            badge: 'Táctica',
            fen: '3r2k1/5ppp/8/8/8/8/1Q6/3R2K1 w - - 0 1', // Dama en b2, Torre en d1, Torre negra en d8, Rey g8
            steps: [
                {
                    instruction: 'Captura la Torre en d8 con tu propia Torre forzando la desviación.',
                    expectedMove: { from: 'd1', to: 'd8' },
                    hintFrom: 'd1', hintTo: 'd8',
                    explanation: '¡Desviación absoluta y Jaque Mate en la octava fila!'
                }
            ]
        },

        // CATEGORÍA: FINALES FUNDAMENTALES
        {
            id: 'endgame-opposition',
            category: 'Finales',
            title: 'Oposición de Reyes y Peón Pasado',
            description: 'Domina el concepto más importante de los finales: ganar la oposición.',
            badge: 'Finales',
            fen: '8/8/8/4k3/4P3/8/4K3/8 w - - 0 1', // Rey blanco e2, Peón e4, Rey negro e5
            steps: [
                {
                    instruction: 'Gana la oposición directa moviendo tu Rey a e3 detrás de tu peón.',
                    expectedMove: { from: 'e2', to: 'e3' },
                    hintFrom: 'e2', hintTo: 'e3',
                    explanation: '¡Oposición ganada! Tu Rey defiende el peón y obligará al Rey negro a ceder paso.'
                }
            ]
        }
    ],

    // ==========================================================================
    // BANCO DE PUZZLES TÁCTICOS (Desafíos Diarios)
    // ==========================================================================
    puzzles: [
        {
            id: 'puz-1',
            title: 'Mate en 1: La Dama Infiltrada',
            difficulty: 'Fácil',
            rating: 1100,
            fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1',
            solution: [{ from: 'f3', to: 'f7' }],
            explanation: '¡Dama a f7 es Jaque Mate protegido por el Alfil de c4!'
        },
        {
            id: 'puz-2',
            title: 'Gana la Dama con Clavada',
            difficulty: 'Medio',
            rating: 1350,
            fen: 'r1b1k2r/ppppqppp/2n5/8/1bPP4/2N5/PP2BPPP/R1BQK2R w KQkq - 0 1',
            solution: [{ from: 'c1', to: 'g5' }],
            explanation: '¡Alfil a g5 clava la Dama contra el Rey sin posibilidad de escape!'
        },
        {
            id: 'puz-3',
            title: 'Doble Ataque Real de Caballo',
            difficulty: 'Medio',
            rating: 1400,
            fen: 'r3k2r/ppp2ppp/2n5/3q4/3PN3/8/PP3PPP/R2QK2R w KQkq - 0 1',
            solution: [{ from: 'e4', to: 'f6' }],
            explanation: '¡Caballo a f6 da jaque al Rey y ataca a la Dama en d5!'
        },
        {
            id: 'puz-4',
            title: 'Mate del Pasillo Imparable',
            difficulty: 'Fácil',
            rating: 1200,
            fen: '3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
            solution: [{ from: 'd1', to: 'd8' }],
            explanation: '¡Torre d8 cambia torres y da Jaque Mate definitivo en la octava fila!'
        },
        {
            id: 'puz-5',
            title: 'Mate de Anastasia',
            difficulty: 'Difícil',
            rating: 1550,
            fen: '5rk1/1p3ppp/8/3N4/8/8/5PPP/1R4K1 w - - 0 1',
            solution: [{ from: 'd5', to: 'e7' }],
            explanation: '¡Caballo e7+ da jaque implacable acorralando al Rey en la esquina!'
        },
        {
            id: 'puz-6',
            title: 'Sacrificio de Dama por Mate',
            difficulty: 'Medio',
            rating: 1450,
            fen: '4r1k1/5ppp/8/8/8/8/1Q3PPP/4R1K1 w - - 0 1',
            solution: [{ from: 'b2', to: 'b8' }],
            explanation: '¡Dama a b8 clava y sobrecarga la defensa negra para un mate limpio en el pasillo!'
        },
        {
            id: 'puz-7',
            title: 'Doble Ataque con Clavada',
            difficulty: 'Medio',
            rating: 1380,
            fen: 'r1b1k2r/pppp1ppp/8/4q3/1bP5/2N5/PP1BPPPP/R2QKB1R w KQkq - 0 1',
            solution: [{ from: 'c3', to: 'd5' }],
            explanation: '¡Caballo d5 ataca la Dama y amenaza la casilla c7 con horquilla real!'
        },
        {
            id: 'puz-8',
            title: 'Desviación Mortal en la Octava Fila',
            difficulty: 'Fácil',
            rating: 1250,
            fen: '6k1/5ppp/r7/8/8/8/1Q3PPP/6K1 w - - 0 1',
            solution: [{ from: 'b2', to: 'b8' }],
            explanation: '¡Dama b8 aprovecha la desviación de la torre y sentencia la partida en mate!'
        }
    ],

    // ==========================================================================
    // CONTROLADOR DE LECCIONES
    // ==========================================================================
    startLesson: function(lessonId) {
        const lesson = this.lessons.find(l => l.id === lessonId);
        if (!lesson) return;

        this.currentMode = 'lesson';
        this.activeLesson = lesson;
        this.activeLessonStep = 0;

        // El banner de la lección ya deja claro en qué modo estás y qué hacer;
        // el indicador de turno normal ("Turno de las Blancas") solo confundía.
        const statusIndicator = document.getElementById('status-indicator');
        if (statusIndicator) statusIndicator.style.display = 'none';

        // Cancela cualquier jugada de IA pendiente de la partida anterior antes de
        // cargar la lección, para que no aterrice sola sobre el tablero de la lección.
        UIManager.cancelPendingAIMove();

        // Cargar posición FEN en el motor
        EngineManager.reset(lesson.fen);
        BoardManager.renderBoardPieces(EngineManager.board());
        BoardManager.clearHighlights();
        BoardManager.clearCheckAlert();
        EffectsManager.clearMoveArc();
        EffectsManager.clearTrainingGems();

        // Mostrar gemas si la lección las contiene
        if (lesson.gems) {
            lesson.gems.forEach(g => EffectsManager.addTrainingGem(g));
        }

        this.updateLessonBanner();
        this.showCurrentStepHint();
        AudioManager.playClick();
    },

    updateLessonBanner: function() {
        const banner = document.getElementById('lesson-banner');
        if (!banner || !this.activeLesson) {
            if (banner) banner.style.display = 'none';
            return;
        }

        const step = this.activeLesson.steps[this.activeLessonStep];
        banner.style.display = 'block';
        banner.querySelector('.banner-step-title').textContent = `${this.activeLesson.title} (${this.activeLessonStep + 1}/${this.activeLesson.steps.length})`;
        banner.querySelector('.banner-step-instruction').textContent = step.instruction;
    },

    showCurrentStepHint: function() {
        if (!this.activeLesson) return;
        const step = this.activeLesson.steps[this.activeLessonStep];
        if (step.hintFrom && step.hintTo) {
            EffectsManager.drawMoveArc(step.hintFrom, step.hintTo, 0xf5cf70);
            AudioManager.playHint();
        }
    },

    // Reescribe el turno actual del motor sin tocar la posición de las
    // piezas - se usa para las lecciones de una sola pieza (ver más abajo).
    // También limpia el objetivo de "captura al paso": si el paso anterior
    // fue el avance doble de un peón, ese campo del FEN queda apuntando al
    // bando contrario y chess.js RECHAZA cargar un FEN con un objetivo de
    // al paso que no coincide con el turno forzado.
    _forceTurn: function(color) {
        const parts = EngineManager.game.fen().split(' ');
        parts[1] = color;
        parts[3] = '-';
        EngineManager.game.load(parts.join(' '));
    },

    handleLessonMove: function(from, to) {
        if (!this.activeLesson) return false;
        const step = this.activeLesson.steps[this.activeLessonStep];
        // Color de quien hace esta jugada - se necesita más abajo para
        // devolverle el turno a la misma pieza en el siguiente paso (ver
        // _forceTurn), ya que EngineManager.move() lo cambia automáticamente.
        const moverColor = EngineManager.turn();

        if (step.expectedMove.from === from && step.expectedMove.to === to) {
            // Movimiento Correcto
            EffectsManager.clearMoveArc();
            // Recoger gema si existe en la casilla y generar estallido de chispas
            const gemIndex = EffectsManager.gemMeshes.findIndex(g => g.userData && g.userData.square === to);
            if (gemIndex !== -1) {
                const collectedGem = EffectsManager.gemMeshes[gemIndex];
                BoardManager.effectsGroup.remove(collectedGem);
                EffectsManager.gemMeshes.splice(gemIndex, 1);
                EffectsManager.createCaptureExplosion(BoardManager.squaresMap[to].position, true);
            }

            // Mensaje del tutor en vivo
            this.setCoachMessage(`🎉 ${step.explanation}`);

            // Avanzar paso o completar lección
            this.activeLessonStep++;
            if (this.activeLessonStep >= this.activeLesson.steps.length) {
                // Lección Completada: se guarda el progreso y se celebra con fuegos artificiales
                const finishedTitle = this.activeLesson.title;
                this.markLessonComplete(this.activeLesson.id);
                EffectsManager.createVictoryFireworks(BoardManager.squaresMap[to].position);
                AudioManager.playVictory();
                setTimeout(() => {
                    UIManager.showLessonCompleteModal(finishedTitle);
                    this.endLearningSession();
                }, 1000);
            } else {
                // Siguiente paso
                setTimeout(() => {
                    // Si el paso anterior requería respuesta automática del rival
                    if (step.autoResponse) {
                        EngineManager.move(step.autoResponse);
                        BoardManager.renderBoardPieces(EngineManager.board());
                        AudioManager.playMove(BoardManager.squaresMap[step.autoResponse.to].position);
                    } else {
                        // Sin rival que responda (lecciones de una sola pieza:
                        // caballo, torre, alfil, dama, peón): el motor de
                        // ajedrez alterna el turno tras CUALQUIER jugada real,
                        // así que sin esto la misma pieza quedaría "congelada"
                        // - imposible de volver a seleccionar - en cuanto se
                        // completa el primer paso.
                        this._forceTurn(moverColor);
                    }
                    this.updateLessonBanner();
                    this.showCurrentStepHint();
                }, 800);
            }
            return true;
        } else {
            // Movimiento Incorrecto
            this.setCoachMessage(`❌ Esa no es la jugada esperada. ¡Inténtalo de nuevo siguiendo la pista!`);
            this.showCurrentStepHint();
            return false;
        }
    },

    // ==========================================================================
    // CONTROLADOR DE PUZZLES TÁCTICOS
    // ==========================================================================
    startPuzzle: function(index = 0) {
        this.puzzleIndex = index % this.puzzles.length;
        this.activePuzzle = this.puzzles[this.puzzleIndex];
        this.currentMode = 'puzzle';

        const statusIndicator = document.getElementById('status-indicator');
        if (statusIndicator) statusIndicator.style.display = 'none';

        UIManager.cancelPendingAIMove();
        EngineManager.reset(this.activePuzzle.fen);
        BoardManager.renderBoardPieces(EngineManager.board());
        BoardManager.clearHighlights();
        BoardManager.clearCheckAlert();
        EffectsManager.clearMoveArc();
        EffectsManager.clearTrainingGems();

        const banner = document.getElementById('lesson-banner');
        if (banner) {
            banner.style.display = 'block';
            banner.querySelector('.banner-step-title').textContent = `🧩 Puzzle #${this.puzzleIndex + 1}: ${this.activePuzzle.title}`;
            banner.querySelector('.banner-step-instruction').textContent = `Encuentra la mejor jugada (Dificultad: ${this.activePuzzle.difficulty} | Rating: ${this.activePuzzle.rating})`;
        }

        this.setCoachMessage(`💡 Piensa en amenazas, piezas indefensas o jaques directos.`);
        AudioManager.playClick();
    },

    showPuzzleHint: function() {
        if (!this.activePuzzle) return;
        const sol = this.activePuzzle.solution[0];
        EffectsManager.drawMoveArc(sol.from, sol.to, 0x38bdf8);
        AudioManager.playHint();
        this.setCoachMessage(`🎯 Pista: Mueve la pieza desde ${sol.from} hacia ${sol.to}.`);
    },

    handlePuzzleMove: function(from, to) {
        if (!this.activePuzzle) return false;
        const expected = this.activePuzzle.solution[0];

        if (from === expected.from && to === expected.to) {
            // Puzzle Resuelto
            EffectsManager.clearMoveArc();
            EffectsManager.createVictoryFireworks(BoardManager.squaresMap[to].position);
            AudioManager.playSuccess();
            this.puzzleStreak++;
            this.puzzleScore += 100;
            this.updatePuzzleHUD();

            this.setCoachMessage(`✨ ¡Excelente! ${this.activePuzzle.explanation}`);

            setTimeout(() => {
                this.startPuzzle(this.puzzleIndex + 1);
            }, 1800);
            return true;
        } else {
            // Jugada Incorrecta
            this.setCoachMessage(`❌ Esa no es la jugada ganadora. ¡Busca la táctica decisiva!`);
            this.puzzleStreak = 0;
            this.updatePuzzleHUD();
            return false;
        }
    },

    updatePuzzleHUD: function() {
        const streakEl = document.getElementById('puzzle-streak-val');
        const scoreEl = document.getElementById('puzzle-score-val');
        if (streakEl) streakEl.textContent = this.puzzleStreak;
        if (scoreEl) scoreEl.textContent = this.puzzleScore;
    },

    // ==========================================================================
    // TUTOR IA EN TIEMPO REAL (Live Coach)
    // ==========================================================================
    analyzePlayerMove: function(move) {
        if (!move) return;

        // Comprobación de Jaque / Mate
        if (EngineManager.inCheckmate()) {
            this.setCoachMessage(`👑 ¡JAQUE MATE BRUTAL! Has destruido la posición rival.`);
            return;
        }
        if (EngineManager.inCheck()) {
            this.setCoachMessage(`⚡ ¡Jaque directo! El rey enemigo debe responder inmediatamente.`);
            return;
        }

        // Comprobación de Captura
        if (move.captured) {
            const pieceNames = { p: 'peón', n: 'caballo', b: 'alfil', r: 'torre', q: 'dama' };
            this.setCoachMessage(`⚔️ Has capturado un ${pieceNames[move.captured] || 'pieza'}. Buena ganancia táctica.`);
            return;
        }

        // Ocupación del Centro
        const centerSquares = ['d4', 'e4', 'd5', 'e5', 'c4', 'f4', 'c5', 'f5'];
        if (centerSquares.includes(move.to)) {
            this.setCoachMessage(`🎯 Buena ocupación central con tu ${move.piece.toUpperCase()}. El control del centro domina la partida.`);
            return;
        }

        // Desarrollo en apertura
        if (EngineManager.history().length <= 10) {
            this.setCoachMessage(`🛡️ Buen desarrollo. Recuerda enrocar a tiempo para proteger a tu Rey.`);
            return;
        }

        this.setCoachMessage(`👍 Jugada sólida. Busca coordinar tus piezas y presionar debilidades.`);
    },

    setCoachMessage: function(msg) {
        const msgEl = document.getElementById('coach-msg-text');
        if (msgEl) {
            msgEl.textContent = msg;
            msgEl.style.opacity = '0';
            setTimeout(() => msgEl.style.opacity = '1', 50);
        }
    },

    endLearningSession: function() {
        this.currentMode = 'none';
        this.activeLesson = null;
        this.activePuzzle = null;
        EffectsManager.clearMoveArc();
        EffectsManager.clearTrainingGems();
        const banner = document.getElementById('lesson-banner');
        if (banner) banner.style.display = 'none';
        const statusIndicator = document.getElementById('status-indicator');
        if (statusIndicator) statusIndicator.style.display = '';

        // Restaurar tablero normal
        UIManager.cancelPendingAIMove();
        EngineManager.reset();
        BoardManager.renderBoardPieces(EngineManager.board());
        UIManager.updateAllUI();
    }
};

LearningManager.loadLessonProgress();
window.LearningManager = LearningManager;
