import { getCombatFields } from '../state/sim-combat-record-state.js';
import { isCombatActiveAt } from '../run/sim-run-phase-state.js';

const ELEMENTAL_EPITOME_AURAS = {
    Fire: ['Fire Aura', 4000],
    Water: ['Frost Aura', 4000],
    Air: ['Shocking Aura', 3000],
    Earth: ['Magnetic Aura', 3000],
};

function findActiveComboField(S, time) {
    const fields = getCombatFields(S);
    let permaMatch = null;
    for (const field of fields) {
        if (field.start > time || field.end <= time) continue;
        if (field.perma) { permaMatch = field; continue; }
        return field;
    }
    return permaMatch;
}

function triggerElementalEpitomeCombo(ctx, attunement, time) {
    const { S } = ctx;
    if (!S._hasElemEpitome) return;

    const icdKey = `EpitomeCombo_${attunement}`;
    if (!ctx.traitIcdReady(icdKey, time)) return;

    ctx.armTraitIcd(icdKey, time, 10000);
    const aura = ELEMENTAL_EPITOME_AURAS[attunement];
    if (aura) ctx.applyAura(aura[0], aura[1], time, 'Elemental Epitome');
}

function triggerElementalSynergyCombo(ctx, attunement, time) {
    const { S } = ctx;
    if (!S._hasElemSynergy) return;

    const icdKey = `SynergyCombo_${attunement}`;
    if (!ctx.traitIcdReady(icdKey, time)) return;

    ctx.armTraitIcd(icdKey, time, 10000);
    if (attunement === 'Fire') ctx.trackEffect('Might', 6, 10, time);
    else if (attunement === 'Earth') ctx.trackEffect('Stability', 2, 6, time);
    else if (attunement === 'Air') ctx.gainEndurance(50, time);
}

function triggerComboTraits(ctx, time) {
    const attunement = ctx.attAt(time);
    triggerElementalEpitomeCombo(ctx, attunement, time);
    triggerElementalSynergyCombo(ctx, attunement, time);
}

function applyComboEffect(ctx, fieldType, finType, time, skill) {
    const { S } = ctx;
    const source = `Combo (${fieldType}/${finType})`;

    if (fieldType === 'Fire') {
        if (finType === 'Blast') {
            ctx.trackEffect('Might', 3, 20, time);
        } else if (finType === 'Leap') {
            ctx.applyAura('Fire Aura', 5000, time, source);
        } else {
            ctx.applyCondition('Burning', 1, 1, time, source);
        }
    } else if (fieldType === 'Ice') {
        if (finType === 'Blast') {
            ctx.applyAura('Frost Aura', 3000, time, source);
        } else if (finType === 'Leap') {
            ctx.applyAura('Frost Aura', 5000, time, source);
        } else {
            ctx.trackEffect('Chilled', 1, 1, time);
        }
    } else if (fieldType === 'Lightning') {
        if (finType === 'Blast') {
            ctx.trackEffect('Swiftness', 1, 10, time);
        } else if (finType === 'Leap') {
            ctx.log({ t: time, type: 'combo', field: fieldType, finisher: finType, effect: 'CC', skill });
            return;
        } else {
            ctx.trackEffect('Vulnerability', 2, 5, time);
        }
    } else if (fieldType === 'Poison') {
        if (finType === 'Blast') {
            ctx.trackEffect('Weakness', 1, 3, time);
        } else if (finType === 'Leap') {
            ctx.trackEffect('Weakness', 1, 8, time);
        } else {
            ctx.applyCondition('Poisoned', 1, 2, time, source);
        }
    } else if (fieldType === 'Water') {
        if (finType === 'Projectile') {
            ctx.trackEffect('Regeneration', 1, 2, time);
        } else {
            return;
        }
    } else if (fieldType === 'Dark') {
        if (finType === 'Blast') {
            ctx.applyAura('Dark Aura', 3000, time, source);
        } else if (finType === 'Leap') {
            ctx.applyAura('Dark Aura', 5000, time, source);
        } else if (finType === 'Projectile') {
            ctx.queueHitEvent({
                time,
                skill: 'Life Stealing Projectile',
                hitIdx: 1,
                sub: 1,
                totalSubs: 1,
                dmg: 0,
                ws: 0,
                isField: false,
                cc: false,
                conds: null,
                noCrit: true,
                att: ctx.attAt(time),
                att2: ctx.att2At(time),
                castStart: time,
                isTraitProc: true,
                flatStrikeBase: 202,
                flatStrikePowerCoeff: 0.03,
            });
        } else if (finType === 'Whirl') {
            ctx.queueHitEvent({
                time,
                skill: 'Leeching Bolt',
                hitIdx: 1,
                sub: 1,
                totalSubs: 1,
                dmg: 0,
                ws: 0,
                isField: false,
                cc: false,
                conds: null,
                noCrit: true,
                att: ctx.attAt(time),
                att2: ctx.att2At(time),
                castStart: time,
                isTraitProc: true,
                flatStrikeBase: 170,
                flatStrikePowerCoeff: 0.03,
            });
        } else {
            return;
        }
    } else {
        return;
    }

    ctx.log({ t: time, type: 'combo', field: fieldType, finisher: finType, skill });
}

