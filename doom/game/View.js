import Node from './engine/Node.js';
import Renderer from './engine/Renderer.js';
import PostProcessing from './engine/PostProcessing.js';
import PerspectiveCamera from './engine/PerspectiveCamera.js';
import { ENEMIES, WEAPONS } from './config.js';

const { vec3, quat } = glMatrix;

export default class View {
    constructor(canvas, gl, arena) {
        this.canvas = canvas;
        this.gl = gl;
        this.arena = arena;
        this.renderer = new Renderer(gl);
        try {
            this.postProcessing = new PostProcessing(gl);
        } catch (error) {
            console.warn('Ember effects unavailable; using original graphics.', error);
            this.postProcessing = null;
        }
        this.renderer.prepareScene(arena.scene);
        for (const mesh of Object.values(arena.meshes)) {
            this.renderer.prepareMesh(mesh);
        }
        this.camera = new Node();
        this.camera.camera = new PerspectiveCamera({ fov: 1.35, near: 0.05, far: 180 });
        this.nodes = new WeakMap();
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.makeWeapon();
        this.reset();
    }

    reset() {
        this.particles = [];
        this.recoil = 0;
        this.swingRemaining = 0;
        this.swingStep = 0;
        this.feedback = { damage: 0, hit: 0, finisher: 0 };
    }

    makeWeapon() {
        const mesh = this.arena.meshes.gun;
        const parts = [
            { offset: [0, 0, 0], scale: [0.09, 0.1, 0.32], color: [0.25, 0.28, 0.3] },
            { offset: [0, 0.105, -0.04], scale: [0.035, 0.025, 0.23], color: [0.12, 0.13, 0.14] },
            { offset: [0, 0.13, -0.22], scale: [0.013, 0.018, 0.025], color: [1, 0.3, 0.05] },
            { offset: [0, -0.015, -0.4], scale: [0.045, 0.045, 0.14], color: [0.12, 0.14, 0.15] },
            { offset: [0, -0.13, 0.12], scale: [0.065, 0.1, 0.09], color: [0.19, 0.13, 0.1] },
        ];
        this.gunParts = parts.map((part) => {
            const node = new Node({ mesh, scale: part.scale });
            node.offset = part.offset;
            node.solidColor = part.color;
            return node;
        });
        this.fist = new Node({ mesh, scale: [0.15, 0.12, 0.17] });
        this.fist.solidColor = [0.36, 0.42, 0.28];
        this.knuckles = new Node({ mesh, scale: [0.16, 0.04, 0.04] });
        this.knuckles.solidColor = [0.85, 0.58, 0.23];
        this.muzzle = new Node({ mesh: this.arena.meshes.spark, scale: [0.07, 0.07, 0.12] });
        this.muzzle.solidColor = [3, 1.6, 0.3];
    }

    handle(event) {
        if (event.type === 'shot') this.recoil = WEAPONS[event.weapon].recoil;
        if (event.type === 'damage') this.feedback.damage = 0.65;
        if (event.type === 'hit') {
            this.feedback.hit = 0.13;
            this.burst(event.position, [1, 0.16, 0.05], 4);
        }
        if (event.type === 'kill') this.burst(event.position, [1, 0.25, 0.08], 14);
        if (event.type === 'impact') this.burst(event.position, event.color, event.count);
        if (event.type === 'spawn') this.burst(event.position, [0.7, 0.15, 1.5], 8);
        if (event.type === 'melee') {
            this.swingRemaining = 0.22;
            this.swingStep = event.step;
        }
        if (event.type === 'finisher') {
            this.swingRemaining = 0.35;
            this.swingStep = 2;
            this.feedback.finisher = 0.4;
            this.burst(event.position, [1.5, 0.7, 0.1], 20);
        }
    }

    burst(position, color, count) {
        const budget = this.reducedMotion ? 40 : 160;
        for (let i = 0; i < count && this.particles.length < budget; i++) {
            const node = new Node({
                mesh: this.arena.meshes.spark,
                translation: position,
                scale: [0.06, 0.06, 0.06],
            });
            node.solidColor = color;
            node.life = 0.2 + Math.random() * 0.3;
            node.velocity = [
                (Math.random() - 0.5) * 6,
                Math.random() * 4,
                (Math.random() - 0.5) * 6,
            ];
            this.particles.push(node);
        }
    }

    update(dt) {
        this.recoil = Math.max(0, this.recoil - dt * 1.5);
        this.swingRemaining = Math.max(0, this.swingRemaining - dt);
        for (const key of Object.keys(this.feedback)) {
            this.feedback[key] = Math.max(0, this.feedback[key] - dt * 2);
        }
        for (const particle of this.particles) {
            particle.life -= dt;
            particle.velocity[1] -= dt * 8;
            vec3.scaleAndAdd(particle.translation, particle.translation, particle.velocity, dt);
            particle.updateMatrix();
        }
        this.particles = this.particles.filter((particle) => particle.life > 0);
    }

    nodeFor(entity, mesh) {
        if (!this.nodes.has(entity)) {
            this.nodes.set(entity, new Node({ mesh }));
        }
        const node = this.nodes.get(entity);
        vec3.copy(node.translation, entity.position);
        return node;
    }

