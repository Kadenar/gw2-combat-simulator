import { enqueueRelicActivateEvent } from '../shared/sim-events.js';
import { getRelicState } from '../state/sim-relic-state.js';
import { getActiveTimedStacks, peekTimedStacks, pushTimedStack } from '../state/sim-runtime-state.js';
import { isRelicIcdReady, armRelicIcd } from '../state/sim-icd-state.js';
import { effectStacksAt } from '../shared/sim-state-queries.js';
import { isCombatActiveAt } from '../run/sim-run-phase-state.js';
import { applyAura } from './sim-field-aura-combo.js';
import { pushReportingLog, pushReportingStep } from '../state/sim-reporting-state.js';

function logRelicProc(S, relic, time, icon, skill = `Relic of ${relic}`) {
    pushReportingLog(S, { t: time, type: 'relic_proc', relic, skill });
    pushReportingStep(S, { skill, start: time, end: time, att: S.att, type: 'relic_proc', ri: -1, icon });
}

function logRelicProcCtx(ctx, relic, time, icon, skill = `Relic of ${relic}`) {
    const { S } = ctx;
    ctx.log({ t: time, type: 'relic_proc', relic, skill });
    ctx.addStep({ skill, start: time, end: time, att: S.att, type: 'relic_proc', ri: -1, icon });
}

function activateTimedRelicBuff(S, proc, time) {
    const relicState = getRelicState(S);
    const wasActive = relicState.buffUntil > time;
    relicState.buffUntil = Math.max(relicState.buffUntil, time + proc.effectDuration);
    return !wasActive;
}

export function getRelicStrikeMultiplier(engine, S, ev, tgtHP) {
    const relicState = getRelicState(S);
    const proc = S.relicProc;
    if (!proc) return 1;

    if (proc.trigger === 'blast_combo') {
        return relicState.bloodstoneExplosionUntil > ev.time ? (1 + proc.strikeDmgM) : 1;
    }
    if (proc.trigger === 'eagle_below50') {
        const dealt = S.totalStrike + S.totalCond;
        return (tgtHP < Infinity && dealt >= tgtHP * 0.5) ? (1 + proc.strikeDmgM) : 1;
    }
    if (proc.trigger === 'weapon_recharge_hit') {
        return (relicState.thiefStacks > 0 && relicState.thiefUntil > ev.time)
            ? (1 + relicState.thiefStacks * proc.stackDmgPer) : 1;
    }
    if (proc.trigger === 'heal_skill') {
        return effectStacksAt(S, 'Fire Aura', ev.time) > 0 ? (1 + proc.strikeDmgM) : 1;
    }
    return (proc.strikeDmgM > 0 && relicState.buffUntil > ev.time) ? (1 + proc.strikeDmgM) : 1;
}