function triggerComboRelics(ctx, fieldType, finType, time) {
    const { S } = ctx;
    if (finType === 'Blast' && S.activeRelic === 'Bloodstone' && isCombatActiveAt(S, time)) {
        ctx.checkBloodstoneBlast(time);
    }

    if (fieldType !== 'Water' || S.activeRelic !== 'Steamshrieker') return;

    const steamshrieker = ctx.getRelicProc('Steamshrieker');
    if (!steamshrieker?.conditions) return;

    for (const [cond, value] of Object.entries(steamshrieker.conditions)) {
        ctx.applyCondition(cond, value.stacks, value.dur, time, 'Relic of Steamshrieker');
    }

    ctx.log({ t: time, type: 'relic_proc', relic: 'Steamshrieker', skill: 'Relic of Steamshrieker' });
    ctx.addStep({
        skill: 'Relic of Steamshrieker',
        start: time,
        end: time,
        att: S.att,
        type: 'relic_proc',
        ri: -1,
        icon: steamshrieker.icon,
    });
}

function resolveProjectileCombo(ctx, fieldType, finVal, time, skill) {
    const { S } = ctx;
    S.comboAccum.Projectile = (S.comboAccum.Projectile || 0) + finVal;
    if (S.comboAccum.Projectile < 1) return;

    S.comboAccum.Projectile -= 1;
    applyComboEffect(ctx, fieldType, 'Projectile', time, skill);
}

function resolveWhirlCombo(ctx, fieldType, finVal, time, skill) {
    for (let i = 0; i < finVal; i++) {
        applyComboEffect(ctx, fieldType, 'Whirl', time, skill);
    }
}

function resolveDirectCombo(ctx, fieldType, finType, time, skill) {
    applyComboEffect(ctx, fieldType, finType, time, skill);
    triggerComboRelics(ctx, fieldType, finType, time);
}

export function checkCombo(ctx, ev) {
    const { S } = ctx;
    if (!ev.finType) return;

    const activeField = findActiveComboField(S, ev.time);
    if (!activeField) return;

    triggerComboTraits(ctx, ev.time);

    const { type: fieldType } = activeField;
    if (ev.finType === 'Blast' || ev.finType === 'Leap') {
        resolveDirectCombo(ctx, fieldType, ev.finType, ev.time, ev.skill);
    } else if (ev.finType === 'Projectile') {
        resolveProjectileCombo(ctx, fieldType, ev.finVal, ev.time, ev.skill);
    } else if (ev.finType === 'Whirl') {
        resolveWhirlCombo(ctx, fieldType, ev.finVal, ev.time, ev.skill);
    }
}
