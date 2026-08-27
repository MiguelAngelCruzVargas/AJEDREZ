/**
 * ==========================================================================
 * EFFECTS.JS - Partículas Cinemáticas, Rayos Guía 3D y Efectos Visuales
 * ==========================================================================
 */

const EffectsManager = {
    particles: [],
    ambientDust: null,
    activeArc: null,
    gemMeshes: [],
    shockwaves: [],

    init: function() {
        this.createAmbientDust();
    },

    // Polvo de luz ambiental flotante en el estudio
    createAmbientDust: function(count = 140) {
        if (this.ambientDust) {
            BoardManager.scene.remove(this.ambientDust);
            this.ambientDust = null;
        }

        if (count <= 0) return;

        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 36;
            positions[i+1] = Math.random() * 22 - 2;
            positions[i+2] = (Math.random() - 0.5) * 36;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(245, 215, 120, 0.85)');
        grad.addColorStop(0.35, 'rgba(245, 215, 120, 0.25)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.PointsMaterial({
            size: 1.1,
            map: tex,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            color: 0xf5cf70
        });

        this.ambientDust = new THREE.Points(geo, mat);
        BoardManager.scene.add(this.ambientDust);
    },

    setParticlesCount: function(count) {
        this.createAmbientDust(count);
    },

    // Destello de impacto cinemático al capturar una pieza
    createCaptureExplosion: function(pos, isWhite) {
        const count = 30;
        const geo = new THREE.SphereGeometry(0.08, 12, 12);
        const mat = new THREE.MeshBasicMaterial({
            color: isWhite ? 0xf8fafc : 0xdfb445,
            transparent: true,
            opacity: 0.9
        });

        // Onda de choque expansiva en el plano del tablero
        const ringGeo = new THREE.RingGeometry(0.1, 0.25, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: isWhite ? 0xdbeafe : 0xfacc15,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
        });
        const shockwave = new THREE.Mesh(ringGeo, ringMat);
        shockwave.rotation.x = -Math.PI / 2;
        shockwave.position.set(pos.x, 0.20, pos.z);
        BoardManager.scene.add(shockwave);

        new TWEEN.Tween(shockwave.scale)
            .to({ x: 4.5, y: 4.5, z: 4.5 }, 400)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        new TWEEN.Tween(shockwave.material)
            .to({ opacity: 0 }, 400)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
                BoardManager.scene.remove(shockwave);
            })
            .start();

        // Chispas y partículas ascendentes
        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(geo, mat.clone());
            mesh.position.copy(pos);
            mesh.position.y += Math.random() * 0.8 + 0.2;

            const angle = Math.random() * Math.PI * 2;
            const speed = 0.08 + Math.random() * 0.22;
            const velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.random() * 0.28 + 0.12,
                Math.sin(angle) * speed
            );

            this.particles.push({
                mesh: mesh,
                velocity: velocity,
                life: 1.0,
                decay: 0.03 + Math.random() * 0.02
            });

            BoardManager.scene.add(mesh);
        }
    },

    // Cascada dorada de victoria y jaque mate
    createVictoryFireworks: function(pos) {
        const count = 90;
        const geo = new THREE.SphereGeometry(0.09, 8, 8);
        const colors = [0xfacc15, 0xffffff, 0x38bdf8, 0xe879f9];

        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: colors[Math.floor(Math.random() * colors.length)]
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(pos);
            mesh.position.y += 1.2;

            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const speed = 0.18 + Math.random() * 0.28;

            const velocity = new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.cos(phi) * speed + 0.25,
                Math.sin(phi) * Math.sin(theta) * speed
            );

            this.particles.push({
                mesh: mesh,
                velocity: velocity,
                life: 1.6,
                decay: 0.018
            });

            BoardManager.scene.add(mesh);
        }
    },

    // ==========================================================================
    // SISTEMA HOLOGRÁFICO DE GUÍA 3D, RAYOS DE ENERGÍA Y FAROS DE DESTINO
    // ==========================================================================
    drawMoveArc: function(fromSq, toSq, colorHex = 0x38bdf8) {
        this.clearMoveArc();
        if (!BoardManager.squaresMap[fromSq] || !BoardManager.squaresMap[toSq]) return;

        const p1 = BoardManager.squaresMap[fromSq].position.clone();
        const p2 = BoardManager.squaresMap[toSq].position.clone();
        p1.y = 0.35;
        p2.y = 0.35;

        const distance = p1.distanceTo(p2);
        const mid = p1.clone().add(p2).multiplyScalar(0.5);
        mid.y = Math.max(2.2, distance * 0.45); // Altura parabólica cinemática

        const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
        const arcGroup = new THREE.Group();
        const tweens = [];

        // 1. Tubo de energía 3D luminoso
        const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.055, 12, false);
        const tubeMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
        });
        const tube = new THREE.Mesh(tubeGeo, tubeMat);
        arcGroup.add(tube);

        // 1b. Tubo de aura/resplandor suave externo
        const glowTubeGeo = new THREE.TubeGeometry(curve, 48, 0.12, 12, false);
        const glowTubeMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide
        });
        const glowTube = new THREE.Mesh(glowTubeGeo, glowTubeMat);
        arcGroup.add(glowTube);

        // 2. Cometa de Energía / Tren de Orbes Luminosos que recorre el arco
        const cometGroup = new THREE.Group();
        const beadCount = 5;
        const beads = [];

        for (let i = 0; i < beadCount; i++) {
            const size = 0.16 * (1 - i * 0.15);
            const beadGeo = new THREE.SphereGeometry(size, 16, 16);
            const beadMat = new THREE.MeshBasicMaterial({
                color: i === 0 ? 0xffffff : colorHex,
                transparent: true,
                opacity: 1 - i * 0.18
            });
            const bead = new THREE.Mesh(beadGeo, beadMat);
            cometGroup.add(bead);
            beads.push(bead);
        }
        arcGroup.add(cometGroup);

        const tweenObj = { t: 0 };
        const cometTween = new TWEEN.Tween(tweenObj)
            .to({ t: 1 }, 1200)
            .repeat(Infinity)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                for (let i = 0; i < beadCount; i++) {
                    const trailT = Math.max(0, Math.min(1, tweenObj.t - i * 0.025));
                    const pt = curve.getPoint(trailT);
                    beads[i].position.copy(pt);
                }
            })
            .start();
        tweens.push(cometTween);

        // 3. Halo en la casilla de origen (resalta la pieza que se mueve)
        const originRingGeo = new THREE.TorusGeometry(0.50, 0.04, 16, 36);
        const originRingMat = new THREE.MeshBasicMaterial({
            color: 0xf5cf70,
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide
        });
        const originRing = new THREE.Mesh(originRingGeo, originRingMat);
        originRing.rotation.x = Math.PI / 2;
        originRing.position.set(p1.x, 0.22, p1.z);
        arcGroup.add(originRing);

        const originTween = new TWEEN.Tween(originRing.scale)
            .to({ x: 1.15, y: 1.15, z: 1.15 }, 700)
            .yoyo(true)
            .repeat(Infinity)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .start();
        tweens.push(originTween);

        // 4. Faro Holográfico de Destino (Landing Beacon en la casilla final)
        const landingGroup = new THREE.Group();
        landingGroup.position.set(p2.x, 0, p2.z);

        // 4a. Anillo concéntrico de destino en el suelo
        const targetRingGeo1 = new THREE.RingGeometry(0.25, 0.52, 36);
        const targetRingMat1 = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.65,
            side: THREE.DoubleSide
        });
        const targetRing1 = new THREE.Mesh(targetRingGeo1, targetRingMat1);
        targetRing1.rotation.x = -Math.PI / 2;
        targetRing1.position.y = 0.20;
        landingGroup.add(targetRing1);

        const targetRingGeo2 = new THREE.TorusGeometry(0.58, 0.035, 16, 36);
        const targetRingMat2 = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
        });
        const targetRing2 = new THREE.Mesh(targetRingGeo2, targetRingMat2);
        targetRing2.rotation.x = Math.PI / 2;
        targetRing2.position.y = 0.21;
        landingGroup.add(targetRing2);

        // 4b. Columna vertical de luz holográfica (Pilar de aterrizaje)
        const beaconColGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.8, 24, 1, true);
        const beaconColMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.18,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const beaconCol = new THREE.Mesh(beaconColGeo, beaconColMat);
        beaconCol.position.y = 1.0;
        landingGroup.add(beaconCol);

        // 4c. Flecha 3D holográfica flotante apuntando hacia abajo
        const arrowGroup = new THREE.Group();
        const arrowConeGeo = new THREE.ConeGeometry(0.24, 0.45, 16);
        const arrowConeMat = new THREE.MeshBasicMaterial({
            color: 0xf5cf70,
            transparent: true,
            opacity: 0.95
        });
        const arrowCone = new THREE.Mesh(arrowConeGeo, arrowConeMat);
        arrowCone.rotation.x = Math.PI; // Apunta hacia abajo
        arrowCone.position.y = 2.0;
        arrowGroup.add(arrowCone);

        landingGroup.add(arrowGroup);
        arcGroup.add(landingGroup);

        const beaconTween = new TWEEN.Tween(arrowGroup.position)
            .to({ y: -0.35 }, 600)
            .yoyo(true)
            .repeat(Infinity)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .start();
        tweens.push(beaconTween);

        const ringPulseTween = new TWEEN.Tween(targetRing2.scale)
            .to({ x: 1.25, y: 1.25, z: 1.25 }, 800)
            .yoyo(true)
            .repeat(Infinity)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .start();
        tweens.push(ringPulseTween);

        BoardManager.effectsGroup.add(arcGroup);
        this.activeArc = { group: arcGroup, tweens };
    },

    clearMoveArc: function() {
        if (this.activeArc) {
            if (this.activeArc.tweens) {
                this.activeArc.tweens.forEach(tw => tw.stop());
            }
            BoardManager.effectsGroup.remove(this.activeArc.group);
            this.activeArc = null;
        }
    },

    // Gemas de Entrenamiento 3D: Cristales zafiro facetados con anillos orbitales
    addTrainingGem: function(sqName) {
        if (!BoardManager.squaresMap[sqName]) return;
        const pos = BoardManager.squaresMap[sqName].position;

        const gemGroup = new THREE.Group();
        gemGroup.position.set(pos.x, 0.75, pos.z);
        gemGroup.userData = { isGem: true, square: sqName };

        // 1. Diamante / Cristal 3D Facetado luminoso
        const crystalGeo = new THREE.IcosahedronGeometry(0.32, 0);
        const crystalMat = new THREE.MeshPhysicalMaterial({
            color: 0x00f0ff,
            emissive: 0x0088cc,
            emissiveIntensity: 0.85,
            roughness: 0.08,
            metalness: 0.15,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1
        });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        gemGroup.add(crystal);

        // 2. Anillo orbital giratorio
        const orbitRingGeo = new THREE.TorusGeometry(0.46, 0.025, 16, 32);
        const orbitRingMat = new THREE.MeshBasicMaterial({
            color: 0xfde047,
            transparent: true,
            opacity: 0.85
        });
        const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat);
        orbitRing.rotation.x = Math.PI / 3.5;
        gemGroup.add(orbitRing);

        // 3. Sombra de suelo holográfica
        const groundGlowGeo = new THREE.CircleGeometry(0.38, 24);
        const groundGlowMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide
        });
        const groundGlow = new THREE.Mesh(groundGlowGeo, groundGlowMat);
        groundGlow.rotation.x = -Math.PI / 2;
        groundGlow.position.y = -0.52;
        gemGroup.add(groundGlow);

        BoardManager.effectsGroup.add(gemGroup);
        this.gemMeshes.push(gemGroup);

        new TWEEN.Tween(gemGroup.position)
            .to({ y: 1.05 }, 800)
            .yoyo(true)
            .repeat(Infinity)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .start();
    },

    clearTrainingGems: function() {
        this.gemMeshes.forEach(g => BoardManager.effectsGroup.remove(g));
        this.gemMeshes = [];
    },

    renderControlHeatmap: function(controlGrid) {
        this.clearControlHeatmap();
        if (!controlGrid) return;

        const sqSize = BoardManager.squareSize;
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const sqName = files[f] + ranks[r];
                const score = controlGrid[sqName] || 0;
                if (score === 0) continue;

                const geo = new THREE.PlaneGeometry(sqSize * 0.88, sqSize * 0.88);
                const isWhite = score > 0;
                const intensity = Math.min(0.5, Math.abs(score) * 0.14);

                const mat = new THREE.MeshBasicMaterial({
                    color: isWhite ? 0x10b981 : 0xf43f5e,
                    transparent: true,
                    opacity: intensity,
                    side: THREE.DoubleSide
                });

                const plane = new THREE.Mesh(geo, mat);
                plane.rotation.x = -Math.PI / 2;
                const pos = BoardManager.squaresMap[sqName].position;
                plane.position.set(pos.x, 0.16, pos.z);
                BoardManager.heatmapGroup.add(plane);
            }
        }
    },

    clearControlHeatmap: function() {
        while (BoardManager.heatmapGroup.children.length > 0) {
            BoardManager.heatmapGroup.remove(BoardManager.heatmapGroup.children[0]);
        }
    },

    update: function(delta) {
        if (this.ambientDust) {
            this.ambientDust.rotation.y += delta * 0.015;
        }

        this.gemMeshes.forEach(g => {
            g.rotation.y += delta * 2;
        });

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.mesh.position.add(p.velocity);
            p.velocity.y -= 0.009; // Gravedad suave
            p.mesh.rotation.x += 0.1;
            p.mesh.rotation.y += 0.1;
            p.life -= p.decay;

            p.mesh.scale.setScalar(Math.max(0, p.life));

            if (p.life <= 0 || p.mesh.position.y < -2) {
                BoardManager.scene.remove(p.mesh);
                this.particles.splice(i, 1);
            }
        }
    }
};

window.EffectsManager = EffectsManager;
