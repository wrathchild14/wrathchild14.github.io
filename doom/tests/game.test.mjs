import test from 'node:test';
import assert from 'node:assert/strict';
import Run from '../game/Run.js';
import Player from '../game/Player.js';
import Input, { emptyInput } from '../game/Input.js';
import { createEnemy } from '../game/Enemies.js';
import { entityBox, moveBody, rayBox } from '../game/collision.js';
import { MELEE, PLAYER, WEAPONS } from '../game/config.js';

function createRun() {
    const run = new Run([], () => 0.5);
    run.state = 'playing';
    run.player.position = [0, 1.25, 0];
    run.director.breakRemaining = Infinity;
    return run;
}

function advance(run, seconds, overrides = {}) {
    const steps = Math.ceil(seconds * 120);
    for (let step = 0; step < steps; step++) {
        run.update(seconds / steps, { ...emptyInput(), ...overrides });
    }
}

function enemyAhead(run, kind = 'hunter', range = 2.5) {
    const enemy = createEnemy(kind, [0, 1, -range]);
    run.enemies.push(enemy);
    return enemy;
}

test('simulation imports and runs without DOM, WebGL, audio, or glMatrix', () => {
    assert.equal(typeof document, 'undefined');
    assert.equal(typeof glMatrix, 'undefined');
    const run = createRun();
    advance(run, 1);
    assert.ok(Math.abs(run.elapsed - 1) < 0.001);
});

test('ray casting handles occlusion, parallel rays, range, and inside origins', () => {
    const box = entityBox([0, 0, -5], 1, 1);
    assert.equal(rayBox([0, 0, 0], [0, 0, -1], box), 4);
    assert.equal(rayBox([2, 0, 0], [0, 0, -1], box), null);
    assert.equal(rayBox([0, 0, 0], [0, 0, -1], box, 3), null);
    assert.equal(rayBox([0, 0, -5], [0, 0, -1], box), 0);
});

test('swept movement slides along a wall and cannot dash through thin geometry', () => {
    const position = [0, 1, 0];
    const wall = { min: [1, 0, -10], max: [1.1, 3, 10] };
    moveBody(position, [5, 0, 1], [wall]);
    assert.equal(position[0], 0.65);
    assert.equal(position[2], 1);
    moveBody(position, [200, 0, -200], []);
    assert.deepEqual(position, [48, 1, -48]);
});

test('movement is stable across frame rates and diagonal movement is normalized', () => {
    const simulate = (fps, diagonal = false) => {
        const player = new Player();
        player.position = [0, 1.25, 0];
        const input = { ...emptyInput(), forward: 1, right: Number(diagonal) };
        for (let step = 0; step < fps; step++) {
            player.update(1 / fps, input, []);
        }
        return Math.hypot(player.position[0], player.position[2]);
    };
    assert.ok(Math.abs(simulate(60) - simulate(144)) < 0.06);
    assert.ok(Math.abs(simulate(60) - simulate(60, true)) < 0.001);
});

test('gunfire hits only the nearest target and cannot pass through walls', () => {
    const run = createRun();
    const near = enemyAhead(run, 'hunter', 5);
    const far = enemyAhead(run, 'hunter', 8);
    run.walls = [{ min: [-3, 0, -3], max: [3, 3, -2] }];
    run.combat.shoot();
    assert.equal(near.health, 100);
    run.walls = [];
    run.combat.cooldown = 0;
    run.combat.shoot();
    assert.equal(near.health, 70);
    assert.equal(far.health, 100);
    assert.equal(run.kills, 0);
});

test('vertical aiming affects hits and a dead target cannot score twice', () => {
    const run = createRun();
    run.player.pitch = Math.PI / 4;
    const enemy = enemyAhead(run, 'hunter', 5);
    enemy.position[1] = 6.25;
    enemy.health = 30;
    run.combat.shoot();
    run.kill(enemy, 'shot');
    assert.equal(run.kills, 1);
    assert.equal(run.score, 100);
});

test('quick clicks survive between frames and are consumed only once', () => {
    const listeners = new Map();
    const target = {
        addEventListener: (name, handler) => listeners.set(name, handler),
        removeEventListener: (name) => listeners.delete(name),
    };
    const input = new Input(target, () => {});
    input.enable();
    listeners.get('mousedown')({ button: 0 });
    listeners.get('mouseup')({ button: 0 });
    const run = createRun();
    run.update(1 / 120, input.read());
    advance(run, 0.2);
    assert.equal(run.combat.ammo[0], WEAPONS[0].capacity - 1);
    assert.deepEqual(input.read().actions, []);
    input.disable();
    assert.equal(listeners.size, 0);
});

