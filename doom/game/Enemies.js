import { ENEMIES, WAVES } from './config.js';
import {
    directionTo,
    distance,
    entityBox,
    hasLineOfSight,
    moveBody,
    rayBox,
    wallDistance,
} from './collision.js';

export function createEnemy(kind, position, wave = 1) {
    const definition = ENEMIES[kind];
    return {
        kind,
        position: [...position],
        health: definition.health,
        maxHealth: definition.health,
        radius: definition.radius,
        speed: definition.speed + Math.min(2, wave * 0.12),
        dead: false,
        wasStaggered: false,
        staggerRemaining: 0,
        stunRemaining: 0,
        flashRemaining: 0,
        attackCooldown: 1,
        chargeWindup: 0,
        chargeRemaining: 0,
        chargeDirection: [0, 0, 0],
        sidestep: 1,
        yaw: 0,
    };
}

export default class Enemies {
    constructor(run) {
        this.run = run;
        this.wave = 0;
        this.pending = 0;
        this.spawnTimer = 0;
        this.breakRemaining = WAVES.initialDelay;
        this.waveActive = false;
    }

    update(dt) {
        this.updateWaves(dt);
        for (const enemy of this.run.enemies) {
            if (!enemy.dead) {
                this.updateEnemy(enemy, dt);
            }
        }
        this.updateProjectiles(dt);
        this.run.enemies = this.run.enemies.filter((enemy) => !enemy.dead);
    }

