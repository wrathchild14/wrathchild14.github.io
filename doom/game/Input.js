const ACTION_KEYS = {
    KeyF: 'melee',
    KeyE: 'melee',
    ShiftLeft: 'dash',
    ShiftRight: 'dash',
    Space: 'dash',
    KeyQ: 'berserk',
    KeyR: 'reload',
    Digit1: 'rifle',
    Digit2: 'shotgun',
    KeyP: 'pause',
    Escape: 'pause',
};

export function emptyInput() {
    return {
        forward: 0,
        right: 0,
        turn: 0,
        tilt: 0,
        lookX: 0,
        lookY: 0,
        firing: false,
        actions: [],
    };
}

// Browser events are collected here, then consumed once by the simulation.
export default class Input {
    constructor(target, onPause) {
        this.target = target;
        this.onPause = onPause;
        this.enabled = false;
        this.windowed = false;
        this.sensitivity = 0.002;
        this.clear();
        this.handlers = {
            keydown: (event) => this.keyDown(event),
            keyup: (event) => this.keys.delete(event.code),
            mousemove: (event) => this.mouseMove(event),
            mousedown: (event) => {
                if (event.button === 0) {
                    this.firing = true;
                    this.actions.push('fire');
                }
            },
            mouseup: (event) => {
                if (event.button === 0) {
                    this.firing = false;
                }
            },
        };
    }

    keyDown(event) {
        const movementKeys = [
            'KeyW',
            'KeyA',
            'KeyS',
            'KeyD',
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
        ];
        const isGameKey = ACTION_KEYS[event.code] || movementKeys.includes(event.code);
        if (!isGameKey || event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }
        event.preventDefault();
        this.keys.add(event.code);
        if (event.repeat) {
            return;
        }
        const action = ACTION_KEYS[event.code];
        if (action === 'pause') {
            this.onPause();
        } else if (action) {
            this.actions.push(action);
        }
    }

    mouseMove(event) {
        if (this.windowed && !(event.buttons & 2)) {
            return;
        }
        this.lookX -= event.movementX * this.sensitivity;
        this.lookY -= event.movementY * this.sensitivity;
    }

    enable() {
        if (this.enabled) {
            return;
        }
        this.enabled = true;
        for (const [name, handler] of Object.entries(this.handlers)) {
            this.target.addEventListener(name, handler);
        }
    }

    disable() {
        this.enabled = false;
        this.clear();
        for (const [name, handler] of Object.entries(this.handlers)) {
            this.target.removeEventListener(name, handler);
        }
    }

    clear() {
        this.keys = new Set();
        this.actions = [];
        this.lookX = 0;
        this.lookY = 0;
        this.firing = false;
    }

    read() {
        const held = (key) => Number(this.keys.has(key));
        const input = {
            forward: held('KeyW') - held('KeyS'),
            right: held('KeyD') - held('KeyA'),
            turn: held('ArrowLeft') - held('ArrowRight'),
            tilt: held('ArrowUp') - held('ArrowDown'),
            lookX: this.lookX,
            lookY: this.lookY,
            firing: this.firing,
            actions: this.actions,
        };
        this.actions = [];
        this.lookX = 0;
        this.lookY = 0;
        return input;
    }
}
