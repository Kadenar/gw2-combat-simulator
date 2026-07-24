import { getProcState } from '../state/sim-proc-state.js';
import { getActiveTimedStacks, pushTimedStack } from '../state/sim-runtime-state.js';
import { isSetupPhase, isCombatActiveAt } from '../run/sim-run-phase-state.js';
import { isTraitIcdReady, armTraitIcd } from '../state/sim-icd-state.js';
import { getEvokerState } from '../state/sim-specialization-state.js';
import { buildAuraFollowupAction } from '../shared/sim-deferred-runtime-actions.js';
import { processFreshAirCandidate } from './sim-fresh-air-state.js';

function enqueueTraitHit(ctx, event) {
    return ctx.queueHitEvent(event);
}

function shouldBlockPrecombatProc(S, time) {
    return !isCombatActiveAt(S, time);
}

function grantEvasiveArcanaEvokerCharges(ctx, attunement, time, skillName) {
    const { S } = ctx;
    if (S.eliteSpec !== 'Evoker' || attunement === 'Air') return;

    const evokerState = getEvokerState(S);
    if (!evokerState.element) return;

    const bonus = evokerState.element === attunement ? 2 : 1;
    const maxCharges = S._hasSpecializedElements ? 4 : 6;
    const prevCharges = evokerState.charges;
    const nextCharges = ctx.grantEvokerCharges(bonus, maxCharges);
    if (nextCharges !== prevCharges) {
        ctx.log({
            t: time,
            type: 'evoker_charges',
            skill: skillName,
            source: 'trait',
            amount: nextCharges - prevCharges,
            prevCharges,
            charges: nextCharges,
            maxCharges,
        });
    }
}

export function triggerSunspot(ctx, time) {
    const { S } = ctx;
    if (!S._hasSunspot) return;
    if (shouldBlockPrecombatProc(S, time)) return;
    if (S.eliteSpec === 'Evoker' && !isTraitIcdReady(S, 'Sunspot', time)) return;
    if (S.eliteSpec === 'Evoker') armTraitIcd(S, 'Sunspot', time, 5000);

    ctx.applyAura('Fire Aura', 3000, time, 'Sunspot', { followupMode: 'skip' });

    enqueueTraitHit(ctx, {
        time,
        skill: 'Sunspot', hitIdx: 1, sub: 1, totalSubs: 1,
        dmg: 0.6, ws: 690.5,
        isField: false, cc: false, conds: null,
        noCrit: true, att: S.att, att2: S.att2 || null, isTraitProc: true,
        postHitActions: [buildAuraFollowupAction({ time, skill: 'Sunspot' })],
    });

    if (S._hasBurningRage) {
        ctx.applyCondition('Burning', 2, 4, time, 'Sunspot');
    }

    ctx.log({ t: time, type: 'trait_proc', trait: 'Sunspot', skill: 'Sunspot' });
    ctx.addStep({
        skill: 'Sunspot', start: time, end: time, att: S.att, type: 'trait_proc', ri: -1,
        icon: 'https://render.guildwars2.com/file/1405047ED70DE30F80B1F6304A787B215BB50878/1012316.png',
    });
}

export function triggerFlameExpulsion(ctx, time) {
    const { S } = ctx;
    if (!S._hasPyroPuissance) return;
    if (shouldBlockPrecombatProc(S, time)) return;
    if (S.eliteSpec === 'Evoker' && !isTraitIcdReady(S, 'FlameExpulsion', time)) return;
    if (S.eliteSpec === 'Evoker') armTraitIcd(S, 'FlameExpulsion', time, 5000);

    const might = ctx.mightStacksAt(time);
    const capped = Math.min(might, 10);
    const coeff = 1.0 + 0.1 * capped;
    const burnDur = Math.min(2 + 0.5 * capped, 7);

    enqueueTraitHit(ctx, {
        time,
        skill: 'Flame Expulsion', hitIdx: 1, sub: 1, totalSubs: 1,
        dmg: coeff, ws: 690.5,
        isField: false, cc: false, conds: null,
        noCrit: false, att: S.att, att2: S.att2 || null, isTraitProc: true,
    });

    ctx.applyCondition('Burning', 1, burnDur, time, 'Flame Expulsion');

    ctx.log({ t: time, type: 'trait_proc', trait: 'Flame Expulsion', skill: 'Flame Expulsion' });
    ctx.addStep({
        skill: 'Flame Expulsion', start: time, end: time, att: S.att, type: 'trait_proc', ri: -1,
        icon: 'https://render.guildwars2.com/file/998095CB1FD2CF0164B8A36BABFDB911DF08DB02/1012313.png',
    });
}

export function triggerEarthenBlast(ctx, time) {
    const { S } = ctx;
    if (!S._hasEarthenBlast) return;
    if (shouldBlockPrecombatProc(S, time)) return;
    if (S.eliteSpec === 'Evoker' && !isTraitIcdReady(S, 'EarthenBlast', time)) return;
    if (S.eliteSpec === 'Evoker') armTraitIcd(S, 'EarthenBlast', time, 5000);

    enqueueTraitHit(ctx, {
        time,
        skill: 'Earthen Blast', hitIdx: 1, sub: 1, totalSubs: 1,
        dmg: 0.36, ws: 690.5,
        isField: false, cc: false, conds: null,
        noCrit: true, att: S.att, att2: S.att2 || null, isTraitProc: true,
    });

    ctx.log({ t: time, type: 'trait_proc', trait: 'Earthen Blast', skill: 'Earthen Blast' });
    ctx.addStep({
        skill: 'Earthen Blast', start: time, end: time, att: S.att, type: 'trait_proc', ri: -1,
        icon: 'https://render.guildwars2.com/file/2531DCAFAEAB452C90C4572E1ADCE8236DCF5636/1012304.png',
    });
}

