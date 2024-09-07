import Node from './Node.js';
import Bullet from './Bullet.js';

const mat4 = glMatrix.mat4;
const quat = glMatrix.quat;
const vec3 = glMatrix.vec3;

export default class MyCamera extends Node {
    constructor(options = {}) {
        super(options = {});

        this.id = "player";
        this.r = options.r ?
            vec3.clone(options.r) :
            vec3.fromValues(0, 0, 0);
        this.velocity = options.velocity ?
            vec3.clone(options.velocity) :
            vec3.fromValues(0, 0, 0);
        this.mouseSensitivity = 0.002;
        this.maxSpeed = 3;
        this.friction = 0.2;
        this.acceleration = 20;

        //test
        this.aabb = {
            "min": [-0.3, -0.3, -0.3],
            "max": [0.3, 0.3, 0.3] // make the player a lil fat
        }

        this.mousemoveHandler = this.mousemoveHandler.bind(this);
        this.mouseshootHandler = this.mouseshootHandler.bind(this);
        this.keydownHandler = this.keydownHandler.bind(this);
        this.keyupHandler = this.keyupHandler.bind(this);
        this.keys = {};

        this.bullets = [];
    }

    update(dt) {
        const c = this;

        const forward = vec3.set(vec3.create(),
            -Math.sin(c.r[1]), 0, -Math.cos(c.r[1]));
        const right = vec3.set(vec3.create(),
            Math.cos(c.r[1]), 0, -Math.sin(c.r[1]));

        // 1: add movement acceleration
        let acc = vec3.create();
        if (this.keys['KeyW']) {
            vec3.add(acc, acc, forward);
        }
        if (this.keys['KeyS']) {
            vec3.sub(acc, acc, forward);
        }
        if (this.keys['KeyD']) {
            vec3.add(acc, acc, right);
        }
        if (this.keys['KeyA']) {
            vec3.sub(acc, acc, right);
        }

        // 2: update velocity
        vec3.scaleAndAdd(c.velocity, c.velocity, acc, dt * c.acceleration);

        // 3: if no movement, apply friction
        if (!this.keys['KeyW'] &&
            !this.keys['KeyS'] &&
            !this.keys['KeyD'] &&
            !this.keys['KeyA']) {
            vec3.scale(c.velocity, c.velocity, 1 - c.friction);
        }

        // 4: limit speed
        const len = vec3.len(c.velocity);
        if (len > c.maxSpeed) {
            vec3.scale(c.velocity, c.velocity, c.maxSpeed / len);
        }

        // 5: update translation
        vec3.scaleAndAdd(c.translation, c.translation, c.velocity, dt);

        // 6: update
        this.updateMatrix();

        // gun sorted last (reduces lag)
        this.gun.r = vec3.set(vec3.create(), this.r[0], this.r[1], this.r[2]);
        this.gun.translation = vec3.add(vec3.create(), this.translation, forward);
        this.gun.rotation = [0, this.rotation[1], this.rotation[2], this.rotation[3]]
        this.gun.translation[1] -= 0.5;
        this.gun.updateMatrix();
    }

    enable() {
        document.addEventListener('mousemove', this.mousemoveHandler);
        document.addEventListener('mousedown', this.mouseshootHandler);
        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
    }

    disable() {
        document.removeEventListener('mousemove', this.mousemoveHandler);
        document.removeEventListener('mousedown', this.mouseshootHandler);
        document.removeEventListener('keydown', this.keydownHandler);
        document.removeEventListener('keyup', this.keyupHandler);

        for (let key in this.keys) {
            this.keys[key] = false;
        }
    }

    mouseshootHandler() {
        let bullet = new Bullet();

        // gets the translation and the rotation of the player
        // and a little bit forward
        const forward = vec3.set(vec3.create(),
            -Math.sin(this.r[1]), 0, -Math.cos(this.r[1]));
        bullet.translation = vec3.add(vec3.create(), this.translation, forward);
        bullet.translation = vec3.add(bullet.translation, bullet.translation, forward);
        bullet.r = vec3.set(vec3.create(), this.r[0], this.r[1], this.r[2]);

        this.bullets.push(bullet);
    }

    getBullets() {
        return this.bullets;
    }

    delBullets() {
        this.bullets = [];
    }

    mousemoveHandler(e) {
        const dx = e.movementX;
        const dy = e.movementY;
        const c = this;

        c.r[0] -= dy * c.mouseSensitivity;
        c.r[1] -= dx * c.mouseSensitivity;

        const pi = Math.PI;
        const twopi = pi * 2;
        const halfpi = pi / 2;

        if (c.r[0] > halfpi) {
            c.r[0] = halfpi;
        }
        if (c.r[0] < -halfpi) {
            c.r[0] = -halfpi;
        }

        c.r[1] = ((c.r[1] % twopi) + twopi) % twopi;

        const degrees = c.r.map(x => x * 180 / pi);
        c.rotation = quat.fromEuler(c.rotation, ...degrees);
    }

    keydownHandler(e) {
        this.keys[e.code] = true;
    }

    keyupHandler(e) {
        this.keys[e.code] = false;
    }
}