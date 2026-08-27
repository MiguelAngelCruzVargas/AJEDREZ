/**
 * ==========================================================================
 * AUDIO.JS - Sistema de Audio Cinemático Envolvente y Música de Fondo
 * ==========================================================================
 */

const AudioManager = {
    ctx: null,
    masterGain: null,
    musicGain: null,
    sfxGain: null,
    reverbNode: null,
    isMuted: false,
    volume: 0.75,
    musicPlaying: false,
    
    // Nodos de la banda sonora sintetizada
    _musicInterval: null,
    _activeOscillators: [],
    _chordIndex: 0,
    
    // Progresión armónica cinemática (Acordes envolventes estilo película: Re menor épico, Sib maj7, Sol menor9, La sus4/La)
    _chordProgression: [
        // Dm9 (D, F, A, C, E)
        { bass: 73.42, notes: [146.83, 220.00, 261.63, 329.63, 440.00], duration: 7.0 },
        // Bb maj7 (Bb, D, F, A)
        { bass: 58.27, notes: [116.54, 174.61, 233.08, 293.66, 349.23], duration: 7.0 },
        // Gm9 (G, Bb, D, F, A)
        { bass: 49.00, notes: [98.00, 146.83, 174.61, 220.00, 293.66], duration: 7.0 },
        // Asus4 -> A (A, D, E -> A, C#, E)
        { bass: 55.00, notes: [110.00, 164.81, 220.00, 293.66, 329.63], duration: 7.0 }
    ],

    init: function() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        if (!this.masterGain) {
            // Cadena de audio principal
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);

            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
            this.musicGain.connect(this.masterGain);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
            this.sfxGain.connect(this.masterGain);

            // Crear reverberación sintética de sala de conciertos
            this._createReverb();
        }
    },

    _createReverb: function() {
        try {
            const sampleRate = this.ctx.sampleRate;
            const length = sampleRate * 2.5; // 2.5 segundos de cola de reverb
            const impulse = this.ctx.createBuffer(2, length, sampleRate);
            const left = impulse.getChannelData(0);
            const right = impulse.getChannelData(1);

            for (let i = 0; i < length; i++) {
                const decay = Math.exp(-i / (sampleRate * 0.8));
                left[i] = (Math.random() * 2 - 1) * decay;
                right[i] = (Math.random() * 2 - 1) * decay;
            }

            this.reverbNode = this.ctx.createConvolver();
            this.reverbNode.buffer = impulse;

            const reverbGain = this.ctx.createGain();
            reverbGain.gain.value = 0.28;

            this.reverbNode.connect(reverbGain);
            reverbGain.connect(this.masterGain);
        } catch(e) {
            console.warn("Reverb no disponible:", e);
        }
    },

    setVolume: function(val) {
        this.volume = Math.max(0, Math.min(1, val));
        if (this.masterGain && !this.isMuted) {
            this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
        }
        return this.volume;
    },

    toggleMute: function() {
        this.isMuted = !this.isMuted;
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.05);
        }
        return this.isMuted;
    },

    // Envío espacial HRTF 3D para efectos de sonido
    _outputSpatialSFX: function(node, pos3D) {
        if (!this.ctx || this.isMuted) return;
        
        let panner = null;
        if (pos3D) {
            try {
                panner = this.ctx.createPanner();
                panner.panningModel = 'HRTF';
                panner.distanceModel = 'inverse';
                panner.refDistance = 10;
                panner.maxDistance = 60;
                panner.rolloffFactor = 0.8;

                if (panner.positionX) {
                    panner.positionX.value = pos3D.x;
                    panner.positionY.value = pos3D.y;
                    panner.positionZ.value = pos3D.z;
                } else if (panner.setPosition) {
                    panner.setPosition(pos3D.x, pos3D.y, pos3D.z);
                }
            } catch(e) {}
        }

        const outTarget = panner || this.sfxGain;
        node.connect(outTarget);

        if (panner) {
            panner.connect(this.sfxGain);
        }

        // Envío a reverb sutil
        if (this.reverbNode) {
            try {
                const sendGain = this.ctx.createGain();
                sendGain.gain.value = 0.35;
                node.connect(sendGain);
                sendGain.connect(this.reverbNode);
            } catch(e) {}
        }
    },

    // Orientación de la cámara 3D para el paneo binaural
    updateListener: function(camera) {
        if (!this.ctx || !camera) return;
        try {
            const listener = this.ctx.listener;
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            const p = camera.position;
            const t = this.ctx.currentTime;

            if (listener.positionX) {
                listener.positionX.setTargetAtTime(p.x, t, 0.05);
                listener.positionY.setTargetAtTime(p.y, t, 0.05);
                listener.positionZ.setTargetAtTime(p.z, t, 0.05);
                listener.forwardX.setTargetAtTime(dir.x, t, 0.05);
                listener.forwardY.setTargetAtTime(dir.y, t, 0.05);
                listener.forwardZ.setTargetAtTime(dir.z, t, 0.05);
                listener.upX.setValueAtTime(0, t);
                listener.upY.setValueAtTime(1, t);
                listener.upZ.setValueAtTime(0, t);
            } else if (listener.setPosition) {
                listener.setPosition(p.x, p.y, p.z);
                listener.setOrientation(dir.x, dir.y, dir.z, 0, 1, 0);
            }
        } catch(e) {}
    },

    // =========================================================================
    // BANDA SONORA CINEMÁTICA ENVOLVENTE (Música de Fondo Estilo Película)
    // =========================================================================
    startBackgroundMusic: function() {
        this.init();
        if (this.musicPlaying) return;
        this.musicPlaying = true;

        this._playNextChord();
    },

    _playNextChord: function() {
        if (!this.musicPlaying || !this.ctx) return;

        const chord = this._chordProgression[this._chordIndex];
        const now = this.ctx.currentTime;
        const dur = chord.duration;

        // 1. Capa de Sub-Bajo Cálido (Warm Deep Analog Sub)
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        const bassFilter = this.ctx.createBiquadFilter();

        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(chord.bass, now);

        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(180, now);

        bassGain.gain.setValueAtTime(0, now);
        bassGain.gain.linearRampToValueAtTime(0.45, now + 0.6);
        bassGain.gain.setValueAtTime(0.45, now + dur - 1.8);
        bassGain.gain.linearRampToValueAtTime(0, now + dur);

        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(this.musicGain);

        bassOsc.start(now);
        bassOsc.stop(now + dur + 0.1);

        // 2. Capa de Pads de Cuerdas Cinemáticas (Lush Strings / Soft Pad)
        chord.notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

            osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
            // Micro-desafinación para grosor y calidez orquestal
            const detune = (idx - 2) * 4;
            osc.frequency.setValueAtTime(freq, now);
            osc.detune.setValueAtTime(detune, now);

            // Filtro de calidez analógica
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400 + idx * 120, now);
            filter.frequency.exponentialRampToValueAtTime(650 + idx * 100, now + dur * 0.5);
            filter.frequency.exponentialRampToValueAtTime(380 + idx * 120, now + dur);

            // Envolvente suave estilo banda sonora
            const noteVol = 0.08 / (chord.notes.length * 0.5);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(noteVol, now + 0.9 + idx * 0.15);
            gain.gain.setValueAtTime(noteVol, now + dur - 2.0);
            gain.gain.linearRampToValueAtTime(0, now + dur);

            osc.connect(filter);
            filter.connect(gain);

            if (pan) {
                pan.pan.value = (idx / (chord.notes.length - 1) - 0.5) * 0.8;
                gain.connect(pan);
                pan.connect(this.musicGain);
                if (this.reverbNode) gain.connect(this.reverbNode);
            } else {
                gain.connect(this.musicGain);
                if (this.reverbNode) gain.connect(this.reverbNode);
            }

            osc.start(now + idx * 0.1);
            osc.stop(now + dur + 0.1);
        });

        // 3. Destello armónico sutil de campana/arpegio espacial
        const highNote = chord.notes[chord.notes.length - 1] * 2;
        const bellOsc = this.ctx.createOscillator();
        const bellGain = this.ctx.createGain();
        bellOsc.type = 'sine';
        bellOsc.frequency.setValueAtTime(highNote, now + 1.5);
        bellGain.gain.setValueAtTime(0, now + 1.5);
        bellGain.gain.linearRampToValueAtTime(0.04, now + 1.8);
        bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 5.5);

        bellOsc.connect(bellGain);
        bellGain.connect(this.musicGain);
        if (this.reverbNode) bellGain.connect(this.reverbNode);

        bellOsc.start(now + 1.5);
        bellOsc.stop(now + 5.6);

        // Programar siguiente acorde
        this._chordIndex = (this._chordIndex + 1) % this._chordProgression.length;
        const delayMs = (dur - 1.2) * 1000; // Superposición suave de acordes
        this._musicInterval = setTimeout(() => {
            if (this.musicPlaying) {
                this._playNextChord();
            }
        }, delayMs);
    },

    stopBackgroundMusic: function() {
        this.musicPlaying = false;
        if (this._musicInterval) {
            clearTimeout(this._musicInterval);
            this._musicInterval = null;
        }
    },

    // Fanfarria de apertura de película al pulsar JUGAR
    playCinematicIntro: function() {
        this.init();
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Acorde majestuoso de apertura (Re menor épico con brillo orquestal)
        const notes = [146.83, 220.00, 293.66, 349.23, 440.00, 587.33];
        notes.forEach((f, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = f;
            gain.gain.setValueAtTime(0, now + i * 0.08);
            gain.gain.linearRampToValueAtTime(0.12, now + i * 0.08 + 0.6);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 4.5);

            osc.connect(gain);
            gain.connect(this.musicGain);
            if (this.reverbNode) gain.connect(this.reverbNode);

            osc.start(now + i * 0.08);
            osc.stop(now + 4.6);
        });
    },

    // =========================================================================
    // EFECTOS DE SONIDO TÁCTILES Y REALISTAS (Sin disparos ni ruidos artificiales)
    // =========================================================================

    // Impacto de pieza noble sobre el tablero (marfil/madera con base de fieltro)
    playMove: function(pos3D) {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Golpe de madera/marfil sólido
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.09);

        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(gain);
        this._outputSpatialSFX(gain, pos3D);
        osc.start(now);
        osc.stop(now + 0.1);

        // Fieltro de base suave (ruido filtrado)
        const bufferSize = this.ctx.sampleRate * 0.06;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'lowpass';
        nFilter.frequency.value = 600;

        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.3, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        noise.connect(nFilter);
        nFilter.connect(nGain);
        this._outputSpatialSFX(nGain, pos3D);
        noise.start(now);
    },

    // Captura con impacto de peso y resonancia profunda
    playCapture: function(pos3D) {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Golpe grave contundente
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);

        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        this._outputSpatialSFX(gain, pos3D);
        osc.start(now);
        osc.stop(now + 0.2);

        // Resonancia de choque de material noble
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(820, now);
        osc2.frequency.exponentialRampToValueAtTime(260, now + 0.25);

        gain2.gain.setValueAtTime(0.35, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc2.connect(gain2);
        this._outputSpatialSFX(gain2, pos3D);
        osc2.start(now);
        osc2.stop(now + 0.26);
    },

    // Jaque: Acorde dramático orquestal envolvente
    playCheck: function(pos3D) {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const freqs = [220.00, 261.63, 311.13, 440.00]; // Acorde disminuido dramático

        freqs.forEach(f => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = f;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(300, now);
            filter.frequency.linearRampToValueAtTime(1400, now + 0.2);
            filter.frequency.exponentialRampToValueAtTime(200, now + 1.4);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.18, now + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

            osc.connect(filter);
            filter.connect(gain);
            this._outputSpatialSFX(gain, pos3D);
            osc.start(now);
            osc.stop(now + 1.5);
        });
    },

    // Jaque Mate y Victoria: Fanfarria armónica triunfal
    playVictory: function() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const notes = [
            { f: 293.66, t: 0.0 },
            { f: 369.99, t: 0.18 },
            { f: 440.00, t: 0.36 },
            { f: 587.33, t: 0.54 },
            { f: 880.00, t: 0.72 }
        ];

        notes.forEach(n => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = n.f;

            const start = now + n.t;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.28, start + 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 1.8);

            osc.connect(gain);
            gain.connect(this.masterGain);
            if (this.reverbNode) gain.connect(this.reverbNode);

            osc.start(start);
            osc.stop(start + 1.9);
        });
    },

    // Clic en la interfaz sutil y elegante
    playClick: function() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(750, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.05);
    },

    // Suave sonido de brisa/whoosh cinemático al cambiar vista de cámara
    playCameraTransition: function() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.exponentialRampToValueAtTime(800, now + 0.2);
        filter.frequency.exponentialRampToValueAtTime(150, now + 0.4);
        filter.Q.value = 2;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(now);
    },

    // Éxito en lección o puzzle
    playSuccess: function() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        [440, 554.37, 659.25, 880].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const start = now + idx * 0.08;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.18, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.8);
            osc.connect(gain);
            gain.connect(this.masterGain);
            if (this.reverbNode) gain.connect(this.reverbNode);
            osc.start(start);
            osc.stop(start + 0.9);
        });
    },

    // Pista táctica
    playHint: function() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.3);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        if (this.reverbNode) gain.connect(this.reverbNode);
        osc.start(now);
        osc.stop(now + 0.36);
    },

    // Tick del reloj de ajedrez suave y elegante
    playClockTick: function() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.025);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.03);
    },

    // Alerta de tiempo crítico (< 10 segundos)
    playClockAlert: function() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.09);
    }
};

window.AudioManager = AudioManager;

