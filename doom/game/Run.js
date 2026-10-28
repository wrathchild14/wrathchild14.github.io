import Player from './Player.js';
import Combat from './Combat.js';
import Enemies from './Enemies.js';
import { ENEMIES, MELEE, PLAYER, WAVES } from './config.js';
import { distance } from './collision.js';

// One run owns the simulation. It emits plain event objects for presentation,
// but never reads the DOM, plays audio, or calls WebGL.
export default class Run {
    constructor(walls = [], random = Math.random) {
        this.walls = walls;
        this.random = random;
        this.player = new Player();
        this.combat = new Combat(this);
        this.director = new Enemies(this);
        this.enemies = [];
        this.projectiles = [];
        this.pickups = [];
        this.events = [];
        this.state = 'ready';
        this.elapsed = 0;
        this.score = 0;
        this.kills = 0;
        this.finishers = 0;
        this.chain = 0;
        this.chainRemaining = 0;
        this.message = '';
        this.messageRemaining = 0;
    }

    get multiplier() {
        return Math.min(4, 1 + Math.floor(Math.max(0, this.chain - 1) / 3));
    }

    emit(type, detail = {}) {
        this.events.push({ type, ...detail });
    }

    drainEvents() {
        const events = this.events;
        this.events = [];
        return events;
    }

    announce(message, duration = 2) {
        this.message = message;
        this.messageRemaining = duration;
    }

    update(dt, input) {
        if (this.state !== 'playing') {
            return;
        }
        this.elapsed += dt;
        this.chainRemaining = Math.max(0, this.chainRemaining - dt);
        this.messageRemaining = Math.max(0, this.messageRemaining - dt);
        this.player.aim(input, dt);
        this.handleActions(input);
        this.player.update(dt, input, this.walls);
        this.combat.update(dt, input);
        this.director.update(dt);
        if (this.state === 'playing') {
            this.updatePickups(dt);
        }
    }

    handleActions(input) {
        for (const action of input.actions) {
            if (action === 'rifle') this.combat.switchWeapon(0);
            if (action === 'shotgun') this.combat.switchWeapon(1);
            if (action === 'reload') this.combat.reload();
            if (action === 'dash' && this.player.dash(input)) this.emit('dash');
            if (action === 'berserk' && this.player.activateBerserk()) {
                this.announce('BERSERK / RIP THROUGH THEM', 1.8);
                this.emit('berserk');
            }
        }
    }

    kill(enemy, source) {
        if (enemy.dead) {
            return;
        }
        enemy.dead = true;
        this.kills++;
        this.chain = this.chainRemaining > 0 ? this.chain + 1 : 1;
        this.chainRemaining = 4;
        const styleBonus = source === 'finisher' ? 2 : source === 'melee' ? 1.5 : 1;
        this.score += Math.round(ENEMIES[enemy.kind].score * this.multiplier * styleBonus);

        const rageGain = source === 'finisher' ? MELEE.finisherRage : source === 'melee' ? 16 : 8;
        if (!this.player.berserk) {
            this.player.rage = Math.min(100, this.player.rage + rageGain);
        }
        if (source === 'finisher') {
            this.finishers++;
        }
        if (source === 'melee') {
            this.player.health = Math.min(PLAYER.health, this.player.health + 10);
        }
        if (this.kills % 4 === 0) {
            this.pickups.push({ position: [...enemy.position], life: 15 });
        }
        this.emit('kill', {
            position: [...enemy.position], source, kind: enemy.kind, yaw: enemy.yaw,
        });
    }

    damage(amount) {
        if (this.state !== 'playing' || this.player.invulnerable > 0) {
            return;
        }
        this.player.health = Math.max(0, this.player.health - amount);
        this.player.invulnerable = PLAYER.damageGrace;
        this.emit('damage');
        if (this.player.health === 0) {
            this.state = 'dead';
            this.emit('death');
        }
    }

    recoverWave() {
        this.player.health = Math.min(PLAYER.health, this.player.health + WAVES.healthRecovery);
        this.combat.refill();
        this.player.dashCharges = PLAYER.dashCharges;
        this.announce(`WAVE CLEARED / +${WAVES.healthRecovery} HEALTH`, 1.8);
    }

    updatePickups(dt) {
        for (const pickup of this.pickups) {
            pickup.life -= dt;
            const close = distance(pickup.position, this.player.position) < 1.8;
            if (close && this.player.health < PLAYER.health) {
                this.player.health = Math.min(PLAYER.health, this.player.health + 20);
                pickup.life = 0;
                this.announce('+20 HEALTH', 0.8);
                this.emit('pickup');
            }
        }
        this.pickups = this.pickups.filter((pickup) => pickup.life > 0);
    }
}
