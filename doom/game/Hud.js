import { MELEE, PLAYER, WEAPONS } from './config.js';

export function formatTime(seconds) {
    const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
    const remainder = String(Math.floor(seconds % 60)).padStart(2, '0');
    return `${minutes}:${remainder}`;
}

export default class Hud {
    constructor() {
        this.elements = new Map();
    }

    element(id) {
        if (!this.elements.has(id)) {
            this.elements.set(id, document.getElementById(id));
        }
        return this.elements.get(id);
    }

    text(id, value) {
        const element = this.element(id);
        const text = String(value);
        if (element.textContent !== text) {
            element.textContent = text;
        }
    }

    menu(label, title, description, button) {
        this.text('menuLabel', label);
        this.element('menuTitle').innerHTML = title;
        this.text('menuText', description);
        this.text('play', button);
        this.element('menu').hidden = false;
        this.element('play').disabled = false;
        this.element('restart').hidden = true;
        this.element('results').hidden = true;
        document.body.classList.add('paused');
        document.querySelector('.topbar').inert = true;
        this.element('play').focus();
    }

    hideMenu() {
        this.element('menu').hidden = true;
        document.body.classList.remove('paused');
        document.querySelector('.topbar').inert = false;
        this.element('arena').focus();
    }

    results(run, record) {
        this.menu(
            record ? 'NEW PERSONAL BEST' : 'SIGNAL LOST',
            'HELL WINS.<br><em>FOR NOW.</em>',
            'Get closer. Hit harder. Take back what you need.',
            'ONE MORE RUN →',
        );
        this.element('results').hidden = false;
        const stats = [
            [run.score, 'SCORE'],
            [run.kills, 'KILLS'],
            [run.finishers, 'FINISHERS'],
            [formatTime(run.elapsed), 'SURVIVED'],
        ];
        this.element('results').innerHTML = stats
            .map(([value, label]) => `<div><strong>${value}</strong>${label}</div>`)
            .join('');
    }

    render(run, best, feedback) {
        const { player, combat, director } = run;
        const hostiles = run.enemies.filter((enemy) => !enemy.dead).length + director.pending;
        this.text('wave', `WAVE ${String(Math.max(1, director.wave)).padStart(2, '0')}`);
        this.text(
            'remaining',
            hostiles ? `${hostiles} HOSTILES REMAINING` : 'REINFORCEMENTS INBOUND',
        );
        this.text('score', String(run.score).padStart(6, '0'));
        this.text('best', `BEST ${String(Math.max(best, run.score)).padStart(6, '0')}`);
        this.text('kills', run.kills);
        this.text('health', player.health);
        this.text('timer', formatTime(run.elapsed));
        this.element('healthbar').style.width = `${player.health}%`;
        this.element('healthbar').style.background = player.health < 30 ? '#ff3030' : '';
        this.text(
            'combo',
            run.chainRemaining > 0 && run.chain > 1
                ? `${run.chain} KILL CHAIN / ×${run.multiplier} SCORE`
                : 'GET CLOSE. TAKE IT BACK.',
        );

        const weapon = WEAPONS[combat.weapon];
        const reloading = combat.reloadRemaining > 0;
        const ammoProgress = reloading
            ? 1 - combat.reloadRemaining / weapon.reload
            : combat.ammo[combat.weapon] / weapon.capacity;
        this.text('ammo', reloading ? '··' : combat.ammo[combat.weapon]);
        this.text('capacity', `/ ${weapon.capacity}`);
        this.text('weaponname', reloading ? 'RELOADING / F TO INTERRUPT' : weapon.name);
        this.element('ammobar').style.width = `${100 * ammoProgress}%`;

        this.renderAbilities(run);
        this.text('announcement', run.message);
        this.element('announcement').style.opacity = run.messageRemaining > 0 ? 1 : 0;
        this.element('damage').style.opacity = feedback.damage;
        this.element('hitmarker').style.opacity = feedback.hit > 0 ? 1 : 0;
        this.element('finisher-flash').style.opacity = Math.min(0.25, feedback.finisher);
        document.body.classList.toggle('berserk', player.berserk);
    }

    renderAbilities(run) {
        const { player, combat } = run;
        this.text('dash-count', `${player.dashCharges} / ${PLAYER.dashCharges}`);
        const recharge =
            player.dashCharges === PLAYER.dashCharges
                ? 1
                : player.dashRecharge / PLAYER.dashRecharge;
        this.element('dashbar').style.width = `${100 * recharge}%`;
        this.element('dash-ability').classList.toggle('ready', player.dashCharges > 0);

        const rageProgress = player.berserk
            ? player.berserkRemaining / PLAYER.berserkDuration
            : player.rage / 100;
        this.element('ragebar').style.width = `${100 * rageProgress}%`;
        this.text(
            'rage-state',
            player.berserk
                ? `${player.berserkRemaining.toFixed(1)}s`
                : player.rage === 100
                  ? 'READY'
                  : `${player.rage}%`,
        );
        this.element('rage-ability').classList.toggle(
            'ready',
            player.rage === 100 || player.berserk,
        );

        const chainActive = combat.comboRemaining > 0;
        this.text(
            'melee-state',
            chainActive ? `NEXT: ${MELEE.names[combat.comboStep]}` : 'JAB / CROSS / CRUSH',
        );
        this.element('meleebar').style.width =
            `${(100 * combat.comboRemaining) / MELEE.comboWindow}%`;
        const finisher = combat.finisherTarget();
        this.element('finisher-prompt').hidden = !finisher || run.state !== 'playing';
        this.element('crosshair').classList.toggle('finish-ready', Boolean(finisher));
    }
}