test('melee chains jab, cross, and cleave; misses reset the chain', () => {
    const run = createRun();
    const brute = enemyAhead(run, 'brute');
    const neighbor = createEnemy('brute', [0.8, 1, -2.5]);
    run.combat.melee();
    assert.equal(brute.health, 210);
    run.combat.meleeCooldown = 0;
    run.combat.melee();
    assert.equal(brute.health, 165);
    run.enemies.push(neighbor);
    run.combat.meleeCooldown = 0;
    run.combat.melee();
    assert.equal(brute.health, 75);
    assert.equal(neighbor.health, 150);
    assert.equal(run.combat.comboStep, 0);
    run.enemies = [];
    run.combat.comboStep = 1;
    run.combat.melee();
    assert.equal(run.combat.comboStep, 0);
});

test('melee combo times out and a held key cannot repeat attacks', () => {
    const run = createRun();
    enemyAhead(run, 'brute');
    run.update(1 / 120, { ...emptyInput(), actions: ['melee'] });
    assert.equal(run.combat.comboStep, 1);
    advance(run, MELEE.comboWindow + 0.1);
    assert.equal(run.combat.comboStep, 0);
    const swings = run.drainEvents().filter((event) => event.type === 'melee');
    assert.equal(swings.length, 1);
});

test('melee and finishers respect facing, range, and line of sight', () => {
    const run = createRun();
    const enemy = enemyAhead(run);
    enemy.staggerRemaining = 2;
    run.walls = [{ min: [-2, 0, -2], max: [2, 3, -1.5] }];
    assert.equal(run.combat.finisherTarget(), undefined);
    run.combat.melee();
    assert.equal(enemy.dead, false);
    run.walls = [];
    run.player.yaw = Math.PI;
    assert.equal(run.combat.finisherTarget(), undefined);
    run.player.yaw = 0;
    enemy.position[2] = -5;
    assert.equal(run.combat.finisherTarget(), undefined);
});

test('stagger creates a finite opening; a finisher restores health, ammo, and dash', () => {
    const run = createRun();
    const enemy = enemyAhead(run);
    run.player.health = 50;
    run.player.dashCharges = 0;
    run.combat.ammo = [0, 0];
    run.combat.hitEnemy(enemy, 75, 'shot');
    assert.equal(enemy.staggerRemaining, MELEE.staggerDuration);
    assert.equal(run.combat.finisherTarget(), enemy);
    run.combat.melee();
    assert.equal(enemy.dead, true);
    assert.equal(run.finishers, 1);
    assert.equal(run.player.health, 80);
    assert.equal(run.player.dashCharges, 1);
    assert.deepEqual(
        run.combat.ammo,
        WEAPONS.map((weapon) => weapon.capacity),
    );
    assert.equal(run.player.rage, MELEE.finisherRage);
    assert.equal(run.score, 200);
    assert.ok(run.player.invulnerable > 0);
});

test('ignored stagger expires and cannot be refreshed indefinitely', () => {
    const run = createRun();
    const enemy = enemyAhead(run, 'brute', 7);
    run.combat.hitEnemy(enemy, 170, 'shot');
    advance(run, MELEE.staggerDuration + 0.1);
    assert.equal(enemy.staggerRemaining, 0);
    run.combat.hitEnemy(enemy, 1, 'shot');
    assert.equal(enemy.staggerRemaining, 0);
});

test('dash spends two charges, blocks damage while active, and recharges', () => {
    const run = createRun();
    const dashInput = { ...emptyInput(), right: 1, actions: ['dash'] };
    run.update(1 / 120, dashInput);
    const health = run.player.health;
    run.damage(25);
    assert.equal(run.player.health, health);
    assert.equal(run.player.dashCharges, 1);
    advance(run, 0.2);
    run.update(1 / 120, dashInput);
    assert.equal(run.player.dashCharges, 0);
    assert.equal(run.player.dash(dashInput), false);
    advance(run, PLAYER.dashRecharge * 2);
    assert.equal(run.player.dashCharges, 2);
});

test('berserk needs full rage, doubles melee damage, and expires', () => {
    const run = createRun();
    assert.equal(run.player.activateBerserk(), false);
    run.player.rage = 100;
    assert.equal(run.player.activateBerserk(), true);
    const enemy = enemyAhead(run, 'brute');
    run.combat.melee();
    assert.equal(enemy.health, 180);
    assert.equal(run.player.rage, 0);
    run.enemies = [];
    advance(run, PLAYER.berserkDuration + 0.1);
    assert.equal(run.player.berserk, false);
});