export function grantRockSolid(ctx, time) {
    const { S } = ctx;
    if (S.eliteSpec === 'Evoker' && !isTraitIcdReady(S, 'RockSolid', time)) return;
    if (S.eliteSpec === 'Evoker') armTraitIcd(S, 'RockSolid', time, 5000);
    ctx.trackEffect('Stability', 1, 3, time);
}

export function triggerElectricDischarge(ctx, time) {
    const { S } = ctx;
    if (!S._hasElectricDischarge) return;
    if (shouldBlockPrecombatProc(S, time)) return;

    enqueueTraitHit(ctx, {
        time,
        skill: 'Electric Discharge', hitIdx: 1, sub: 1, totalSubs: 1,
        dmg: 0.35, ws: 690.5,
        isField: false, cc: false,
        conds: { Vulnerability: { stacks: 1, duration: 8 } },
        noCrit: false, att: S.att, att2: S.att2 || null, isTraitProc: true,
        doubleOnCrit: true,
    });

    ctx.log({ t: time, type: 'trait_proc', trait: 'Electric Discharge', skill: 'Electric Discharge' });
    ctx.addStep({
        skill: 'Electric Discharge', start: time, end: time, att: S.att, type: 'trait_proc', ri: -1,
        icon: 'https://render.guildwars2.com/file/F4622EE8300028599369D4084EA7A2774D250DEA/1012280.png',
    });
}

export function applyFreshAirBuff(ctx, time) {
    if (ctx.S._suppressFreshAirContributionBuff) return;
    ctx.refreshEffect('Fresh Air', 5, time);
    ctx.log({
        t: time,
        type: 'trait_proc',
        trait: 'Fresh Air',
        skill: 'Fresh Air',
        icon: 'https://render.guildwars2.com/file/FA64C9F2750F986E52E8376F22EDBA3844A8C603/1012277.png',
    });
}

export function checkFreshAir(ctx, time, critChancePct) {
    processFreshAirCandidate(ctx, time, critChancePct);
}

export function triggerLightningRod(ctx, time) {
    const { S } = ctx;
    if (shouldBlockPrecombatProc(S, time)) return;
    enqueueTraitHit(ctx, {
        time,
        skill: 'Lightning Rod', hitIdx: 1, sub: 1, totalSubs: 1,
        dmg: 1.5, ws: 690.5,
        isField: false, cc: false,
        conds: { Weakness: { stacks: 1, duration: 4 } },
        noCrit: false, att: S.att, att2: S.att2 || null, isTraitProc: true,
    });

    ctx.log({ t: time, type: 'trait_proc', trait: 'Lightning Rod', skill: 'Lightning Rod' });
    ctx.addStep({
        skill: 'Lightning Rod', start: time, end: time, att: S.att, type: 'trait_proc', ri: -1,
        icon: 'https://render.guildwars2.com/file/0D26024404D06BBB0A3BD70340251740C73E0F2C/1012278.png',
    });
}

export function triggerEvasiveArcana(ctx, time) {
    const { S } = ctx;
    if (!S._hasEvasiveArcana) return;
    if (shouldBlockPrecombatProc(S, time)) return;

    const attunement = S.att;
    const skillNameByAttunement = {
        Fire: 'Flame Burst (trait)',
        Water: 'Cleansing Wave (trait)',
        Air: 'Blinding Flash (trait)',
        Earth: 'Shock Wave (trait)',
    };
    const skillName = skillNameByAttunement[attunement];
    if (!skillName) return;

    const skill = ctx.skill(skillName);
    if (!skill) return;

    const icdKey = `EvasiveArcana:${skillName}`;
    if (!ctx.traitIcdReady(icdKey, time)) return;

    const icdMs = Math.round((skill.recharge || 10) * 1000);
    ctx.armTraitIcd(icdKey, time, icdMs);
    ctx.scheduleHits(skill, time);
    ctx.trackField(skill, time);
    ctx.trackAura(skill, time);
    ctx.log({ t: time, type: 'trait_proc', trait: 'Evasive Arcana', skill: skillName });
    ctx.addStep({
        skill: skillName,
        start: time,
        end: time,
        att: attunement,
        type: 'trait_proc',
        ri: -1,
    });
}

export function checkRagingStorm(ctx, time, critChancePct) {
    const { S } = ctx;
    if (shouldBlockPrecombatProc(S, time)) return;
    const procState = getProcState(S);
    if (critChancePct <= 0) return;
    procState.traitRagingStormAccum += critChancePct / 100;
    if (procState.traitRagingStormAccum < 1) return;
    if (!isTraitIcdReady(S, 'RagingStorm', time)) return;
    procState.traitRagingStormAccum -= 1;
    armTraitIcd(S, 'RagingStorm', time, 8000);
    ctx.trackEffect('Fury', 1, 4, time);
    ctx.log({ t: time, type: 'trait_proc', trait: 'Raging Storm', skill: 'Raging Storm' });
}

export function grantPersistingFlames(ctx, time) {
    const { S } = ctx;
    if (isSetupPhase(S)) return;
    const active = getActiveTimedStacks(S, 'Persisting Flames', time);
    if (active.length >= 5) {
        const shortest = active.reduce((a, b) => (a.expiresAt < b.expiresAt ? a : b));
        shortest.expiresAt = time;
    }
    pushTimedStack(S, { t: time, cond: 'Persisting Flames', expiresAt: time + 15000 });
}