export function checkRelicOnHit(ctx, ev) {
    const { S } = ctx;
    const conjureWeapons = ctx.conjureWeapons || new Set();
    const relicState = getRelicState(S);
    const relic = S.activeRelic;
    const proc = S.relicProc;
    if (!relic || !proc) return;

    switch (proc.trigger) {
        case 'cc_5torment_confusion':
            if (ev.cc && isRelicIcdReady(S, relic, ev.time)) {
                const confusion = effectStacksAt(S, 'Confusion', ev.time);
                const torment = effectStacksAt(S, 'Torment', ev.time);
                if (confusion >= 5 || torment >= 5) {
                    armRelicIcd(S, relic, ev.time, proc.icd);
                    for (const [cond, value] of Object.entries(proc.conditions)) {
                        ctx.applyCondition(cond, value.stacks, value.dur, ev.time, `Relic of ${relic}`);
                    }
                    logRelicProcCtx(ctx, relic, ev.time, proc.icon);
                }
            }
            break;

        case 'cc_any':
            if (ev.cc) {
                if (proc.icd > 0 && !isRelicIcdReady(S, relic, ev.time)) break;
                if (proc.icd > 0) armRelicIcd(S, relic, ev.time, proc.icd);
                if (proc.effectDuration > 0 && activateTimedRelicBuff(S, proc, ev.time)) {
                    logRelicProcCtx(ctx, relic, ev.time, proc.icon);
                }
            }
            break;

        case 'weapon_recharge20':
            if (ev.dmg > 0 && ev.ws > 0) {
                const sk = ctx.skill(ev.skill);
                if (sk) {
                    const isWeapon = sk.type === 'Weapon skill' && !conjureWeapons.has(sk.weapon);
                    const isOverload = sk.name.startsWith('Overload');
                    if ((isWeapon || isOverload) && sk.recharge >= 20 && activateTimedRelicBuff(S, proc, ev.time)) {
                        logRelicProcCtx(ctx, relic, ev.time, proc.icon);
                    }
                }
            }
            break;

        case 'apply_weakness_vuln':
            if (ev.conds) {
                const hasWV = Object.keys(ev.conds).some(key =>
                    (key === 'Weakness' || key === 'Vulnerability') && ev.conds[key]?.stacks > 0 && ev.conds[key]?.duration > 0
                );
                if (hasWV) {
                    const trigKey = `${ev.skill}_${ev.time}`;
                    if (trigKey !== relicState.aristocracyLastTrigger) {
                        relicState.aristocracyLastTrigger = trigKey;
                        if (relicState.aristocracyUntil <= ev.time) relicState.aristocracyStacks = 0;
                        const wasZero = relicState.aristocracyStacks === 0;
                        relicState.aristocracyStacks = Math.min(relicState.aristocracyStacks + 1, proc.maxStacks);
                        relicState.aristocracyUntil = ev.time + proc.effectDuration;
                        if (wasZero) logRelicProcCtx(ctx, relic, ev.time, proc.icon);
                    }
                }
            }
            break;

        case 'gain_protection_resolution':
            if (ev.conds && isRelicIcdReady(S, relic, ev.time)) {
                const hasPR = Object.keys(ev.conds).some(key =>
                    (key === 'Protection' || key === 'Resolution') && ev.conds[key]?.stacks > 0 && ev.conds[key]?.duration > 0
                );
                if (hasPR) {
                    armRelicIcd(S, relic, ev.time, proc.icd);
                    relicState.buffUntil = Math.max(relicState.buffUntil, ev.time + proc.effectDuration);
                    logRelicProcCtx(ctx, relic, ev.time, proc.icon);
                }
            }
            break;

        case 'trap_skill':
            if (ev.dmg > 0 || (ev.conds && Object.keys(ev.conds).length > 0)) {
                const sk = ctx.skill(ev.skill);
                if (sk && sk.type === 'Trap' && activateTimedRelicBuff(S, proc, ev.time)) {
                    logRelicProcCtx(ctx, relic, ev.time, proc.icon);
                }
            }
            break;

        case 'weapon_recharge_hit':
            if (ev.dmg > 0 && ev.ws > 0) {
                const sk = ctx.skill(ev.skill);
                if (sk && sk.type === 'Weapon skill' && sk.recharge > 0) {
                    if (relicState.thiefUntil <= ev.time) relicState.thiefStacks = 0;
                    const wasZero = relicState.thiefStacks === 0;
                    relicState.thiefStacks = Math.min(relicState.thiefStacks + 1, proc.maxStacks);
                    relicState.thiefUntil = ev.time + proc.effectDuration;
                    if (wasZero) logRelicProcCtx(ctx, relic, ev.time, proc.icon);
                }
            }
            break;
    }
}

export function checkRelicOnCast(engine, S, sk, start, end, {
    queueRelicActivate = null,
} = {}) {
    if (!isCombatActiveAt(S, end)) return;
    const relic = S.activeRelic;
    const proc = S.relicProc;
    if (!relic || !proc) return;

    const queueActivate = event => {
        if (queueRelicActivate) return queueRelicActivate(event);
        return enqueueRelicActivateEvent(S.eq, event);
    };

    if (proc.trigger === 'polaric_leap' && sk.name === 'Polaric Leap') {
        if (isRelicIcdReady(S, relic, end)) {
            armRelicIcd(S, relic, end, proc.icd);
            queueActivate({ time: end, relic, applyEffects: true });
        }
    }

    if (proc.trigger === 'elite_delayed' && sk.type === 'Elite skill') {
        if (isRelicIcdReady(S, relic, end)) {
            armRelicIcd(S, relic, end, proc.icd);
            queueActivate({ time: end + (proc.delay || 0), relic, applyEffects: true });
        }
    }

    if (proc.trigger === 'stance_skill' && sk.type === 'Stance') {
        queueActivate({ time: end, relic, applyEffects: true });
    }

    if (proc.trigger === 'heal_skill' && sk.type === 'Healing skill') {
        if (isRelicIcdReady(S, relic, end)) {
            armRelicIcd(S, relic, end, proc.icd);
            applyAura(engine, S, 'Fire Aura', proc.effectDuration, end, `Relic of ${relic}`);
            logRelicProc(S, relic, end, proc.icon);
        }
    }
}

