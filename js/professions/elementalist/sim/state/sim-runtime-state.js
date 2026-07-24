import { enqueueConditionTickEvent } from '../shared/sim-events.js';
import {
    pushCombatCondStack,
    peekCombatCondStacks,
} from './sim-combat-record-state.js';
import {
    ensureConditionStateEntry,
    peekConditionState,
} from './sim-condition-state.js';

export function pushTimedStack(S, entry) {
    return pushCombatCondStack(S, entry);
}

export function peekTimedStacks(S, cond) {
    return peekCombatCondStacks(S, cond);
}

export function getActiveTimedStacks(S, cond, time, {
    includePerma = true,
    predicate = null,
} = {}) {
    const arr = peekTimedStacks(S, cond);
    if (!arr) return [];
    return arr.filter(stack =>
        stack.t <= time
        && stack.expiresAt > time
        && (includePerma || !stack.perma)
        && (!predicate || predicate(stack))
    );
}

export function findActiveTimedStack(S, cond, time, options = {}) {
    return getActiveTimedStacks(S, cond, time, options)[0] || null;
}

export function expireActiveTimedStacks(S, cond, time, options = {}) {
    const active = getActiveTimedStacks(S, cond, time, options);
    for (const stack of active) stack.expiresAt = time;
    return active;
}

export function extendActiveTimedStacks(S, cond, time, extMs) {
    const arr = peekTimedStacks(S, cond);
    if (!arr) return 0;
    let count = 0;
    for (const stack of arr) {
        if (stack.expiresAt > time) {
            stack.expiresAt += extMs;
            count++;
        }
    }
    return count;
}

export function ensureConditionState(S, cond) {
    return ensureConditionStateEntry(S, cond);
}

export function addConditionStack(S, cond, time, expiresAt, appliedBy) {
    const cs = ensureConditionState(S, cond);
    cs.stacks.push({ t: time, expiresAt, appliedBy });
    pushTimedStack(S, { t: time, cond, expiresAt });
    return cs;
}

export function getActiveConditionStacks(S, cond, time) {
    const cs = peekConditionState(S, cond);
    if (!cs) return [];
    return cs.stacks.filter(stack => stack.t <= time && stack.expiresAt >= time);
}

export function countActiveConditionStacks(S, cond, time) {
    const cs = peekConditionState(S, cond);
    if (!cs) return 0;
    let count = 0;
    for (const stack of cs.stacks) {
        if (stack.t <= time && stack.expiresAt > time) count++;
    }
    return count;
}

export function activateConditionTicks(S, cond, time, { queueConditionTick = null } = {}) {
    const cs = ensureConditionState(S, cond);
    if (cs.tickActive) return false;
    cs.tickActive = true;
    cs.nextTick = time + 1000;
    const event = { time: time + 1000, cond };
    if (queueConditionTick) queueConditionTick(event);
    else enqueueConditionTickEvent(S.eq, event);
    return true;
}

export function pruneConditionStacks(S, cond, time) {
    const cs = peekConditionState(S, cond);
    if (!cs) return [];
    cs.stacks = cs.stacks.filter(stack => stack.expiresAt > time);
    return cs.stacks;
}

export function scheduleNextConditionTick(S, cond, time, { queueConditionTick = null } = {}) {
    const cs = ensureConditionState(S, cond);
    cs.nextTick = time + 1000;
    const event = { time: time + 1000, cond };
    if (queueConditionTick) queueConditionTick(event);
    else enqueueConditionTickEvent(S.eq, event);
}

export function deactivateConditionTicks(S, cond) {
    const cs = ensureConditionState(S, cond);
    cs.tickActive = false;
    cs.nextTick = null;
}

export function recordEffectWindow(S, effect, expiresAt) {
    if (effect === 'Quickness') {
        S.quicknessUntil = Math.max(S.quicknessUntil, expiresAt);
    } else if (effect === 'Alacrity') {
        S.alacrityUntil = Math.max(S.alacrityUntil, expiresAt);
    }
}

export function extendBoonWindows(S, time, extMs) {
    if (S.quicknessUntil > time) S.quicknessUntil += extMs;
    if (S.alacrityUntil > time) S.alacrityUntil += extMs;
}