test('reload can be interrupted by melee and resumes only on another request', () => {
    const run = createRun();
    run.combat.ammo[0] = 0;
    run.combat.reload();
    assert.ok(run.combat.reloadRemaining > 0);
    run.combat.melee();
    assert.equal(run.combat.reloadRemaining, 0);
    assert.equal(run.combat.ammo[0], 0);
    run.combat.reload();
    advance(run, WEAPONS[0].reload + 0.1);
    assert.equal(run.combat.ammo[0], WEAPONS[0].capacity);
});

test('waves count real eliminations and recover only after the entire wave ends', () => {
    const run = createRun();
    const enemy = enemyAhead(run);
    run.director.waveActive = true;
    run.player.health = 50;
    run.kill(enemy, 'shot');
    assert.equal(run.kills, 1);
    advance(run, 0.1);
    assert.equal(run.player.health, 65);
    assert.equal(run.director.waveActive, false);
    assert.ok(run.director.breakRemaining > 0);
});

test('brute charge telegraphs and locks its direction before moving', () => {
    const run = createRun();
    const brute = enemyAhead(run, 'brute', 9);
    brute.attackCooldown = 0;
    advance(run, 0.01);
    assert.ok(brute.chargeWindup > 0);
    const direction = [...brute.chargeDirection];
    run.player.position[0] = 8;
    advance(run, 0.7);
    assert.deepEqual(brute.chargeDirection, direction);
    assert.ok(brute.chargeRemaining > 0);
});

test('pause freezes health, time, cooldowns, and wave progress', () => {
    const run = createRun();
    run.combat.reloadRemaining = 1;
    run.player.berserkRemaining = 3;
    run.state = 'paused';
    const snapshot = JSON.stringify({
        player: run.player,
        elapsed: run.elapsed,
        wave: run.director.wave,
    });
    advance(run, 2, { actions: ['dash', 'melee'], firing: true });
    assert.equal(
        JSON.stringify({ player: run.player, elapsed: run.elapsed, wave: run.director.wave }),
        snapshot,
    );
    assert.equal(run.combat.reloadRemaining, 1);
});

test('damage grace, death, and new-run state cannot leak into each other', () => {
    const run = createRun();
    run.damage(16);
    run.damage(16);
    assert.equal(run.player.health, 84);
    run.player.invulnerable = 0;
    run.damage(100);
    advance(run, 1);
    assert.equal(run.state, 'dead');
    assert.equal(run.player.health, 0);
    const fresh = new Run();
    assert.equal(fresh.player.health, 100);
    assert.equal(fresh.score, 0);
    assert.equal(fresh.elapsed, 0);
    assert.equal(fresh.projectiles.length, 0);
    assert.equal(fresh.player.rage, 0);
});

test('enemy projectiles cannot damage a player through a nearer wall', () => {
    const run = createRun();
    run.walls = [{ min: [-3, 0, -3], max: [3, 3, -2] }];
    run.projectiles.push({ position: [0, 1.25, -5], velocity: [0, 0, 60], life: 2 });
    run.director.updateProjectiles(0.1);
    assert.equal(run.player.health, 100);
    assert.equal(run.projectiles.length, 0);
});

test('health rewards are capped and dead runs cannot recover through updates', () => {
    const run = createRun();
    const enemy = enemyAhead(run);
    run.player.health = 95;
    run.combat.hitEnemy(enemy, 75, 'shot');
    run.combat.melee();
    assert.equal(run.player.health, 100);
    run.player.invulnerable = 0;
    run.damage(100);
    run.pickups.push({ position: [...run.player.position], life: 10 });
    advance(run, 2);
    assert.equal(run.player.health, 0);
});

test('a deterministic long run progresses through waves without leaking projectiles', () => {
    let seed = 42;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const run = new Run([], random);
    run.state = 'playing';
    let highestWave = 0;
    for (let step = 0; step < 120 * 90; step++) {
        const enemy = run.enemies.find((candidate) => !candidate.dead);
        const input = emptyInput();
        if (enemy) {
            const dx = enemy.position[0] - run.player.position[0];
            const dz = enemy.position[2] - run.player.position[2];
            run.player.yaw = Math.atan2(-dx, -dz);
            input.firing = true;
            if (distanceForTest(enemy.position, run.player.position) < 3) {
                input.actions = ['melee'];
            }
        }
        run.update(1 / 120, input);
        run.drainEvents();
        highestWave = Math.max(highestWave, run.director.wave);
        assert.ok(run.enemies.length <= 24);
        assert.ok(run.projectiles.length < 160);
        assert.ok(run.player.position.every(Number.isFinite));
        if (run.state === 'dead') break;
    }
    assert.ok(run.kills >= 5, `Expected active combat, got ${run.kills} kills`);
    assert.ok(highestWave >= 2, `Expected wave progression, got wave ${highestWave}`);
});

function distanceForTest(a, b) {
    return Math.hypot(...a.map((value, axis) => value - b[axis]));
}
