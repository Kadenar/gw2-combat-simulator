import { pushTimedStack, peekTimedStacks, findActiveTimedStack } from '../state/sim-runtime-state.js';
import { isSetupPhase } from '../run/sim-run-phase-state.js';
import { pushReportingLog } from '../state/sim-reporting-state.js';

export function createAuraEffectsContext({
    S,
    log = entry => pushReportingLog(S, entry),
    pushCondStack = entry => pushTimedStack(S, entry),
    trackEffect,
    refreshEffect,
}) {
    return {
        S,
        log,
        pushCondStack,
        trackEffect,
        refreshEffect,
    };
}

export function grantEmpoweringAuras(ctx, time) {
    const { S } = ctx;
    if (isSetupPhase(S)) return;

    const durationMs = 10000;
    const auraStacks = peekTimedStacks(S, 'Empowering Auras');
    const active = auraStacks ? auraStacks.filter(stack => stack.t <= time && stack.expiresAt > time && !stack.perma) : [];

    for (const stack of active) stack.expiresAt = time + durationMs;

    if (active.length < 5) {
        ctx.pushCondStack({ t: time, cond: 'Empowering Auras', expiresAt: time + durationMs });
        ctx.log({
            t: time,
            type: 'apply',
            effect: 'Empowering Auras',
            stacks: 1,
            dur: durationMs / 1000,
            skill: 'Empowering Auras',
        });
        return;
    }

    ctx.log({
        t: time,
        type: 'refresh',
        effect: 'Empowering Auras',
        stacks: active.length,
        dur: durationMs / 1000,
        skill: 'Empowering Auras',
    });
}

export function applyOnAuraGainEffects(ctx, time) {
    const { S } = ctx;
    if (S._hasZephyrsBoon) {
        ctx.trackEffect('Fury', 1, 5, time);
        ctx.trackEffect('Swiftness', 1, 5, time);
    }

    if (S._hasElementalShielding) {
        ctx.trackEffect('Protection', 1, 3, time);
    }

    if (S._hasInvigoratingTorrents) {
        ctx.trackEffect('Vigor', 1, 5, time);
        ctx.trackEffect('Regeneration', 1, 5, time);
    }

    if (S._hasTempestuousAria) {
        const existing = findActiveTimedStack(S, 'Tempestuous Aria', time, { includePerma: false });
        if (existing) {
            existing.expiresAt = Math.min(existing.expiresAt + 5000, time + 10000);
        } else {
            ctx.trackEffect('Tempestuous Aria', 1, 5, time);
        }
    }

    if (S._hasElementalBastion) {
        ctx.trackEffect('Alacrity', 1, 4, time);
    }
}
