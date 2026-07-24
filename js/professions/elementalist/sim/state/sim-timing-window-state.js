function isPlainObject(value) {
    if (!value || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function cloneValue(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    if (Array.isArray(value)) return value.map(cloneValue);
    if (value instanceof Map) {
        const next = new Map();
        for (const [key, entry] of value.entries()) next.set(cloneValue(key), cloneValue(entry));
        return next;
    }
    if (value instanceof Set) {
        const next = new Set();
        for (const entry of value.values()) next.add(cloneValue(entry));
        return next;
    }
    if (isPlainObject(value)) {
        const next = {};
        for (const [key, entry] of Object.entries(value)) next[key] = cloneValue(entry);
        return next;
    }
    return value;
}

function createRuntimeWindowSnapshot(source) {
    const runtimeWindowState = source?.runtimeWindowState;
    return {
        arcaneEchoUntil: runtimeWindowState?.arcaneEchoUntil ?? 0,
        signetFirePassiveLostWindows: runtimeWindowState?.signetFirePassiveLostWindows
            ? runtimeWindowState.signetFirePassiveLostWindows.map(w => ({ from: w.from, until: w.until }))
            : [],
    };
}

export function getTimingWindowStateTarget(S) {
    const target = S?.schedulerTimingWindowState || S;
    if (target.castUntil === undefined) target.castUntil = 0;
    if (!target.runtimeWindowState) {
        target.runtimeWindowState = createRuntimeWindowSnapshot(target);
    }
    return target;
}

export function createTimingWindowStateSnapshot(source) {
    const target = source?.schedulerTimingWindowState || source || {};
    return {
        castUntil: target.castUntil ?? 0,
        runtimeWindowState: cloneValue(createRuntimeWindowSnapshot(target)),
    };
}

export function restoreTimingWindowState(S, timingWindowState) {
    const target = getTimingWindowStateTarget(S);
    const restored = createTimingWindowStateSnapshot(timingWindowState);
    target.castUntil = restored.castUntil;
    target.runtimeWindowState = restored.runtimeWindowState;
    return target;
}

export function createRuntimeWindowState() {
    return createRuntimeWindowSnapshot(null);
}

export function getRuntimeWindowState(S) {
    return getTimingWindowStateTarget(S).runtimeWindowState;
}

export function getCastUntil(S, fallback = 0) {
    const target = getTimingWindowStateTarget(S);
    return target.castUntil ?? fallback;
}

export function setCastUntil(S, time) {
    const target = getTimingWindowStateTarget(S);
    target.castUntil = time;
    return time;
}

export function getArcaneEchoUntil(S, fallback = 0) {
    return getRuntimeWindowState(S).arcaneEchoUntil || fallback;
}

export function setArcaneEchoUntil(S, time) {
    const target = getTimingWindowStateTarget(S);
    target.runtimeWindowState.arcaneEchoUntil = time;
    return time;
}

export function armArcaneEchoWindow(S, startTime, durationMs) {
    return setArcaneEchoUntil(S, startTime + durationMs);
}

export function clearArcaneEchoWindow(S) {
    return setArcaneEchoUntil(S, 0);
}

export function isArcaneEchoActive(S, time) {
    return getArcaneEchoUntil(S, 0) > time;
}

export function addSignetFirePassiveLostWindow(S, from, until) {
    const target = getTimingWindowStateTarget(S);
    target.runtimeWindowState.signetFirePassiveLostWindows.push({ from, until });
}

export function isSignetFirePassiveLost(S, time) {
    const windows = getRuntimeWindowState(S).signetFirePassiveLostWindows;
    for (let i = 0; i < windows.length; i++) {
        if (time >= windows[i].from && time < windows[i].until) return true;
    }
    return false;
}