export function trackBlightbringerPoison(S, time, skillName, castStart, {
    damagingConditions,
    applyCondition,
    trackEffect,
}) {
    const relicState = getRelicState(S);
    const key = castStart != null ? `${skillName}_${castStart}` : `${skillName}_${time}`;
    if (relicState.blightbringerTrackedCasts.has(key)) return;
    relicState.blightbringerTrackedCasts.add(key);

    if (relicState.blightbringerCount < 6) relicState.blightbringerCount++;
    if (relicState.blightbringerCount >= 6 && isRelicIcdReady(S, 'Blightbringer', time)) {
        relicState.blightbringerCount = 0;
        armRelicIcd(S, 'Blightbringer', time, S.relicProc.icd);
        const proc = S.relicProc;
        for (const [cond, value] of Object.entries(proc.conditions)) {
            if (damagingConditions.has(cond)) {
                applyCondition(cond, value.stacks, value.dur, time, 'Relic of Blightbringer');
            } else {
                trackEffect(cond, value.stacks, value.dur, time);
            }
        }
        logRelicProc(S, 'Blightbringer', time, proc.icon);
    }
}

export function checkBloodstoneBlast(ctx, time) {
    const { S } = ctx;
    const relicState = getRelicState(S);
    const proc = ctx.getRelicProc('Bloodstone');
    if (!proc) return;
    if (relicState.bloodstoneExplosionUntil > time) return;

    if (relicState.bloodstoneStacksUntil <= time) relicState.bloodstoneStacks = 0;

    relicState.bloodstoneStacks++;
    relicState.bloodstoneStacksUntil = time + proc.volatilityDuration;
    const volatilityStacks = relicState.bloodstoneStacks;

    const volatility = peekTimedStacks(S, 'Bloodstone Volatility');
    if (volatility) {
        for (const stack of volatility) {
            if (stack.t <= time && stack.expiresAt > time) stack.expiresAt = time + proc.volatilityDuration;
        }
    }
    pushTimedStack(S, { t: time, cond: 'Bloodstone Volatility', expiresAt: time + proc.volatilityDuration });
    ctx.log({
        t: time,
        type: 'skill_proc',
        skill: 'Bloodstone Volatility',
        detail: `${volatilityStacks}/${proc.stacksNeeded}`,
    });

    if (volatilityStacks >= proc.stacksNeeded) {
        relicState.bloodstoneStacks = 0;
        relicState.bloodstoneExplosionUntil = time + proc.effectDuration;

        const refreshedVolatility = getActiveTimedStacks(S, 'Bloodstone Volatility', time);
        if (refreshedVolatility) {
            for (const stack of refreshedVolatility) {
                stack.expiresAt = time;
            }
        }
        pushTimedStack(S, { t: time, cond: 'Bloodstone Fervor', expiresAt: time + proc.effectDuration });

        const explosionTime = time + (proc.explosionDelay || 0);

        const hitEvent = {
            time: explosionTime,
            skill: 'Bloodstone Explosion', hitIdx: 1, sub: 1, totalSubs: 1,
            dmg: proc.strikeCoeff, ws: proc.strikeWs,
            isField: false, cc: false, conds: proc.conditions,
            isRelicProc: true, noCrit: false, att: S.att,
        };
        ctx.queueHitEvent(hitEvent);
        logRelicProcCtx(ctx, 'Bloodstone', time, proc.icon, 'Bloodstone Fervor');
    }
}
