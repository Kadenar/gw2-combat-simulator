import { getProcState } from '../state/sim-proc-state.js';
import {
    capAttunementCooldownReadyAt,
    capSkillCooldownReadyAt,
} from '../state/sim-cooldown-state.js';

export function isFreshAirEligibleHitEvent(hitEvent) {
    if (!hitEvent) return false;
    if (hitEvent.isSigilProc || hitEvent.isRelicProc || hitEvent.isTraitProc) return false;
    if (hitEvent.noCrit) return false;
    if (hitEvent.dmg <= 0 || !hitEvent.ws) return false;
    return true;
}

export function buildFreshAirHitCandidate(hitEvent) {
    if (!isFreshAirEligibleHitEvent(hitEvent)) return null;

    const candidate = {
        type: 'fresh_air_hit_intent',
        time: hitEvent.time,
    };
    if (hitEvent._queueSeq !== undefined) candidate._queueSeq = hitEvent._queueSeq;
    return candidate;
}

export function applyFreshAirCritChance(S, critChancePct) {
    if (critChancePct <= 0) return false;
    const procState = getProcState(S);
    procState.freshAirAccum += critChancePct / 100;
    if (procState.freshAirAccum < 1) return false;
    procState.freshAirAccum -= 1;
    return true;
}

export function applyFreshAirReset(S, time, { log = null, detail = 'Air attunement recharged' } = {}) {
    const procState = getProcState(S);
    capAttunementCooldownReadyAt(S, 'Air', time);
    capSkillCooldownReadyAt(S, 'Overload Air', time);
    procState.freshAirResetAt = time;
    if (log) {
        log({
            t: time,
            type: 'trait_proc',
            trait: 'Fresh Air',
            skill: 'Fresh Air (CD reset)',
            detail,
        });
    }
    return time;
}

export function processFreshAirCandidate(ctx, candidateTime, critChancePct, {
    detail = 'Air attunement recharged',
} = {}) {
    const { S } = ctx;
    if (!S._hasFreshAir) return false;

    const hitAtt = ctx.attAt(candidateTime);
    if (hitAtt === 'Air') return false;
    if (!applyFreshAirCritChance(S, critChancePct)) return false;

    applyFreshAirReset(S, candidateTime, {
        log: entry => ctx.log(entry),
        detail,
    });
    return true;
}

export function estimateFreshAirLookaheadCritChance(ctx, time) {
    const { engine, S } = ctx;
    const attributes = engine.attributes.attributes;
    const baseCritCh = attributes['Critical Chance']?.final ?? 0;
    const furyBonus = ctx.effectStacksAt('Fury', time) > 0 ? S._furyCritBonus : 0;
    return Math.min(baseCritCh + furyBonus, 100);
}
