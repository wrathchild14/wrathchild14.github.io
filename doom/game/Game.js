import { loadArena } from './Arena.js';
import GameAudio from './Audio.js';
import Hud from './Hud.js';
import Input from './Input.js';
import Run from './Run.js';
import View from './View.js';

// Browser lifecycle only. Gameplay rules belong to Run and its collaborators.
export default class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.hud = new Hud();
        this.audio = new GameAudio();
        this.input = new Input(document, () => this.pause());
        this.best = this.readBest();
        this.failed = false;
        this.bindControls();
    }

    readBest() {
        try {
            return Number(localStorage.getItem('doom-best-v3')) || 0;
        } catch {
            return 0;
        }
    }

    bindControls() {
        this.hud.element('play').addEventListener('click', () => this.play());
        this.hud.element('fallback').addEventListener('click', () => this.begin(true));
        this.hud.element('restart').addEventListener('click', () => {
            this.reset();
            this.play();
        });
        this.hud.element('pause').addEventListener('click', () => this.pause());
        this.hud.element('sound').addEventListener('change', (event) => {
            this.audio.enabled = event.target.checked;
            this.audio.sync(this.run?.state === 'playing');
        });
        this.hud.element('sensitivity').addEventListener('input', (event) => {
            this.input.sensitivity = Number(event.target.value) * 0.0005;
        });
        this.hud.element('effects').addEventListener('change', (event) => {
            if (this.view?.postProcessing) {
                this.view.postProcessing.enabled = event.target.checked;
            }
        });
        document.addEventListener('pointerlockchange', () => {
            if (
                document.pointerLockElement === this.canvas &&
                !this.failed &&
                this.run?.state !== 'dead'
            ) {
                this.begin(false);
            } else {
                this.pause();
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.pause();
        });
        window.addEventListener('blur', () => this.pause());
        this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
        this.canvas.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            this.fail('The graphics connection was lost. Reload the page to reconnect.');
        });
    }

    async start() {
        try {
            const gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false });
            if (!gl) throw new Error('WebGL 2 is unavailable');
            this.arena = await loadArena();
            this.view = new View(this.canvas, gl, this.arena);
            const effects = this.hud.element('effects');
            effects.disabled = !this.view.postProcessing;
            effects.checked = Boolean(this.view.postProcessing);
            this.reset();
            this.hud.menu(
                'CONTAINMENT BREACHED',
                'RIP. DASH.<br><em>REPEAT.</em>',
                'Stagger demons with gunfire. Finish glowing enemies with F to recover health, ammo, and a dash. Build rage, then press Q to go berserk.',
                'DEPLOY →',
            );
            this.lastTime = performance.now();
            requestAnimationFrame((time) => this.frame(time));
        } catch (error) {
            console.error(error);
            this.fail(
                'The arena could not load. Check your connection and reload. WebGL 2 is required.',
            );
        }
    }

    reset() {
        this.input.disable();
        this.run = new Run(this.arena.walls);
        this.view.reset();
    }

    async play() {
        if (this.failed) {
            location.reload();
            return;
        }
        if (!this.run) return;
        if (this.run.state === 'dead') this.reset();
        this.audio.unlock();
        if (this.input.windowed) {
            this.begin(true);
            return;
        }
        try {
            await this.canvas.requestPointerLock();
        } catch {
            this.hud.text(
                'menuText',
                'Mouse capture was blocked. Try again, or play in windowed mode with right-drag / arrow-key aiming.',
            );
            this.hud.element('fallback').hidden = false;
        }
    }

    begin(windowed) {
        if (this.failed || !this.run) return;
        if (this.run.state === 'dead') this.reset();
        this.input.windowed = windowed;
        this.input.enable();
        this.run.state = 'playing';
        this.hud.hideMenu();
        this.audio.unlock();
        this.audio.sync(true);
        this.lastTime = performance.now();
    }

    pause() {
        if (this.run?.state !== 'playing') return;
        this.run.state = 'paused';
        this.stopInput();
        this.hud.menu(
            'SIGNAL HELD',
            'CATCH YOUR<br><em>BREATH.</em>',
            'The arena is paused. Your run will be right here.',
            'RESUME RUN →',
        );
        this.hud.element('restart').hidden = false;
    }

    stopInput() {
        this.input.disable();
        this.audio.sync(false);
        if (document.pointerLockElement) document.exitPointerLock();
    }

    finishRun() {
        this.stopInput();
        const record = this.run.score > this.best;
        this.best = Math.max(this.best, this.run.score);
        try {
            localStorage.setItem('doom-best-v3', String(this.best));
        } catch {
            // Restricted storage should not prevent another run.
        }
        this.hud.results(this.run, record);
    }

    fail(message) {
        this.failed = true;
        if (this.run) this.run.state = 'error';
        this.stopInput();
        this.hud.menu('UPLINK INTERRUPTED', 'STAND BY.', message, 'RELOAD PAGE');
        this.hud.element('fallback').hidden = true;
    }

    frame(time) {
        if (this.failed) return;
        const dt = Math.min(0.05, (time - this.lastTime) / 1000);
        this.lastTime = time;
        if (this.run.state === 'playing') {
            const input = this.input.read();
            const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
            for (let step = 0; step < steps; step++) {
                this.run.update(dt / steps, input);
                // Discrete actions and mouse deltas are consumed only once per frame.
                input.actions = [];
                input.lookX = 0;
                input.lookY = 0;
            }
            this.view.update(dt);
            for (const event of this.run.drainEvents()) {
                this.view.handle(event);
                this.audio.play(event);
                if (event.type === 'death') this.finishRun();
            }
        }
        this.view.render(this.run);
        this.hud.render(this.run, this.best, this.view.feedback);
        requestAnimationFrame((next) => this.frame(next));
    }
}
