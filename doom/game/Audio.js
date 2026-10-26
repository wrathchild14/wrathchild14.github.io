const SOUNDS = {
    hit: [360, 0.05, 'square', 0.02],
    kill: [220, 0.1, 'sawtooth', 0.04],
    melee: [90, 0.14, 'sawtooth', 0.08],
    finisher: [55, 0.35, 'sawtooth', 0.1],
    stagger: [620, 0.1, 'triangle', 0.04],
    dash: [140, 0.13, 'triangle', 0.05],
    berserk: [65, 0.5, 'sawtooth', 0.09],
    damage: [65, 0.2, 'sawtooth', 0.07],
    reload: [240, 0.12, 'triangle', 0.03],
    'reload-complete': [450, 0.08, 'triangle', 0.03],
    pickup: [680, 0.2, 'sine', 0.04],
    charge: [80, 0.3, 'square', 0.03],
    wave: [180, 0.3, 'triangle', 0.05],
};

export default class GameAudio {
    constructor() {
        this.enabled = true;
        this.music = new Audio('../common/models/1level/Rip & Off.mp3');
        this.music.loop = true;
        this.music.volume = 0.22;
        this.context = null;
    }

    unlock() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.context ||= new AudioContext();
            this.context.resume().catch(() => {});
        } catch {
            // Sound is optional; unsupported audio must not block deployment.
        }
    }

    sync(playing) {
        if (playing && this.enabled) {
            this.music.play().catch(() => {});
        } else {
            this.music.pause();
        }
    }

    play(event) {
        if (event.type === 'shot') {
            this.tone(
                event.weapon === 1 ? 95 : 180,
                event.weapon === 1 ? 0.2 : 0.08,
                'sawtooth',
                0.07,
            );
        } else if (SOUNDS[event.type]) {
            this.tone(...SOUNDS[event.type]);
        }
    }

    tone(frequency, duration, type, volume) {
        if (!this.enabled || !this.context) {
            return;
        }
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        const now = this.context.currentTime;
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(25, frequency / 4),
            now + duration,
        );
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        oscillator.connect(gain);
        gain.connect(this.context.destination);
        oscillator.start();
        oscillator.stop(now + duration);
        oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
        };
    }
}
