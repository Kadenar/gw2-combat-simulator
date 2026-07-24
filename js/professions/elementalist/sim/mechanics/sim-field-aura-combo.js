import { isSetupPhase } from '../run/sim-run-phase-state.js';
import { buildAuraFollowupAction, queueAuraFollowupAction } from '../shared/sim-deferred-runtime-actions.js';
import { grantElementalEmpowerment, trackEffect, refreshEffect } from './sim-effect-state.js';
import { applyOnAuraGainEffects, createAuraEffectsContext, grantEmpoweringAuras } from './sim-aura-effects.js';
import { pushTimedStack } from '../state/sim-runtime-state.js';
import { pushCombatField, pushCombatAura } from '../state/sim-combat-record-state.js';
import { pushReportingLog } from '../state/sim-reporting-state.js';

export function trackField(engine, S, sk, castEnd, {
    fireFieldSkills,
    log = entry => pushReportingLog(S, entry),
}) {
    if (!sk.comboField || sk.duration <= 0) return;
    let dur = sk.duration * 1000;
    if (S._hasPersistingFlames && fireFieldSkills.has(sk.name)) dur += 2000;
    pushCombatField(S, { type: sk.comboField, start: castEnd, end: castEnd + dur, skill: sk.name });
    log({ t: castEnd, type: 'field', field: sk.comboField, skill: sk.name, dur });
}

export function applyAura(engine, S, auraName, durMs, time, skill, opts = {}) {
    if (S._hasSmothering) durMs = Math.round(durMs * 1.33);
    const log = typeof opts.log === 'function' ? opts.log : entry => pushReportingLog(S, entry);
    const pushCondStack = typeof opts.pushCondStack === 'function' ? opts.pushCondStack : entry => pushTimedStack(S, entry);

    pushCombatAura(S, { type: auraName, end: time + durMs, skill });
    pushCondStack({ t: time, cond: auraName, expiresAt: time + durMs });
    log({ t: time, type: 'aura', aura: auraName, skill, dur: durMs });

    const followupMode = opts.followupMode || (isSetupPhase(S) ? 'queued' : 'immediate');
    const auraCtx = createAuraEffectsContext({
        S,
        log,
        pushCondStack,
        trackEffect: (effect, stacks, durationSec, at) => {
            if (typeof opts.trackEffect === 'function') {
                return opts.trackEffect(effect, stacks, durationSec, at);
            }
            if (opts.boons && opts.relicProcs) {
                return trackEffect(engine, S, effect, stacks, durationSec, at, {
                    boons: opts.boons,
                    relicProcs: opts.relicProcs,
                    log,
                    pushCondStack,
                });
            }
            return engine._trackEffect(S, effect, stacks, durationSec, at);
        },
        refreshEffect: (effectName, durationSec, at) => {
            if (typeof opts.refreshEffect === 'function') {
                return opts.refreshEffect(effectName, durationSec, at);
            }
            if (opts.boons && opts.relicProcs) {
                return refreshEffect({
                    S,
                    trackEffect: (effect, stacks, duration, timePoint) => trackEffect(engine, S, effect, stacks, duration, timePoint, {
                        boons: opts.boons,
                        relicProcs: opts.relicProcs,
                        log,
                        pushCondStack,
                    }),
                }, effectName, durationSec, at);
            }
            return engine._refreshEffect(S, effectName, durationSec, at);
        },
    });
    const effectCtx = {
        S,
        pushCondStack,
        log,
    };

    if (followupMode === 'immediate') {
        if (S._hasEmpoweringAuras) grantEmpoweringAuras(auraCtx, time);
        if (S._hasElemEpitome) grantElementalEmpowerment(effectCtx, 1, time, skill);
        applyOnAuraGainEffects(auraCtx, time);
    }

    if (followupMode === 'queued') {
        const runtimeActionTarget = opts.runtimeActionTarget || S;
        queueAuraFollowupAction(runtimeActionTarget, buildAuraFollowupAction({ time, skill }));
    }
}

export function trackAura(engine, S, sk, castEnd, opts = {}) {
    if (!sk.aura) return;
    const parts = sk.aura.split('|');
    const aType = parts[0];
    const aDur = (parseFloat(parts[1]) || 0) * 1000;
    if (aDur > 0) applyAura(engine, S, `${aType} Aura`, aDur, castEnd, sk.name, opts);
}
