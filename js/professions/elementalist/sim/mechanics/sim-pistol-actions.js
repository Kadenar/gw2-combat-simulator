import { getProcState } from '../state/sim-proc-state.js';
import { pushTimedStack } from '../state/sim-runtime-state.js';
import { queueRuntimeAction, buildShatteringStoneArmAction } from '../shared/sim-deferred-runtime-actions.js';

function bulletCondName(element) {
    return element === 'Water' ? 'Ice Bullet' : `${element} Bullet`;
}

function consumeBullet(ctx, element, end, skillName) {
    const { S } = ctx;
    S.pistolBullets[element] = false;
    const mapEntry = S._pistolBulletMapEntry[element];
    if (mapEntry) {
        mapEntry.expiresAt = end;
        S._pistolBulletMapEntry[element] = null;
    }
    ctx.log({ t: end, type: 'skill_proc', skill: skillName, detail: `${element} bullet consumed` });
}

function grantBullet(ctx, element, end, skillName, { permaExpiry }) {
    const { S } = ctx;
    S.pistolBullets[element] = true;
    const entry = { t: end, cond: bulletCondName(element), expiresAt: permaExpiry };
    pushTimedStack(S, entry);
    S._pistolBulletMapEntry[element] = entry;
    ctx.log({ t: end, type: 'skill_proc', skill: skillName, detail: `${element} bullet granted` });
}

export function applyPistolDualConsumeEffect(ctx, sk, name, element, end, start) {
    const { S } = ctx;
    if (name === 'Frostfire Flurry') {
        if (element === 'Fire') {
            ctx.applyAura('Fire Aura', 3000, end, name);
        } else if (element === 'Water') {
            ctx.applyCondition('Vulnerability', 4, 8, end, name);
        }
    } else if (name === 'Purblinding Plasma') {
        if (element === 'Fire') {
            ctx.applyCondition('Burning', 3, 4, end, name);
        }
    } else if (name === 'Molten Meteor') {
        if (element === 'Earth') {
            ctx.queueHitEvent({
                time: end,
                skill: name, hitIdx: 99, sub: 1, totalSubs: 1,
                dmg: 0, ws: 0, isField: false, cc: false,
                conds: { Bleeding: { stacks: 3, duration: 8 } },
                att: S.att, att2: S.att2, castStart: start,
                isTraitProc: true, noCrit: true,
            });
        }
    } else if (name === 'Flowing Finesse') {
        if (element === 'Water') {
            ctx.applyAura('Frost Aura', 3000, end, name);
        } else if (element === 'Air') {
            ctx.trackEffect('Superspeed', 1, 4, end);
        }
    } else if (name === 'Enervating Earth') {
        if (element === 'Air') {
            ctx.queueHitEvent({
                time: end,
                skill: name, hitIdx: 99, sub: 1, totalSubs: 1,
                dmg: 0, ws: 0, isField: false, cc: true, conds: null,
                att: S.att, att2: S.att2, castStart: start,
                isTraitProc: true, noCrit: true,
            });
        } else if (element === 'Earth') {
            ctx.queueHitEvent({
                time: end,
                skill: name, hitIdx: 99, sub: 1, totalSubs: 1,
                dmg: 0, ws: 0, isField: false, cc: false,
                conds: { Bleeding: { stacks: 4, duration: 8 } },
                att: S.att, att2: S.att2, castStart: start,
                isTraitProc: true, noCrit: true,
            });
        }
    }
}

function handleBasePistolBullet(ctx, sk, name, start, end) {
    const { S } = ctx;
    const procState = getProcState(S);
    const element = ctx.pistolSkillElement[name];
    if (!element) return;

    const canConsume = !ctx.pistolNoConsume.has(name);
    const canGrant = !ctx.pistolNoGrant.has(name);
    const hasIt = S.pistolBullets[element];

    if (canConsume && hasIt) {
        consumeBullet(ctx, element, end, name);

        if (name === 'Raging Ricochet') {
            ctx.trackEffect('Might', 1, 10, end);
        } else if (name === 'Searing Salvo') {
            ctx.applyAura('Fire Aura', 4000, end, 'Searing Salvo');
        } else if (name === 'Frozen Fusillade') {
            const hitTime = end + 4000;
            ctx.queueHitEvent({
                time: hitTime,
                skill: 'Frozen Fusillade', hitIdx: 99, sub: 1, totalSubs: 1,
                dmg: 0.75, ws: ctx.weaponStrength(sk),
                isField: false, cc: false,
                conds: { Bleeding: { stacks: 5, duration: 8 } },
                att: S.att, att2: S.att2, castStart: start,
            });
            ctx.log({ t: end, type: 'skill_proc', skill: 'Frozen Fusillade', detail: `Ice explosion queued at t=${hitTime}ms (5×Bleed)` });
        } else if (name === 'Dazing Discharge') {
            procState.dazingDischargeUntil = end + 5000;
            ctx.log({ t: end, type: 'skill_proc', skill: 'Dazing Discharge', detail: 'next Pistol CD -33% armed (5s)' });
        } else if (name === 'Shattering Stone') {
            queueRuntimeAction(S, buildShatteringStoneArmAction({
                time: end,
                until: end + 10000,
            }));
        } else if (name === 'Boulder Blast') {
            ctx.queueHitEvent({
                time: end,
                skill: 'Boulder Blast', hitIdx: 99, sub: 1, totalSubs: 1,
                dmg: 0, ws: 0, isField: false, cc: false, conds: null,
                finType: 'Projectile', finVal: 1,
                att: S.att, att2: S.att2, castStart: start,
                isTraitProc: true, noCrit: true,
            });
        }
    } else if (canGrant && !hasIt) {
        grantBullet(ctx, element, end, name, { permaExpiry: 999999999 });
    }
}

function handleDualPistolBullet(ctx, sk, name, start, end) {
    const { S } = ctx;
    const dualEls = ctx.pistolDualElements[name];
    if (!dualEls) return;

    const [priEl, secEl] = dualEls;
    const hasPri = S.pistolBullets[priEl];
    const hasSec = S.pistolBullets[secEl];
    let anyConsumed = false;

    if (hasPri) {
        consumeBullet(ctx, priEl, end, name);
        anyConsumed = true;
    }
    if (hasSec) {
        consumeBullet(ctx, secEl, end, name);
        anyConsumed = true;
    }

    if (hasPri) applyPistolDualConsumeEffect(ctx, sk, name, priEl, end, start);
    if (hasSec) applyPistolDualConsumeEffect(ctx, sk, name, secEl, end, start);

    if (!anyConsumed) {
        grantBullet(ctx, S.att, end, name, { permaExpiry: ctx.permaExpiry });
    }
}

export function handlePistolPostCast(ctx, sk, name, start, end) {
    const { S } = ctx;
    if (sk.weapon !== 'Pistol' || sk.type !== 'Weapon skill') return;
    if (sk.slot !== '2' && sk.slot !== '3') return;
    if (name === 'Elemental Explosion') return;

    const isDual = sk.attunement && sk.attunement.includes('+');
    if (!isDual) {
        handleBasePistolBullet(ctx, sk, name, start, end);
    } else {
        handleDualPistolBullet(ctx, sk, name, start, end);
    }
}
