import { peekTimedStacks } from './sim-runtime-state.js';

export const ENDURANCE_MAX = 100;
export const ENDURANCE_BASE_REGEN_PER_SECOND = 5;
export const ENDURANCE_VIGOR_MULTIPLIER = 1.5;

function clampEndurance(value) {
    return Math.max(0, Math.min(ENDURANCE_MAX, value));
}

function isVigorActiveAt(S, time) {
    const stacks = peekTimedStacks(S, 'Vigor');
    if (!stacks || stacks.length === 0) return false;
    return stacks.some(stack => stack.t <= time && stack.expiresAt > time);
}

function getRelevantVigorBoundaries(S, fromTime, toTime) {
    const stacks = peekTimedStacks(S, 'Vigor');
    if (!stacks || stacks.length === 0) return [toTime];

    const boundaries = new Set([toTime]);
    for (const stack of stacks) {
        if (stack.expiresAt <= fromTime || stack.t >= toTime) continue;
        if (stack.t > fromTime && stack.t < toTime) boundaries.add(stack.t);
        if (stack.expiresAt > fromTime && stack.expiresAt < toTime) boundaries.add(stack.expiresAt);
    }
    return [...boundaries].sort((a, b) => a - b);
}

function getNextVigorBoundaryAfter(S, time) {
    const stacks = peekTimedStacks(S, 'Vigor');
    if (!stacks || stacks.length === 0) return Infinity;

    let nextBoundary = Infinity;
    for (const stack of stacks) {
        if (stack.t > time && stack.t < nextBoundary) nextBoundary = stack.t;
        if (stack.expiresAt > time && stack.expiresAt < nextBoundary) nextBoundary = stack.expiresAt;
    }
    return nextBoundary;
}

export function ensureEnduranceState(S) {
    if (!Number.isFinite(S.endurance)) S.endurance = ENDURANCE_MAX;
    if (!Number.isFinite(S.enduranceUpdatedAt)) S.enduranceUpdatedAt = 0;
    S.endurance = clampEndurance(S.endurance);
    return S.endurance;
}

export function catchUpEndurance(S, time) {
    ensureEnduranceState(S);
    if (!Number.isFinite(time) || time <= S.enduranceUpdatedAt) return S.endurance;

    let endurance = S.endurance;
    let cursor = S.enduranceUpdatedAt;
    const boundaries = getRelevantVigorBoundaries(S, cursor, time);

    for (const boundary of boundaries) {
        if (boundary <= cursor) continue;
        const vigorActive = isVigorActiveAt(S, cursor);
        const ratePerSecond = vigorActive
            ? ENDURANCE_BASE_REGEN_PER_SECOND * ENDURANCE_VIGOR_MULTIPLIER
            : ENDURANCE_BASE_REGEN_PER_SECOND;
        endurance = clampEndurance(endurance + ((boundary - cursor) / 1000) * ratePerSecond);
        cursor = boundary;
        if (endurance >= ENDURANCE_MAX) break;
    }

    S.endurance = clampEndurance(endurance);
    S.enduranceUpdatedAt = time;
    return S.endurance;
}

export function spendEndurance(S, amount, time = S.t) {
    ensureEnduranceState(S);
    catchUpEndurance(S, time);
    if (amount <= 0) return true;
    if (S.endurance < amount) return false;
    S.endurance = clampEndurance(S.endurance - amount);
    return true;
}

export function gainEndurance(S, amount, time = S.t) {
    ensureEnduranceState(S);
    catchUpEndurance(S, time);
    if (amount <= 0) return S.endurance;
    S.endurance = clampEndurance(S.endurance + amount);
    return S.endurance;
}

export function getEnduranceReadyTime(S, required, fromTime = S.t) {
    ensureEnduranceState(S);
    if (required <= 0) return fromTime;
    if (required > ENDURANCE_MAX) return Infinity;

    catchUpEndurance(S, fromTime);
    if (S.endurance >= required) return fromTime;

    let endurance = S.endurance;
    let cursor = fromTime;

    while (endurance < required) {
        const vigorActive = isVigorActiveAt(S, cursor);
        const ratePerSecond = vigorActive
            ? ENDURANCE_BASE_REGEN_PER_SECOND * ENDURANCE_VIGOR_MULTIPLIER
            : ENDURANCE_BASE_REGEN_PER_SECOND;
        const nextBoundary = getNextVigorBoundaryAfter(S, cursor);

        if (!Number.isFinite(nextBoundary)) {
            return cursor + ((required - endurance) / ratePerSecond) * 1000;
        }

        const gainUntilBoundary = ((nextBoundary - cursor) / 1000) * ratePerSecond;
        if (endurance + gainUntilBoundary >= required) {
            return cursor + ((required - endurance) / ratePerSecond) * 1000;
        }

        endurance = clampEndurance(endurance + gainUntilBoundary);
        cursor = nextBoundary;
        if (endurance >= ENDURANCE_MAX) return cursor;
    }

    return cursor;
}