    updateWaves(dt) {
        const living = this.run.enemies.filter((enemy) => !enemy.dead).length;
        if (this.pending > 0) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0 && living < WAVES.maxActive) {
                if (this.spawn()) {
                    this.pending--;
                }
                this.spawnTimer = WAVES.spawnInterval;
            }
            return;
        }
        if (living > 0) {
            return;
        }
        if (this.waveActive) {
            this.waveActive = false;
            this.breakRemaining = WAVES.breakDuration;
            this.run.recoverWave();
        }
        this.breakRemaining -= dt;
        if (this.breakRemaining <= 0) {
            this.wave++;
            this.pending = WAVES.baseCount + this.wave * 2;
            this.spawnTimer = 0;
            this.waveActive = true;
            this.run.announce(`WAVE ${String(this.wave).padStart(2, '0')} / KEEP MOVING`, 1.8);
            this.run.emit('wave');
        }
    }

    spawn() {
        const run = this.run;
        for (let attempt = 0; attempt < 100; attempt++) {
            const position = [run.random() * 86 - 43, 1, run.random() * 86 - 43];
            if (distance(position, run.player.position) < 13 || this.blockedSpawn(position)) {
                continue;
            }
            let kind = run.random() < 0.35 ? 'caster' : 'hunter';
            if (this.wave >= 2 && run.random() < 0.22) {
                kind = 'brute';
            }
            const enemy = createEnemy(kind, position, this.wave);
            enemy.attackCooldown = 0.7 + run.random();
            enemy.sidestep = run.random() < 0.5 ? -1 : 1;
            run.enemies.push(enemy);
            run.emit('spawn', { position });
            return true;
        }
        return false;
    }

    blockedSpawn(position) {
        return this.run.walls.some((box) => {
            const insideX = position[0] > box.min[0] - 1.2 && position[0] < box.max[0] + 1.2;
            const insideZ = position[2] > box.min[2] - 1.2 && position[2] < box.max[2] + 1.2;
            return insideX && insideZ && box.max[1] > 0.2 && box.min[1] < 2;
        });
    }

    updateEnemy(enemy, dt) {
        enemy.flashRemaining = Math.max(0, enemy.flashRemaining - dt);
        enemy.staggerRemaining = Math.max(0, enemy.staggerRemaining - dt);
        enemy.stunRemaining = Math.max(0, enemy.stunRemaining - dt);
        enemy.attackCooldown -= dt;
        const player = this.run.player.position;
        const direction = directionTo(enemy.position, player);
        const range = distance(enemy.position, player);
        const visible = hasLineOfSight(enemy.position, player, this.run.walls);
        enemy.yaw = Math.atan2(direction[0], direction[2]);
        if (enemy.staggerRemaining > 0 || enemy.stunRemaining > 0) {
            return;
        }

        if (enemy.kind === 'brute' && this.updateCharge(enemy, dt, direction, range, visible)) {
            return;
        }
        this.pursue(enemy, dt, direction, range, visible);
        if (range < enemy.radius + 0.7 && visible && enemy.attackCooldown <= 0) {
            this.run.damage(ENEMIES[enemy.kind].damage);
            enemy.attackCooldown = 0.7;
        }
        if (enemy.kind === 'caster' && visible && range < 38 && enemy.attackCooldown <= 0) {
            this.fire(enemy, direction);
            enemy.attackCooldown = Math.max(0.9, 1.9 - this.wave * 0.06);
        }
    }

    updateCharge(enemy, dt, direction, range, visible) {
        if (enemy.chargeWindup > 0) {
            enemy.chargeWindup = Math.max(0, enemy.chargeWindup - dt);
            if (enemy.chargeWindup === 0) {
                enemy.chargeRemaining = 0.55;
            }
            return true;
        }
        if (enemy.chargeRemaining > 0) {
            enemy.chargeRemaining = Math.max(0, enemy.chargeRemaining - dt);
            moveBody(
                enemy.position,
                enemy.chargeDirection.map((value) => value * 17 * dt),
                this.run.walls,
                enemy.radius,
            );
            if (distance(enemy.position, this.run.player.position) < 1.6 && visible) {
                this.run.damage(30);
                enemy.chargeRemaining = 0;
            }
            return true;
        }
        if (range > 5 && range < 17 && visible && enemy.attackCooldown <= 0) {
            // Lock the direction before the warning: strafing or dashing can evade it.
            enemy.chargeDirection = [direction[0], 0, direction[2]];
            enemy.chargeWindup = 0.65;
            enemy.attackCooldown = 3.5;
            this.run.emit('charge', { position: [...enemy.position] });
            return true;
        }
        return false;
    }

    pursue(enemy, dt, direction, range, visible) {
        let approach = 1;
        let strafe = 0;
        if (enemy.kind === 'caster' && visible && range < 16) {
            approach = range < 8 ? -0.8 : 0;
            strafe = enemy.sidestep * 0.6;
        }
        const movement = [
            direction[0] * approach + direction[2] * strafe,
            0,
            direction[2] * approach - direction[0] * strafe,
        ];
        // A small separation force prevents a pack from becoming a single stack.
        for (const other of this.run.enemies) {
            const gap = distance(enemy.position, other.position);
            if (other !== enemy && !other.dead && gap > 0 && gap < 1.7) {
                movement[0] += ((enemy.position[0] - other.position[0]) / gap) * 0.6;
                movement[2] += ((enemy.position[2] - other.position[2]) / gap) * 0.6;
            }
        }
        const length = Math.max(1, Math.hypot(...movement));
        const before = [...enemy.position];
        moveBody(
            enemy.position,
            movement.map((value) => (value / length) * enemy.speed * dt),
            this.run.walls,
            enemy.radius,
        );
        if (approach && distance(before, enemy.position) < enemy.speed * dt * 0.4) {
            const slide = [direction[2] * enemy.sidestep, 0, -direction[0] * enemy.sidestep];
            moveBody(
                enemy.position,
                slide.map((value) => value * enemy.speed * dt),
                this.run.walls,
                enemy.radius,
            );
        }
    }

    fire(enemy, direction) {
        const speed = 11 + Math.min(5, this.wave * 0.3);
        this.run.projectiles.push({
            position: [...enemy.position],
            velocity: direction.map((value) => value * speed),
            life: 5,
        });
    }

    updateProjectiles(dt) {
        for (const projectile of this.run.projectiles) {
            projectile.life -= dt;
            const speed = Math.hypot(...projectile.velocity);
            const direction = projectile.velocity.map((value) => value / speed);
            const travel = speed * dt;
            const obstruction = wallDistance(
                projectile.position,
                direction,
                this.run.walls,
                travel + 0.001,
            );
            const playerBox = entityBox(this.run.player.position, 0.38, 0.65);
            const hit = rayBox(projectile.position, direction, playerBox, travel);
            if (hit !== null && hit < obstruction) {
                this.run.damage(14);
                projectile.life = 0;
            }
            if (obstruction <= travel) {
                projectile.life = 0;
            }
            projectile.position = projectile.position.map(
                (value, axis) => value + projectile.velocity[axis] * dt,
            );
        }
        this.run.projectiles = this.run.projectiles.filter((projectile) => projectile.life > 0);
    }
}