    enemyNodes(run) {
        return run.enemies
            .filter((enemy) => !enemy.dead)
            .map((enemy) => {
                const node = this.nodeFor(enemy, this.arena.meshes.enemy);
                const scale = enemy.kind === 'brute' ? 1.3 : 1;
                node.scale = [scale, scale, scale];
                node.tint = ENEMIES[enemy.kind].tint;
                node.glow = [0, 0, 0];
                if (enemy.flashRemaining > 0) node.tint = [3, 2, 1.5];
                if (enemy.staggerRemaining > 0) {
                    node.tint = [1, 1, 1];
                    node.glow = [1.2, 0.75, 0.05];
                }
                if (enemy.chargeWindup > 0) {
                    node.tint = [1, 0.3, 0.1];
                    node.glow = [0.8, 0.03, 0];
                }
                quat.fromEuler(node.rotation, 0, (enemy.yaw * 180) / Math.PI, 0);
                node.updateMatrix();
                return node;
            });
    }

    render(run) {
        this.resize();
        this.postProcessing?.begin(this.canvas.width, this.canvas.height);
        vec3.copy(this.camera.translation, run.player.position);
        quat.fromEuler(
            this.camera.rotation,
            (run.player.pitch * 180) / Math.PI,
            (run.player.yaw * 180) / Math.PI,
            0,
        );
        this.camera.updateMatrix();
        const speedFov = !this.reducedMotion && run.player.dashRemaining > 0 ? 0.09 : 0;
        this.camera.camera.fov = 1.35 + speedFov;
        this.camera.camera.updateMatrix();

        const projectiles = run.projectiles.map((projectile) => {
            const node = this.nodeFor(projectile, this.arena.meshes.projectile);
            node.scale = [0.23, 0.23, 0.23];
            node.solidColor = [2, 0.4, 0.08];
            node.updateMatrix();
            return node;
        });
        const pickups = run.pickups.map((pickup) => {
            const node = this.nodeFor(pickup, this.arena.meshes.projectile);
            node.scale = [0.35, 0.35, 0.35];
            node.solidColor = [0.15, 1, 0.4];
            node.translation[1] = 1 + Math.sin(run.elapsed * 3) * 0.15;
            quat.fromEuler(node.rotation, 0, run.elapsed * 80, 0);
            node.updateMatrix();
            return node;
        });
        this.arena.scene.nodes = [
            ...this.arena.staticNodes,
            ...this.enemyNodes(run),
            ...projectiles,
            ...pickups,
            ...this.particles,
        ];
        this.renderer.time = this.reducedMotion ? 0 : run.elapsed;
        this.renderer.effectsEnabled = Boolean(this.postProcessing?.enabled);
        this.renderer.render(this.arena.scene, this.camera);
        this.renderWeapon(run);
        this.postProcessing?.finish({
            time: run.elapsed,
            reducedMotion: this.reducedMotion,
            rage: run.player.berserk,
            damage: this.feedback.damage,
        });
    }

    renderWeapon(run) {
        this.gl.clear(this.gl.DEPTH_BUFFER_BIT);
        const viewProjection = this.renderer.getViewProjectionMatrix(this.camera);
        if (this.swingRemaining > 0) {
            const reach = Math.sin(Math.min(1, this.swingRemaining / 0.22) * Math.PI);
            const side = this.swingStep === 1 ? -1 : 1;
            const offset = [side * (0.3 - reach * 0.24), -0.3 + reach * 0.15, -0.5 - reach * 0.5];
            this.drawHeld(this.fist, offset, viewProjection);
            this.drawHeld(
                this.knuckles,
                [offset[0], offset[1] + 0.1, offset[2] - 0.14],
                viewProjection,
            );
            return;
        }
        const bob = this.reducedMotion
            ? 0
            : Math.min(1, Math.hypot(...run.player.velocity) / 10) *
              Math.sin(run.elapsed * 15) *
              0.025;
        const reloadDrop = run.combat.reloadRemaining > 0 ? 0.25 : 0;
        const offset = [0.23, -0.36 - reloadDrop + bob, -0.75 + this.recoil];
        this.gunParts[0].scale = run.combat.weapon === 1 ? [0.12, 0.11, 0.27] : [0.09, 0.1, 0.32];
        for (const part of this.gunParts) {
            this.drawHeld(part, vec3.add(vec3.create(), offset, part.offset), viewProjection);
        }
        if (this.recoil > (run.combat.weapon === 1 ? 0.14 : 0.05)) {
            this.drawHeld(
                this.muzzle,
                [offset[0], offset[1] - 0.015, offset[2] - 0.57],
                viewProjection,
            );
        }
    }

    drawHeld(node, offset, viewProjection) {
        const transformed = vec3.transformQuat(vec3.create(), offset, this.camera.rotation);
        vec3.add(node.translation, this.camera.translation, transformed);
        quat.copy(node.rotation, this.camera.rotation);
        node.updateMatrix();
        this.renderer.renderNode(node, viewProjection);
    }

    resize() {
        const density = Math.min(devicePixelRatio, 1.5);
        const width = Math.floor(this.canvas.clientWidth * density);
        const height = Math.max(1, Math.floor(this.canvas.clientHeight * density));
        if (this.canvas.width === width && this.canvas.height === height) {
            return;
        }
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
        this.camera.camera.aspect = width / height;
    }
}
