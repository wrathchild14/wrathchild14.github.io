// Gameplay tuning lives here. Distances are world units; durations are seconds.
export const PLAYER = {
    health: 100,
    speed: 10,
    acceleration: 22,
    radius: 0.35,
    eyeHeight: 1.25,
    damageGrace: 0.45,
    dashSpeed: 29,
    dashDuration: 0.16,
    dashRecharge: 1.3,
    dashCharges: 2,
    berserkDuration: 7,
};

export const WEAPONS = [
    {
        name: '01 / PULSE RIFLE',
        capacity: 30,
        interval: 0.095,
        reload: 0.85,
        damage: 30,
        pellets: 1,
        spread: 0.006,
        recoil: 0.09,
    },
    {
        name: '02 / SCATTERGUN',
        capacity: 8,
        interval: 0.5,
        reload: 1.1,
        damage: 22,
        pellets: 8,
        spread: 0.09,
        recoil: 0.2,
    },
];

export const MELEE = {
    range: 3.2,
    facing: 0.45,
    comboWindow: 0.85,
    damage: [30, 45, 90],
    cooldown: [0.22, 0.26, 0.48],
    names: ['JAB', 'CROSS', 'CRUSH'],
    staggerDuration: 3,
    finisherHealth: 30,
    finisherRage: 25,
};

export const ENEMIES = {
    hunter: { health: 100, speed: 4.5, radius: 0.65, damage: 12, score: 100, tint: [1, 1, 1] },
    caster: {
        health: 80,
        speed: 3.2,
        radius: 0.65,
        damage: 14,
        score: 125,
        tint: [0.8, 0.65, 1.4],
    },
    brute: { health: 240, speed: 2.6, radius: 0.9, damage: 25, score: 250, tint: [1.5, 0.55, 0.4] },
};

export const WAVES = {
    initialDelay: 0.8,
    breakDuration: 2.2,
    spawnInterval: 0.4,
    maxActive: 24,
    baseCount: 5,
    healthRecovery: 15,
};
