import { MELEE, PLAYER, WEAPONS } from './config.js';
import {
    directionTo,
    distance,
    entityBox,
    hasLineOfSight,
    moveBody,
    rayBox,
    wallDistance,
} from './collision.js';

export default class Combat {
    constructor(run) {
        this.run = run;
        this.weapon = 0;
        this.ammo = WEAPONS.map((weapon) => weapon.capacity);
        this.cooldown = 0;
        this.reloadRemaining = 0;
        this.meleeCooldown = 0;
        this.comboStep = 0;
        this.comboRemaining = 0;
        this.fireBuffer = 0;
        this.meleeBuffer = 0;
    }

    get weaponDefinition() {
        return WEAPONS[this.weapon];
    }

    switchWeapon(index) {
        if (index === this.weapon) {
            return;
        }
        this.weapon = index;
        this.reloadRemaining = 0;
        this.cooldown = 0.1;
        this.fireBuffer = 0;
    }

    reload() {
        if (this.reloadRemaining > 0 || this.ammo[this.weapon] === this.weaponDefinition.capacity) {
            return;
        }
        this.reloadRemaining = this.weaponDefinition.reload;
        this.run.emit('reload');
    }

    refill() {
        this.ammo = WEAPONS.map((weapon) => weapon.capacity);
        this.reloadRemaining = 0;
    }

    update(dt, input) {
        this.cooldown = Math.max(0, this.cooldown - dt);
        this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
        this.comboRemaining = Math.max(0, this.comboRemaining - dt);
        this.fireBuffer = Math.max(0, this.fireBuffer - dt);
        this.meleeBuffer = Math.max(0, this.meleeBuffer - dt);
        if (this.comboRemaining === 0) {
            this.comboStep = 0;
        }

        if (input.actions.includes('fire')) {
            this.fireBuffer = 0.18;
        }
        if (input.actions.includes('melee')) {
            this.meleeBuffer = 0.18;
        }
        if (this.reloadRemaining > 0) {
            this.reloadRemaining = Math.max(0, this.reloadRemaining - dt);
            if (this.reloadRemaining === 0) {
                this.ammo[this.weapon] = this.weaponDefinition.capacity;
                this.run.emit('reload-complete');
            }
        }

        // Melee can interrupt a reload. Holding fire never repeats melee attacks.
        if (this.meleeBuffer > 0 && this.meleeCooldown === 0) {
            this.melee();
            this.meleeBuffer = 0;
        } else if (
            (input.firing || this.fireBuffer > 0) &&
            this.cooldown === 0 &&
            this.meleeCooldown === 0
        ) {
            this.shoot();
        }
    }

    shoot() {
        if (this.reloadRemaining > 0 || this.cooldown > 0 || this.meleeCooldown > 0) {
            return;
        }
        if (this.ammo[this.weapon] === 0) {
            this.reload();
            return;
        }

        const weapon = this.weaponDefinition;
        this.ammo[this.weapon]--;
        this.cooldown = weapon.interval;
        this.fireBuffer = 0;
        this.run.emit('shot', { weapon: this.weapon });

        for (let pellet = 0; pellet < weapon.pellets; pellet++) {
            const direction = this.run.player.direction();
            for (let axis = 0; axis < 3; axis++) {
                direction[axis] += (this.run.random() - 0.5) * weapon.spread;
            }
            const length = Math.hypot(...direction);
            this.fireRay(
                direction.map((value) => value / length),
                weapon.damage,
            );
        }
    }

    fireRay(direction, damage) {
        const origin = this.run.player.position;
        let closest = wallDistance(origin, direction, this.run.walls, 100);
        let target = null;

        for (const enemy of this.run.enemies) {
            if (enemy.dead) {
                continue;
            }
            const hit = rayBox(origin, direction, entityBox(enemy.position, enemy.radius), closest);
            if (hit !== null && hit < closest) {
                closest = hit;
                target = enemy;
            }
        }

        const position = origin.map((value, axis) => value + direction[axis] * closest);
        if (target) {
            this.hitEnemy(target, damage, 'shot');
        } else if (closest < 100) {
            this.run.emit('impact', { position, color: [1, 0.6, 0.2], count: 2 });
        }
    }

    meleeTargets() {
        const player = this.run.player;
        const facing = player.direction();
        return this.run.enemies
            .filter((enemy) => {
                if (enemy.dead || distance(player.position, enemy.position) > MELEE.range) {
                    return false;
                }
                const direction = directionTo(player.position, enemy.position);
                const dot = direction.reduce((sum, value, axis) => sum + value * facing[axis], 0);
                return (
                    dot > MELEE.facing &&
                    hasLineOfSight(player.position, enemy.position, this.run.walls)
                );
            })
            .sort(
                (a, b) =>
                    distance(player.position, a.position) - distance(player.position, b.position),
            );
    }

    finisherTarget() {
        return this.meleeTargets().find((enemy) => enemy.staggerRemaining > 0);
    }

    melee() {
        const run = this.run;
        const targets = this.meleeTargets();
        const finisher = targets.find((enemy) => enemy.staggerRemaining > 0);
        this.reloadRemaining = 0;
        this.fireBuffer = 0;

        if (finisher) {
            this.finish(finisher);
            return;
        }

        const step = this.comboStep;
        this.meleeCooldown = MELEE.cooldown[step];
        run.emit('melee', { step, hit: targets.length > 0 });
        if (targets.length === 0) {
            this.comboStep = 0;
            this.comboRemaining = 0;
            return;
        }

        // The third strike cleaves the entire frontal arc and pushes survivors back.
        const victims = step === 2 ? targets : targets.slice(0, 1);
        const damage = MELEE.damage[step] * (run.player.berserk ? 2 : 1);
        for (const enemy of victims) {
            this.hitEnemy(enemy, damage, 'melee');
            if (!enemy.dead) {
                enemy.stunRemaining = 0.4;
                const push = directionTo(run.player.position, enemy.position);
                moveBody(
                    enemy.position,
                    push.map((value) => value * (step === 2 ? 1.8 : 0.08)),
                    run.walls,
                    enemy.radius,
                );
            }
        }
        this.comboStep = (step + 1) % MELEE.damage.length;
        this.comboRemaining = MELEE.comboWindow;
        run.announce(`${step + 1} / ${MELEE.names[step]}`, 0.65);
    }

    finish(enemy) {
        const run = this.run;
        this.meleeCooldown = 0.4;
        this.comboStep = 0;
        this.comboRemaining = 0;
        run.kill(enemy, 'finisher');
        run.player.health = Math.min(PLAYER.health, run.player.health + MELEE.finisherHealth);
        run.player.invulnerable = 0.65;
        run.player.dashCharges = Math.min(PLAYER.dashCharges, run.player.dashCharges + 1);
        this.refill();
        run.emit('finisher', { position: [...enemy.position] });
        run.announce('RIP & OFF / HEALTH + AMMO + DASH', 1.6);
    }

    hitEnemy(enemy, damage, source) {
        if (enemy.dead) {
            return;
        }
        enemy.health -= damage;
        enemy.flashRemaining = 0.12;
        this.run.emit('hit', { position: [...enemy.position] });

        if (enemy.health <= 0) {
            this.run.kill(enemy, source);
        } else if (!enemy.wasStaggered && enemy.health <= enemy.maxHealth * 0.3) {
            // Each enemy can be staggered once. Ignoring the opening lets it recover.
            enemy.wasStaggered = true;
            enemy.staggerRemaining = MELEE.staggerDuration;
            this.run.emit('stagger', { position: [...enemy.position] });
        }
    }
}
