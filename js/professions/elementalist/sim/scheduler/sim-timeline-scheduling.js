import { getSchedulerIntentState } from './sim-scheduler-intent-state.js';
import { buildPrimordialStanceAction } from '../shared/sim-deferred-runtime-actions.js';
import {
    estimateFreshAirLookaheadCritChance,
    processFreshAirCandidate,
} from '../mechanics/sim-fresh-air-state.js';
import { SMALL_HITBOX_CAPS, LARGE_HITBOX_DURATION_BONUS } from '../../simulation.js';

export function applyPrimordialStance(ctx, att1, att2, time) {
    const stanceEffects = {
        Fire: () => ctx.applyCondition('Burning', 1, 2, time, 'Primordial Stance'),
        Water: () => ctx.trackEffect('Chilled', 1, 1, time),
        Air: () => ctx.trackEffect('Vulnerability', 8, 3, time),
        Earth: () => ctx.applyCondition('Bleeding', 2, 6, time, 'Primordial Stance'),
    };

    // Apply for primary and, for Weaver, secondary attunement independently.
    const attunements = att2 !== null ? [att1, att2] : [att1];
    for (const att of attunements) {
        stanceEffects[att]?.();
    }
}

export function findFreshAirResetTimeInRange(ctx, fromTime, upTo) {
    const { S } = ctx;
    if (!S._hasFreshAir) return null;
    const intentState = getSchedulerIntentState(S);
    for (const intent of intentState.freshAirHitIntents) {
        if (intent.time < fromTime) continue;
        if (intent.time > upTo) break;
        const ccPct = estimateFreshAirLookaheadCritChance(ctx, intent.time);
        if (processFreshAirCandidate(ctx, intent.time, ccPct, {
            detail: 'Air attunement recharged (pre-swap)',
        })) {
            return intent.time;
        }
    }

    return null;
}

export function scheduleSkillHits(ctx, sk, castStart, scaleOff = off => off, interruptAt = null, extraEventProps = null) {
    const { engine, S } = ctx;
    const hammerOrbSkills = ctx.hammerOrbSkills || {};
    const hammerDualOrbSkills = ctx.hammerDualOrbSkills || {};
    const fireFieldSkills = ctx.fireFieldSkills || new Set();
    // Skills CSV may keep display quotes while hit data may not.
    const strippedName = sk.name.replace(/^"|"$/g, '');
    const rows = ctx.skillHits[sk.name] || ctx.skillHits[strippedName] || [];
    const ws = ctx.weaponStrength(sk);
    const hitboxCap = ctx.hitboxSize === 'small' ? (SMALL_HITBOX_CAPS.get(sk.name) ?? Infinity) : Infinity;

    const hammerOrbElement = hammerOrbSkills[sk.name] || (hammerDualOrbSkills[sk.name] ? 'Dual' : null);

    const isSpearWeapon = sk.weapon === 'Spear' && sk.type === 'Weapon skill' && sk.slot !== '1';
    const spearDmgBonus = isSpearWeapon && S.spearNextDmgBonus;
    const spearForceCrit = isSpearWeapon && S.spearNextGuaranteedCrit;
    const spearCCHit = isSpearWeapon && S.spearNextCCHit;
    if (isSpearWeapon) {
        if (spearDmgBonus) S.spearNextDmgBonus = false;
        if (spearForceCrit) S.spearNextGuaranteedCrit = false;
        if (spearCCHit) S.spearNextCCHit = false;
    }

    let firstHitScheduled = false;
    for (const h of rows) {
        if (h.hit > hitboxCap) continue;

        const off = scaleOff(h.startOffsetMs || 0);
        const rep = h.repeatOffsetMs || 0;
        let count = 1;
        let durBased = false;
        const raw = h.numberOfImpacts;

        if (raw === 'Duration') {
            durBased = true;
            let effectiveDur = h.duration || 1;
            if (ctx.hitboxSize === 'large') {
                effectiveDur += LARGE_HITBOX_DURATION_BONUS.get(sk.name) || 0;
            }
            if (S._hasPersistingFlames && fireFieldSkills.has(sk.name) && h.isFieldTick) {
                effectiveDur += 2;
            }
            count = Math.floor(effectiveDur / (h.interval || 1)) || 1;
        } else {
            const n = parseInt(raw) || 1;
            if (n > 1) count = n;
        }

        const perHit = durBased ? h.damage : (count > 1 ? h.damage / count : h.damage);
        const effectiveRep = rep > 0 ? rep : (durBased && count > 1 ? (h.interval || 1) * 1000 : 0);

        const orbPreScheduled = hammerOrbElement && effectiveRep > 0 && count === 1
            && (ctx.hammerOrbDurationMs || 0) > 0;
        if (orbPreScheduled) {
            count = Math.ceil(ctx.hammerOrbDurationMs / effectiveRep);
        }

        for (let i = 0; i < count; i++) {
            const t = castStart + off + (effectiveRep > 0 && count > 1 ? i * effectiveRep : 0);
            if (interruptAt !== null && t > interruptAt) {
                if (effectiveRep > 0 && count > 1) break;
                continue;
            }
            const isFirstHit = !firstHitScheduled;
            firstHitScheduled = true;

            const event = {
                time: t,
                skill: sk.name,
                hitIdx: h.hit,
                sub: i + 1,
                totalSubs: count,
                dmg: perHit,
                ws,
                ...(h.flatDamage > 0 ? {
                    flatStrikeBase: h.flatDamage * (ctx.glyphBoonedElementals && sk.name === 'Glyph of Elementals' ? 1.7 : 1),
                    flatStrikePowerCoeff: 0,
                } : {}),
                isField: h.isFieldTick,
                cc: h.cc,
                conds: h.conditions,
                finType: h.finisherType,
                finVal: h.finisherValue,
                att: S.att,
                att2: S.att2,
                castStart,
                conjure: S.conjureEquipped || null,
                spearDmgBonus: spearDmgBonus || undefined,
                spearForceCrit: spearForceCrit || undefined,
                spearCCHit: (spearCCHit && isFirstHit) || undefined,
                hammerOrbElement: hammerOrbElement || undefined,
                hammerOrbRepeatMs: (hammerOrbElement && !orbPreScheduled)
                    ? (effectiveRep > 0 ? effectiveRep : ((h.interval || 0) > 0 ? h.interval * 1000 : 0))
                    : undefined,
                frigidFlurryProc: S._frigidFlurryProcActive || undefined,
                onResolveActions: sk.name.startsWith('Primordial Stance')
                    ? [buildPrimordialStanceAction({ time: t })]
                    : undefined,
            };
            if (extraEventProps) Object.assign(event, extraEventProps);
            ctx.queueHitEvent(event);
        }
    }
}
