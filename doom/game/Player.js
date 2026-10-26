import { PLAYER } from './config.js';
import { moveBody } from './collision.js';

// Player state and movement have no browser or rendering dependencies.
export default class Player {
    constructor() {
        this.position = [0, PLAYER.eyeHeight, 10];
        this.velocity = [0, 0, 0];
        this.yaw = 0;
        this.pitch = 0;
        this.health = PLAYER.health;
        this.invulnerable = 0;
        this.dashCharges = PLAYER.dashCharges;
        this.dashRemaining = 0;
        this.dashRecharge = 0;
        this.dashDirection = [0, 0, -1];
        this.rage = 0;
        this.berserkRemaining = 0;
    }

    get berserk() {
        return this.berserkRemaining > 0;
    }

    direction() {
        return [
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch),
        ];
    }

    movementDirection(input) {
        const length = Math.hypot(input.right, input.forward) || 1;
        return [
            (input.right * Math.cos(this.yaw) - input.forward * Math.sin(this.yaw)) / length,
            0,
            (-input.right * Math.sin(this.yaw) - input.forward * Math.cos(this.yaw)) / length,
        ];
    }

    aim(input, dt) {
        this.yaw += input.lookX + input.turn * dt * 1.8;
        this.pitch += input.lookY + input.tilt * dt * 1.8;
        this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
    }

    dash(input) {
        if (this.dashCharges === 0 || this.dashRemaining > 0) {
            return false;
        }
        this.dashDirection = this.movementDirection(input);
        if (!input.right && !input.forward) {
            this.dashDirection = [-Math.sin(this.yaw), 0, -Math.cos(this.yaw)];
        }
        this.dashCharges--;
        this.dashRemaining = PLAYER.dashDuration;
        this.invulnerable = Math.max(this.invulnerable, PLAYER.dashDuration);
        return true;
    }

    activateBerserk() {
        if (this.rage < 100 || this.berserk) {
            return false;
        }
        this.rage = 0;
        this.berserkRemaining = PLAYER.berserkDuration;
        this.dashCharges = PLAYER.dashCharges;
        return true;
    }

    update(dt, input, walls) {
        this.invulnerable = Math.max(0, this.invulnerable - dt);
        this.berserkRemaining = Math.max(0, this.berserkRemaining - dt);
        this.rechargeDash(dt);

        const direction = this.movementDirection(input);
        const speed = PLAYER.speed * (this.berserk ? 1.2 : 1);
        const blend = 1 - Math.exp(-PLAYER.acceleration * dt);
        for (const axis of [0, 2]) {
            this.velocity[axis] += (direction[axis] * speed - this.velocity[axis]) * blend;
        }

        if (this.dashRemaining > 0) {
            const dashStep = Math.min(dt, this.dashRemaining);
            const dashDelta = this.dashDirection.map(
                (value) => value * PLAYER.dashSpeed * dashStep,
            );
            moveBody(this.position, dashDelta, walls, PLAYER.radius);
            this.dashRemaining = Math.max(0, this.dashRemaining - dt);
        } else {
            moveBody(
                this.position,
                this.velocity.map((value) => value * dt),
                walls,
                PLAYER.radius,
            );
        }
    }

    rechargeDash(dt) {
        if (this.dashCharges >= PLAYER.dashCharges) {
            this.dashRecharge = 0;
            return;
        }
        this.dashRecharge += dt;
        while (this.dashRecharge >= PLAYER.dashRecharge && this.dashCharges < PLAYER.dashCharges) {
            this.dashCharges++;
            this.dashRecharge -= PLAYER.dashRecharge;
        }
    }
}
