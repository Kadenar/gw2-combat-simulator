import { sortQueuedEvents, takeNextEvent } from '../../../../platform/engine/event-queue.js';
import {
    isHitEvent,
    isConditionTickEvent,
    isDamageWindowEvent,
} from '../shared/sim-events.js';
import {
    handleRuntimeActionEvent,
    handleApplyEffectEvent,
    handleRelicActivateEvent,
    handleConditionTickEvent,
    handleHitEvent,
    isPlayerHitEvent,
    handlePostHitRuntimeActions,
    handleComboHitEffects,
} from './sim-event-handlers.js';
import { isPrecombatAt } from '../run/sim-run-phase-state.js';
import { getRelicState } from '../state/sim-relic-state.js';

export function shouldStopQueuedEvent(ev, deathTime, stopAtTime, rotEnd) {
    if (deathTime !== null && ev.time > deathTime) return true;
    if (stopAtTime !== null && ev.time > stopAtTime) return true;
    if (stopAtTime === null && ev.time > rotEnd) return true;
    return false;
}

export function trackDamageWindowEvent(S, ev) {
    if (isPrecombatAt(S, ev.time)) return;
    if (isDamageWindowEvent(ev)) {
        if (S.firstHitTime === null) S.firstHitTime = ev.time;
        S.lastHitTime = ev.time;
    }
}

function handlePrecombatQueuedEvent(ctx, ev) {
    if (!isHitEvent(ev)) return;

    handlePostHitRuntimeActions(ctx, ev);
    if (isPlayerHitEvent(ev)) {
        handleComboHitEffects(ctx, ev, { playerHit: true });
    }
}

export function buildQueuedEventContext(ctx, time) {
    const { S, baseCondDmg, skipMight, skipVuln } = ctx;
    const might = skipMight ? 0 : ctx.mightStacksAt(time);
    const empMul = ctx.getEmpMul(time);
    const thornsCondDmg = S.activeRelic === 'Thorns'
        ? (getRelicState(S).thornsStacks || 0) * (ctx.getRelicProc('Thorns')?.conditionDamagePerStack || 0)
        : 0;
    let polyCondDmg = 0;
    if (S._hasElemPolyphony) {
        const att = ctx.attAt(time);
        const att2 = ctx.att2At(time);
        const atts = att2 !== null ? new Set([att, att2]) : new Set([att]);
        if (atts.has('Earth')) polyCondDmg = 200;
    }
    const condDmg = baseCondDmg + might * S._mightCondDmgBonus
        + Math.round((S._empPool?.['Condition Damage'] || 0) * empMul)
        + thornsCondDmg + polyCondDmg;
    const vulnMul = skipVuln ? 1 : 1 + ctx.vulnStacksAt(time) * 0.01;
    return { might, empMul, condDmg, vulnMul, thornsCondDmg };
}

export function dispatchQueuedCombatEvent(ctx, ev, { tgtHP }) {
    const eventCtx = buildQueuedEventContext(ctx, ev.time);
    const { might, empMul, condDmg, vulnMul } = eventCtx;

    if (isHitEvent(ev)) {
        return handleHitEvent(ctx, ev, {
            tgtHP,
            might,
            empMul,
            condDmg,
            vulnMul,
        });
    }

    if (isConditionTickEvent(ev)) {
        handleConditionTickEvent(ctx, ev, {
            might,
            empMul,
            condDmg,
            vulnMul,
        });
    }

    return true;
}

export function updateDeathTime(S, ev, deathTime, tgtHP) {
    if (deathTime === null && (S.totalStrike + S.totalCond) >= tgtHP) {
        return ev.time;
    }
    return deathTime;
}

export function drainQueuedEvents(ctx, queue, {
    rotationEndTime,
    stopAtTime,
    targetHP,
}) {
    const { S } = ctx;
    const rotEnd = typeof rotationEndTime === 'number' ? rotationEndTime : S.t;
    const tgtHP = targetHP > 0 ? targetHP : Infinity;
    let deathTime = null;

    sortQueuedEvents(queue);
    while (queue.length > 0) {
        const ev = takeNextEvent(queue);
        if (shouldStopQueuedEvent(ev, deathTime, stopAtTime, rotEnd)) break;

        if (handleRuntimeActionEvent(ctx, ev)) continue;

        handleApplyEffectEvent(ctx, ev);

        if (isPrecombatAt(S, ev.time)) {
            handlePrecombatQueuedEvent(ctx, ev);
            continue;
        }

        trackDamageWindowEvent(S, ev);

        if (handleRelicActivateEvent(ctx, ev)) continue;

        const processed = dispatchQueuedCombatEvent(ctx, ev, {
            tgtHP,
        });
        if (!processed) continue;

        deathTime = updateDeathTime(S, ev, deathTime, tgtHP);
    }

    return deathTime;
}
