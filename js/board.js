/**
 * ==========================================================================
 * BOARD.JS - Motor 3D Three.js, Geometría Esculpida, Materiales e Iluminación
 * ==========================================================================
 */

const BoardManager = {
    container: null,
    scene: null,
    camera: null,
    renderer: null,
    controls: null,

    // Grupos de Three.js
    tableGroup: null,
    boardGroup: null,
    piecesGroup: null,
    highlightGroup: null,
    lastMoveGroup: null,
    checkGroup: null,
    heatmapGroup: null,
    effectsGroup: null,

    // Diccionarios de objetos
    squaresMap: {},
    pieceMeshes: {},
    coordLabels: [],

    // Configuración y dimensiones
    squareSize: 1.35,
    boardFlipped: false,
    currentTheme: 'elegance',
    showTrail: true,
    directorMode: true, // Modo Director Cinemático
    graphicsQuality: 'ultra', // 'ultra', 'medium', 'low'
    
    // Luces de Estudio Cinemático
    ambientLight: null,
    mainLight: null,
    fillLight: null,
    rimLight: null,
    bounceLight: null,

    // Materiales
    materials: {},

    init: function(containerId) {
        this.container = document.getElementById(containerId);
        
        // Cargar calidad gráfica guardada
        try {
            const savedQuality = localStorage.getItem('ajedrez3d_graphics_quality');
            if (savedQuality) this.graphicsQuality = savedQuality;
        } catch(e) {}

        // 1. Escena 3D
        this.scene = new THREE.Scene();
        this.setupEnvironment('elegance');

        // 2. Cámara (Perspectiva cinematográfica de alta definición)
        this.camera = new THREE.PerspectiveCamera(
            38,
            window.innerWidth / window.innerHeight,
            0.1,
            300
        );
        // Ángulo más cenital que el original (0,19,18): con esa inclinación las
        // piezas altas de la fila trasera (más cerca de la cámara) tapaban a los
        // peones detrás de ellas, sobre todo con el tablero completo (aperturas).
        // Mismo ángulo que antes (y:z ≈ 2.7:1) pero más cerca, para que el
        // tablero sea el protagonista de la pantalla en vez de verse pequeño
        // en medio de tanto fondo estrellado. La distancia real se escala con
        // getResponsiveCameraDistanceFactor() - en ventanas bajas (portátiles
        // en horizontal, pantallas panorámicas cortas) la barra de controles
        // fija de abajo ocupa un % mayor de la pantalla, así que hay que
        // alejar un poco la cámara para que no tape la fila de piezas.
        this._lastCameraDistanceFactor = this.getResponsiveCameraDistanceFactor();
        const f0 = this._lastCameraDistanceFactor;
        this.camera.position.set(0, 19 * f0, 7.1 * f0);

        // 3. Renderer WebGL con tone mapping fílmico y sombras suaves
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.08;
        this.container.appendChild(this.renderer.domElement);

        // 4. OrbitControls con amortiguación suave
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2.18; // Evita mirar por debajo del tablero
        this.controls.minDistance = 7;
        this.controls.maxDistance = 45;
        this.controls.target.set(0, 0.4, 0);

        // 5. Iluminación de Estudio Estable y Cinemática
        this.setupLighting();

        // 6. Grupos de escena organizados
        this.tableGroup = new THREE.Group();
        this.scene.add(this.tableGroup);

        this.boardGroup = new THREE.Group();
        this.tableGroup.add(this.boardGroup);

        this.piecesGroup = new THREE.Group();
        this.tableGroup.add(this.piecesGroup);

        this.highlightGroup = new THREE.Group();
        this.tableGroup.add(this.highlightGroup);

        this.lastMoveGroup = new THREE.Group();
        this.tableGroup.add(this.lastMoveGroup);

        this.checkGroup = new THREE.Group();
        this.tableGroup.add(this.checkGroup);

        this.heatmapGroup = new THREE.Group();
        this.tableGroup.add(this.heatmapGroup);

        this.effectsGroup = new THREE.Group();
        this.scene.add(this.effectsGroup);

        // 7. Inicialización de Materiales Sólidos y Tablero
        this.initMaterials();
        this.buildBoard();

        // 8. Aplicar Calidad Gráfica
        this.setGraphicsQuality(this.graphicsQuality, false);

        // 9. Evento Resize
        window.addEventListener('resize', () => this.onResize());
    },

    setupEnvironment: function(themeKey) {
        this.currentTheme = themeKey;
        if (themeKey === 'cyber') {
            this.scene.background = new THREE.Color(0x060914);
            this.scene.fog = new THREE.FogExp2(0x060914, 0.010);
        } else if (themeKey === 'royal') {
            this.scene.background = new THREE.Color(0x180e15);
            this.scene.fog = new THREE.FogExp2(0x180e15, 0.010);
        } else {
            // Elegance Estudio (Fondo profundo con viñeta azul grafito)
            this.scene.background = new THREE.Color(0x0b0f19);
            this.scene.fog = new THREE.FogExp2(0x0b0f19, 0.009);
        }
    },

    setupLighting: function() {
        // 1. Luz Hemisférica ambiental (difusa, suave y equilibrada)
        const hemiLight = new THREE.HemisphereLight(0xeef2ff, 0x111625, 0.75);
        this.scene.add(hemiLight);

        // 2. Luz Ambiental
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
        this.scene.add(this.ambientLight);

        // 3. Luz Principal de Estudio (Key SpotLight Fija y Estable en ángulo de 3/4)
        this.mainLight = new THREE.SpotLight(0xfff7ea, 2.1);
        this.mainLight.position.set(6, 22, 14);
        this.mainLight.angle = Math.PI / 3.4;
        this.mainLight.penumbra = 0.85;
        this.mainLight.castShadow = true;
        this.mainLight.shadow.mapSize.width = 2048;
        this.mainLight.shadow.mapSize.height = 2048;
        this.mainLight.shadow.bias = -0.0001;
        this.mainLight.shadow.radius = 3.5;
        this.scene.add(this.mainLight);

        // 4. Luz de Relleno Suave (Fill Light en tono zafiro claro)
        this.fillLight = new THREE.DirectionalLight(0xcfdcf5, 0.75);
        this.fillLight.position.set(-14, 16, -10);
        this.scene.add(this.fillLight);

        // 5. Luz de Contorno Rasante (Rim Light en oro cálido para definir bordes y siluetas)
        this.rimLight = new THREE.PointLight(0xf5d378, 1.4, 40);
        this.rimLight.position.set(0, 5, -12);
        this.scene.add(this.rimLight);

        // 6. Luz de Rebote Inferior (Ground Bounce suave para sombras naturales)
        this.bounceLight = new THREE.DirectionalLight(0xd9b360, 0.25);
        this.bounceLight.position.set(0, -6, 0);
        this.scene.add(this.bounceLight);
    },

    initMaterials: function() {
        // Casillas Claras: Mármol satinado (antideslumbrante, con reflejo fino no cegador)
        this.materials.lightSquare = new THREE.MeshPhysicalMaterial({
            color: 0xebedf2,
            metalness: 0.05,
            roughness: 0.32,
            clearcoat: 0.45,
            clearcoatRoughness: 0.28
        });

        // Casillas Oscuras: Ébano azul medianoche profundo
        this.materials.darkSquare = new THREE.MeshPhysicalMaterial({
            color: 0x161e2e,
            metalness: 0.2,
            roughness: 0.35,
            clearcoat: 0.55,
            clearcoatRoughness: 0.25
        });

        // Base y bordes de madera noble y oro pulido
        this.materials.boardBase = new THREE.MeshPhysicalMaterial({
            color: 0x090c12,
            metalness: 0.4,
            roughness: 0.45,
            clearcoat: 0.4
        });

        this.materials.boardBorder = new THREE.MeshPhysicalMaterial({
            color: 0xd4af37,
            metalness: 0.88,
            roughness: 0.22,
            clearcoat: 0.9,
            emissive: 0x281c04,
            emissiveIntensity: 0.2
        });

        // Acentos dorados metálicos para detalles de piezas y bordes
        this.materials.goldAccent = new THREE.MeshPhysicalMaterial({
            color: 0xdfb542,
            metalness: 0.92,
            roughness: 0.18,
            clearcoat: 0.95,
            clearcoatRoughness: 0.1
        });

        // =====================================================================
        // PIEZAS BLANCAS: Marfil Imperial / Mármol Perlado 100% SÓLIDO
        // (Sin transparencia, bordes nítidos y relieve tridimensional definido)
        // =====================================================================
        this.materials.whitePiece = new THREE.MeshPhysicalMaterial({
            color: 0xf5f6f8,
            metalness: 0.08,
            roughness: 0.24,
            transmission: 0.0, // Cero transparencia para máxima nitidez
            transparent: false,
            opacity: 1.0,
            clearcoat: 0.65,
            clearcoatRoughness: 0.22,
            reflectivity: 0.6
        });

        // =====================================================================
        // PIEZAS NEGRAS: Obsidiana Real / Titanio Oscuro con reflejos áureos
        // =====================================================================
        this.materials.blackPiece = new THREE.MeshPhysicalMaterial({
            color: 0x161a24,
            metalness: 0.72,
            roughness: 0.28,
            clearcoat: 0.85,
            clearcoatRoughness: 0.18,
            emissive: 0x241a08,
            emissiveIntensity: 0.2
        });

        // Materiales de Guías y Alertas
        this.materials.validMove = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.65,
            side: THREE.DoubleSide
        });

        this.materials.lastMove = new THREE.MeshBasicMaterial({
            color: 0xd4af37,
            transparent: true,
            opacity: 0.38,
            side: THREE.DoubleSide
        });

        this.materials.selectedSquare = new THREE.MeshBasicMaterial({
            color: 0x10b981,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });

        this.materials.checkAlert = new THREE.MeshBasicMaterial({
            color: 0xf43f5e,
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide
        });
    },

    buildBoard: function() {
        const sqSize = this.squareSize;
        const totalSize = sqSize * 8;

        // Base del tablero sólida
        const baseGeo = new THREE.BoxGeometry(totalSize + 1.8, 0.7, totalSize + 1.8);
        const baseMesh = new THREE.Mesh(baseGeo, this.materials.boardBase);
        baseMesh.position.y = -0.35;
        baseMesh.receiveShadow = true;
        baseMesh.castShadow = true;
        this.boardGroup.add(baseMesh);

        // Marco biselado dorado
        const borderGeo = new THREE.BoxGeometry(totalSize + 1.4, 0.15, totalSize + 1.4);
        const borderMesh = new THREE.Mesh(borderGeo, this.materials.boardBorder);
        borderMesh.position.y = 0.01;
        borderMesh.receiveShadow = true;
        this.boardGroup.add(borderMesh);

        // Creación de las 64 casillas
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const isLight = (r + f) % 2 === 0;
                const geo = new THREE.BoxGeometry(sqSize * 0.98, 0.12, sqSize * 0.98);
                const mat = isLight ? this.materials.lightSquare : this.materials.darkSquare;
                const square = new THREE.Mesh(geo, mat);

                const x = (f - 3.5) * sqSize;
                const z = (r - 3.5) * sqSize;
                square.position.set(x, 0.06, z);
                square.receiveShadow = true;

                const sqName = files[f] + ranks[r];
                square.userData = { isSquare: true, id: sqName, fileIdx: f, rankIdx: r };
                this.squaresMap[sqName] = square;
                this.boardGroup.add(square);
            }
        }

        // Letras y números en bisel
        this.createCoordinateLabels(files, ranks, sqSize);
    },

    createCoordinateLabels: function(files, ranks, sqSize) {
        const makeLabelSprite = (text) => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 128, 128);
            ctx.font = 'bold 56px Montserrat, sans-serif';
            ctx.fillStyle = '#f5cf70';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
            ctx.shadowBlur = 6;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 64, 64);

            const texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearFilter;
            const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(0.55, 0.55, 0.55);
            return sprite;
        };

        for (let f = 0; f < 8; f++) {
            const label = makeLabelSprite(files[f]);
            label.position.set((f - 3.5) * sqSize, 0.16, 4.45 * sqSize);
            this.boardGroup.add(label);
            this.coordLabels.push(label);
        }

        for (let r = 0; r < 8; r++) {
            const label = makeLabelSprite(ranks[r]);
            label.position.set(-4.45 * sqSize, 0.16, (r - 3.5) * sqSize);
            this.boardGroup.add(label);
            this.coordLabels.push(label);
        }
    },

    // Modelado Esculpido de Piezas con Detalles de Orfebrería Dorada
    createPieceGeometry: function(type, isWhite) {
        const group = new THREE.Group();
        const mat = isWhite ? this.materials.whitePiece : this.materials.blackPiece;
        const goldMat = this.materials.goldAccent;
        const scale = 0.78;

        // 1. Base principal pesada y biselada
        const baseGeo = new THREE.CylinderGeometry(0.54, 0.64, 0.28, 36);
        const base = new THREE.Mesh(baseGeo, mat);
        base.position.y = 0.14;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        // Anillo de orfebrería en la base (Dorado en ambas para contraste escultórico)
        const ringGeo = new THREE.TorusGeometry(0.54, 0.05, 16, 36);
        const ring = new THREE.Mesh(ringGeo, goldMat);
        ring.position.y = 0.28;
        ring.rotation.x = Math.PI / 2;
        ring.castShadow = true;
        group.add(ring);

        let body, top, extra;
        switch(type) {
            case 'p': // Peón Clásico
                body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.48, 1.25, 32), mat);
                body.position.y = 0.9;
                top = new THREE.Mesh(new THREE.SphereGeometry(0.38, 32, 32), mat);
                top.position.y = 1.68;
                
                const pCollar = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 16, 32), goldMat);
                pCollar.position.y = 1.48;
                pCollar.rotation.x = Math.PI / 2;
                group.add(pCollar);
                break;

            case 'r': // Torre con Almenas
                body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.50, 1.55, 32), mat);
                body.position.y = 1.05;
                top = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.40, 0.48, 32), mat);
                top.position.y = 2.05;

                // Almenas almenadas de torre
                extra = new THREE.Group();
                for (let i = 0; i < 4; i++) {
                    const ang = (i * Math.PI) / 2;
                    const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.18), goldMat);
                    merlon.position.set(Math.cos(ang) * 0.38, 2.38, Math.sin(ang) * 0.38);
                    merlon.castShadow = true;
                    extra.add(merlon);
                }
                break;

            case 'n': // Caballo Imperial Esculpido con Crin y Orejas
                body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.50, 1.35, 32), mat);
                body.position.y = 0.95;
                
                top = new THREE.Group();
                
                // Cuello curvado
                const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.40, 0.9, 16), mat);
                neck.position.set(0, 1.55, 0.10);
                neck.rotation.x = Math.PI / 8;
                neck.castShadow = true;
                top.add(neck);

                // Crin dorada posterior
                const mane = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.85, 0.35), goldMat);
                mane.position.set(0, 1.65, -0.16);
                mane.rotation.x = Math.PI / 8;
                mane.castShadow = true;
                top.add(mane);

                // Cabeza esculpida
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.65, 0.65), mat);
                head.position.set(0, 2.05, 0.18);
                head.rotation.x = Math.PI / 6;
                head.castShadow = true;
                top.add(head);

                // Hocico estilizado
                const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.40, 0.50), mat);
                muzzle.position.set(0, 1.82, 0.52);
                muzzle.rotation.x = Math.PI / 4;
                muzzle.castShadow = true;
                top.add(muzzle);

                const muzzleAccent = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.22), goldMat);
                muzzleAccent.position.set(0, 1.68, 0.64);
                muzzleAccent.castShadow = true;
                top.add(muzzleAccent);

                // Orejas esculpidas con acabado dorado
                const earGeo = new THREE.ConeGeometry(0.08, 0.32, 12);
                const leftEar = new THREE.Mesh(earGeo, goldMat);
                leftEar.position.set(-0.13, 2.46, 0.08);
                leftEar.rotation.x = -Math.PI / 12;
                leftEar.castShadow = true;
                top.add(leftEar);

                const rightEar = new THREE.Mesh(earGeo, goldMat);
                rightEar.position.set(0.13, 2.46, 0.08);
                rightEar.rotation.x = -Math.PI / 12;
                rightEar.castShadow = true;
                top.add(rightEar);
                break;

            case 'b': // Alfil con Hendidura y Remate
                body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.50, 1.85, 32), mat);
                body.position.y = 1.22;
                top = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.98, 32), mat);
                top.position.y = 2.62;

                const bRing = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.04, 16, 32), goldMat);
                bRing.position.y = 2.15;
                bRing.rotation.x = Math.PI / 2;
                group.add(bRing);

                extra = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 20), goldMat);
                extra.position.y = 3.18;
                break;

            case 'q': // Dama Majestuosa con Corona
                body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.54, 2.25, 32), mat);
                body.position.y = 1.42;
                top = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.24, 0.58, 32), mat);
                top.position.y = 2.82;

                const qCrown = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 16, 32), goldMat);
                qCrown.position.y = 3.08;
                qCrown.rotation.x = Math.PI / 2;
                group.add(qCrown);

                extra = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 32), goldMat);
                extra.position.y = 3.28;
                break;

            case 'k': // Rey con Cruz Imperial
                body = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.56, 2.55, 32), mat);
                body.position.y = 1.55;
                top = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.34, 0.48, 32), mat);
                top.position.y = 3.02;

                extra = new THREE.Group();
                const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.70, 0.14), goldMat);
                const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.14, 0.14), goldMat);
                extra.add(crossV, crossH);
                extra.position.y = 3.62;
                break;
        }

        if (body) { body.castShadow = true; body.receiveShadow = true; group.add(body); }
        if (top) { 
            if (top.castShadow !== undefined) { top.castShadow = true; top.receiveShadow = true; }
            group.add(top); 
        }
        if (extra) {
            if (extra.castShadow !== undefined) { extra.castShadow = true; extra.receiveShadow = true; }
            else { extra.children.forEach(c => { c.castShadow = true; c.receiveShadow = true; }); }
            group.add(extra);
        }

        group.scale.set(scale, scale, scale);
        group.position.y = 0.15;
        return group;
    },

    // Renderizar todas las piezas en el tablero
    renderBoardPieces: function(boardState) {
        while (this.piecesGroup.children.length > 0) {
            this.piecesGroup.remove(this.piecesGroup.children[0]);
        }
        this.pieceMeshes = {};

        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const piece = boardState[r][f];
                if (piece) {
                    const sqName = files[f] + ranks[r];
                    const mesh = this.createPieceGeometry(piece.type, piece.color === 'w');
                    const sqPos = this.squaresMap[sqName].position;
                    mesh.position.set(sqPos.x, 0.15, sqPos.z);
                    if (piece.type === 'n') {
                        mesh.rotation.y = piece.color === 'w' ? Math.PI : 0;
                    }
                    mesh.userData = { isPiece: true, type: piece.type, color: piece.color, square: sqName };
                    this.piecesGroup.add(mesh);
                    this.pieceMeshes[sqName] = mesh;
                }
            }
        }
    },

    // Indicadores de movimiento holográficos 3D (Distinción entre Movimiento y Captura)
    showValidMoves: function(moves) {
        this.clearHighlights();
        if (!this.showTrail) return;

        moves.forEach(m => {
            if (!this.squaresMap[m.to]) return;
            const sqPos = this.squaresMap[m.to].position;
            const isCapture = (m.captured || (m.flags && (m.flags.includes('c') || m.flags.includes('e'))));

            const moveMarkerGroup = new THREE.Group();
            moveMarkerGroup.position.set(sqPos.x, 0.21, sqPos.z);
            moveMarkerGroup.userData = { isSquare: true, id: m.to };

            if (isCapture) {
                // Mira de Combate / Anillo de Captura Holográfico Carmesí
                const captureRingGeo = new THREE.RingGeometry(0.44, 0.56, 32);
                const captureRingMat = new THREE.MeshBasicMaterial({
                    color: 0xf43f5e,
                    transparent: true,
                    opacity: 0.85,
                    side: THREE.DoubleSide
                });
                const captureRing = new THREE.Mesh(captureRingGeo, captureRingMat);
                captureRing.rotation.x = -Math.PI / 2;
                moveMarkerGroup.add(captureRing);

                // Cuatro esquinas de mira táctica
                for (let i = 0; i < 4; i++) {
                    const ang = (i * Math.PI) / 2 + Math.PI / 4;
                    const nodeGeo = new THREE.BoxGeometry(0.08, 0.12, 0.08);
                    const nodeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                    const node = new THREE.Mesh(nodeGeo, nodeMat);
                    node.position.set(Math.cos(ang) * 0.52, 0.06, Math.sin(ang) * 0.52);
                    moveMarkerGroup.add(node);
                }

                new TWEEN.Tween(moveMarkerGroup.scale)
                    .to({ x: 1.18, y: 1.18, z: 1.18 }, 600)
                    .yoyo(true)
                    .repeat(Infinity)
                    .easing(TWEEN.Easing.Quadratic.InOut)
                    .start();
            } else {
                // Casilla Libre: Anillo holográfico cian flotante + Punto central de luz
                const dotGeo = new THREE.CircleGeometry(0.16, 24);
                const dotMat = new THREE.MeshBasicMaterial({
                    color: 0x38bdf8,
                    transparent: true,
                    opacity: 0.9,
                    side: THREE.DoubleSide
                });
                const dot = new THREE.Mesh(dotGeo, dotMat);
                dot.rotation.x = -Math.PI / 2;
                moveMarkerGroup.add(dot);

                const ringGeo = new THREE.TorusGeometry(0.46, 0.035, 16, 36);
                const ringMat = new THREE.MeshBasicMaterial({
                    color: 0x38bdf8,
                    transparent: true,
                    opacity: 0.65
                });
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.rotation.x = Math.PI / 2;
                moveMarkerGroup.add(ring);

                new TWEEN.Tween(moveMarkerGroup.position)
                    .to({ y: 0.35 }, 750)
                    .yoyo(true)
                    .repeat(Infinity)
                    .easing(TWEEN.Easing.Quadratic.InOut)
                    .start();
            }

            this.highlightGroup.add(moveMarkerGroup);
        });
    },

    showSelectedSquare: function(sqName) {
        if (!this.squaresMap[sqName]) return;
        const sqPos = this.squaresMap[sqName].position;

        const selGroup = new THREE.Group();
        selGroup.position.set(sqPos.x, 0.20, sqPos.z);
        selGroup.userData = { isSquare: true, id: sqName };

        // Plano de suelo luminoso
        const geo = new THREE.PlaneGeometry(this.squareSize * 0.94, this.squareSize * 0.94);
        const plane = new THREE.Mesh(geo, this.materials.selectedSquare);
        plane.rotation.x = -Math.PI / 2;
        selGroup.add(plane);

        // Borde áureo de selección
        const borderGeo = new THREE.RingGeometry(0.48, 0.54, 32);
        const borderMat = new THREE.MeshBasicMaterial({
            color: 0x10b981,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
        });
        const borderRing = new THREE.Mesh(borderGeo, borderMat);
        borderRing.rotation.x = -Math.PI / 2;
        borderRing.position.y = 0.02;
        selGroup.add(borderRing);

        this.highlightGroup.add(selGroup);
    },

    clearHighlights: function() {
        while (this.highlightGroup.children.length > 0) {
            this.highlightGroup.remove(this.highlightGroup.children[0]);
        }
    },

    showLastMove: function(from, to) {
        while (this.lastMoveGroup.children.length > 0) {
            this.lastMoveGroup.remove(this.lastMoveGroup.children[0]);
        }
        if (!this.showTrail) return;
        [from, to].forEach(sq => {
            if (!this.squaresMap[sq]) return;
            const pos = this.squaresMap[sq].position;
            const geo = new THREE.PlaneGeometry(this.squareSize * 0.96, this.squareSize * 0.96);
            const plane = new THREE.Mesh(geo, this.materials.lastMove);
            plane.rotation.x = -Math.PI / 2;
            plane.position.set(pos.x, 0.17, pos.z);
            plane.userData = { isSquare: true, id: sq };
            this.lastMoveGroup.add(plane);
        });
    },

    toggleTrail: function() {
        this.showTrail = !this.showTrail;
        if (!this.showTrail) {
            while (this.lastMoveGroup.children.length > 0) {
                this.lastMoveGroup.remove(this.lastMoveGroup.children[0]);
            }
            this.clearHighlights();
        }
        return this.showTrail;
    },

    // Alerta de Jaque con anillo pulsante
    showCheckAlert: function(kingSq) {
        while (this.checkGroup.children.length > 0) {
            this.checkGroup.remove(this.checkGroup.children[0]);
        }
        if (!kingSq || !this.squaresMap[kingSq]) return;
        const pos = this.squaresMap[kingSq].position;
        const ringGeo = new THREE.TorusGeometry(0.58, 0.08, 16, 32);
        const ring = new THREE.Mesh(ringGeo, this.materials.checkAlert);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(pos.x, 0.25, pos.z);
        this.checkGroup.add(ring);

        new TWEEN.Tween(ring.scale)
            .to({ x: 1.35, y: 1.35, z: 1.35 }, 500)
            .yoyo(true)
            .repeat(Infinity)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .start();
    },

    clearCheckAlert: function() {
        while (this.checkGroup.children.length > 0) {
            this.checkGroup.remove(this.checkGroup.children[0]);
        }
    },

    flipBoard: function() {
        this.boardFlipped = !this.boardFlipped;
        new TWEEN.Tween(this.tableGroup.rotation)
            .to({ y: this.boardFlipped ? Math.PI : 0 }, 900)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .start();
    },

    // =========================================================================
    // MODOS DE CÁMARA CINEMÁTICA Y DIRECTOR
    // =========================================================================
    setCameraView: function(mode) {
        AudioManager.playCameraTransition();

        const f = this.getResponsiveCameraDistanceFactor();
        this._lastCameraDistanceFactor = f;

        if (mode === 'top') {
            // Cenital Táctica 2D/3D
            new TWEEN.Tween(this.camera.position)
                .to({ x: 0, y: 18.2 * f, z: 0.1 }, 1000)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
            new TWEEN.Tween(this.controls.target)
                .to({ x: 0, y: 0, z: 0 }, 1000)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
        } else if (mode === 'dramatic') {
            // Rasante de Combate (Eye-Level)
            new TWEEN.Tween(this.camera.position)
                .to({ x: 9, y: 6.5, z: 11 }, 1000)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
            new TWEEN.Tween(this.controls.target)
                .to({ x: 0, y: 0.8, z: 0 }, 1000)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
        } else if (mode === 'side') {
            // Lateral de Estudio
            new TWEEN.Tween(this.camera.position)
                .to({ x: 18, y: 14, z: 0 }, 1000)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
            new TWEEN.Tween(this.controls.target)
                .to({ x: 0, y: 0.4, z: 0 }, 1000)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
        } else {
            // Panorámica (por defecto): más cenital para que las piezas de la
            // fila trasera no tapen a los peones detrás de ellas, y cerca para
            // que el tablero sea el protagonista de la pantalla.
            new TWEEN.Tween(this.camera.position)
                .to({ x: 0, y: 19 * f, z: 7.1 * f }, 1000)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
            new TWEEN.Tween(this.controls.target)
                .to({ x: 0, y: 0.4, z: 0 }, 1000)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
        }
    },

    // Enfoque dinámico cinemático en jugada crítica (Capturas o Jaques)
    focusOnMove: function(targetPos) {
        if (!this.directorMode || !targetPos) return;

        const currentPos = this.camera.position.clone();
        const midTarget = new THREE.Vector3(targetPos.x * 0.4, 0.6, targetPos.z * 0.4);

        // Suave zoom-in cinemático momentáneo
        new TWEEN.Tween(this.controls.target)
            .to({ x: midTarget.x, y: midTarget.y, z: midTarget.z }, 450)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
                setTimeout(() => {
                    new TWEEN.Tween(this.controls.target)
                        .to({ x: 0, y: 0.4, z: 0 }, 800)
                        .easing(TWEEN.Easing.Quadratic.InOut)
                        .start();
                }, 900);
            })
            .start();
    },

    // Control de Calidad Gráfica Dinámica (Ultra / Media / Rendimiento)
    setGraphicsQuality: function(quality, save = true) {
        this.graphicsQuality = quality;
        if (save) {
            try {
                localStorage.setItem('ajedrez3d_graphics_quality', quality);
            } catch(e) {}
        }

        if (!this.renderer) return;

        if (quality === 'low') {
            // Rendimiento / Baja: 60 FPS en cualquier dispositivo
            this.renderer.setPixelRatio(1.0);
            this.renderer.shadowMap.enabled = false;
            if (this.mainLight) {
                this.mainLight.castShadow = false;
            }
            if (window.EffectsManager) {
                EffectsManager.setParticlesCount(0);
            }
        } else if (quality === 'medium') {
            // Equilibrada / Media: Sombras moderadas y buen framerate
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFShadowMap;
            if (this.mainLight) {
                this.mainLight.castShadow = true;
                if (this.mainLight.shadow && this.mainLight.shadow.map) {
                    this.mainLight.shadow.map.dispose();
                    this.mainLight.shadow.map = null;
                }
                this.mainLight.shadow.mapSize.width = 1024;
                this.mainLight.shadow.mapSize.height = 1024;
            }
            if (window.EffectsManager) {
                EffectsManager.setParticlesCount(60);
            }
        } else {
            // Ultra / Cinemática: Máxima fidelidad y sombras suaves
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            if (this.mainLight) {
                this.mainLight.castShadow = true;
                if (this.mainLight.shadow && this.mainLight.shadow.map) {
                    this.mainLight.shadow.map.dispose();
                    this.mainLight.shadow.map = null;
                }
                this.mainLight.shadow.mapSize.width = 2048;
                this.mainLight.shadow.mapSize.height = 2048;
            }
            if (window.EffectsManager) {
                EffectsManager.setParticlesCount(140);
            }
        }

        this.onResize();
    },

    // Cuánto alejar la cámara respecto a la distancia "de diseño" según la
    // altura de la ventana. 1 = sin cambio (ventanas altas/normales); sube
    // hasta 1.35 en ventanas bajas para que la barra de controles (altura
    // fija en píxeles) no termine tapando la fila de piezas más cercana.
    getResponsiveCameraDistanceFactor: function() {
        const referenceHeight = 820; // altura donde el tablero se ve "a tamaño"
        const minHeight = 560;       // por debajo de esto no se aleja más
        const maxFactor = 1.35;
        const h = Math.max(minHeight, Math.min(referenceHeight, window.innerHeight));
        return 1 + (referenceHeight - h) / (referenceHeight - minHeight) * (maxFactor - 1);
    },

    onResize: function() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Si la altura de la ventana cambió lo suficiente (girar una
        // tablet, cambiar de ventana...), reescalar la distancia de la
        // cámara mantiene la misma dirección/zoom que ya tenía el usuario.
        const newFactor = this.getResponsiveCameraDistanceFactor();
        if (Math.abs(newFactor - this._lastCameraDistanceFactor) > 0.01) {
            const scale = newFactor / this._lastCameraDistanceFactor;
            this.camera.position.multiplyScalar(scale);
            this._lastCameraDistanceFactor = newFactor;
        }
    }
};

window.BoardManager = BoardManager;
