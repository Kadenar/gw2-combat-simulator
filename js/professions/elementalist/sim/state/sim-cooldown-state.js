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

export function getCooldownStateTarget(S) {
    const target = S?.schedulerCooldownState || S;
    if (!target.attCD) target.attCD = {};
    if (!target.attCDMeta) target.attCDMeta = {};
    if (!target.skillCD) target.skillCD = {};
    if (!target.skillCDMeta) target.skillCDMeta = {};
    if (!target.charges) target.charges = {};
    if (!target.chainState) target.chainState = {};
    if (!target.chainExpiry) target.chainExpiry = {};
    return target;
}

export function createCooldownStateSnapshot(source) {
    const target = source?.schedulerCooldownState || source || {};
    return {
        attCD: cloneValue(target.attCD || {}),
        attCDMeta: cloneValue(target.attCDMeta || {}),
        skillCD: cloneValue(target.skillCD || {}),
        skillCDMeta: cloneValue(target.skillCDMeta || {}),
        charges: cloneValue(target.charges || {}),
        chainState: cloneValue(target.chainState || {}),
        chainExpiry: cloneValue(target.chainExpiry || {}),
    };
}

export function restoreCooldownState(S, cooldownState) {
    const target = getCooldownStateTarget(S);
    target.attCD = cloneValue(cooldownState?.attCD || {});
    target.attCDMeta = cloneValue(cooldownState?.attCDMeta || {});
    target.skillCD = cloneValue(cooldownState?.skillCD || {});
    target.skillCDMeta = cloneValue(cooldownState?.skillCDMeta || {});
    target.charges = cloneValue(cooldownState?.charges || {});
    target.chainState = cloneValue(cooldownState?.chainState || {});
    target.chainExpiry = cloneValue(cooldownState?.chainExpiry || {});
    return target;
}

export function getSkillCooldownReadyAt(S, key, fallback = 0) {
    const target = getCooldownStateTarget(S);
    return target.skillCD[key] ?? fallback;
}

export function getSkillCooldownMeta(S, key, fallback = null) {
    const target = getCooldownStateTarget(S);
    return target.skillCDMeta[key] ?? fallback;
}

export function setSkillCooldownReadyAt(S, key, readyAt, meta = undefined) {
    const target = getCooldownStateTarget(S);
    target.skillCD[key] = readyAt;
    if (meta === undefined) delete target.skillCDMeta[key];
    else if (meta) target.skillCDMeta[key] = cloneValue(meta);
    else delete target.skillCDMeta[key];
    return readyAt;
}

export function capSkillCooldownReadyAt(S, key, readyAt) {
    return setSkillCooldownReadyAt(S, key, Math.min(getSkillCooldownReadyAt(S, key, readyAt), readyAt));
}

export function getAttunementCooldownReadyAt(S, attunement, fallback = 0) {
    const target = getCooldownStateTarget(S);
    return target.attCD[attunement] ?? fallback;
}

export function getAttunementCooldownMeta(S, attunement, fallback = null) {
    const target = getCooldownStateTarget(S);
    return target.attCDMeta[attunement] ?? fallback;
}

export function setAttunementCooldownReadyAt(S, attunement, readyAt, meta = undefined) {
    const target = getCooldownStateTarget(S);
    target.attCD[attunement] = readyAt;
    if (meta === undefined) delete target.attCDMeta[attunement];
    else if (meta) target.attCDMeta[attunement] = cloneValue(meta);
    else delete target.attCDMeta[attunement];
    return readyAt;
}

export function capAttunementCooldownReadyAt(S, attunement, readyAt) {
    return setAttunementCooldownReadyAt(S, attunement, Math.min(getAttunementCooldownReadyAt(S, attunement, readyAt), readyAt));
}

export function getChargeState(S, key) {
    const target = getCooldownStateTarget(S);
    return target.charges[key] || null;
}

export function ensureChargeState(S, key, maximumCount = 0) {
    const target = getCooldownStateTarget(S);
    if (!target.charges[key]) {
        target.charges[key] = { count: maximumCount, nextChargeAt: Infinity };
    }
    return target.charges[key];
}

export function adjustChargeCount(S, key, delta) {
    const chargeState = ensureChargeState(S, key);
    chargeState.count += delta;
    return chargeState.count;
}

export function setChargeReadyAt(S, key, readyAt) {
    const chargeState = ensureChargeState(S, key);
    chargeState.nextChargeAt = readyAt;
    return readyAt;
}

export function getChainProgress(S, chainRoot) {
    const target = getCooldownStateTarget(S);
    return target.chainState[chainRoot] || chainRoot;
}

export function listChainRoots(S) {
    return Object.keys(getCooldownStateTarget(S).chainState);
}

export function getChainExpiry(S, chainRoot) {
    const target = getCooldownStateTarget(S);
    return target.chainExpiry[chainRoot];
}

export function setChainProgress(S, chainRoot, nextSkill, expiryAt = null) {
    const target = getCooldownStateTarget(S);
    target.chainState[chainRoot] = nextSkill;
    if (expiryAt === null) {
        delete target.chainExpiry[chainRoot];
    } else {
        target.chainExpiry[chainRoot] = expiryAt;
    }
    return nextSkill;
}

export function expireChainProgress(S, chainRoot) {
    return setChainProgress(S, chainRoot, chainRoot);
}

export function reduceSkillCooldownRemaining(S, key, time, pct) {
    const readyAt = getSkillCooldownReadyAt(S, key);
    if (!readyAt || readyAt <= time) return readyAt;
    const remaining = readyAt - time;
    return setSkillCooldownReadyAt(S, key, time + Math.round(remaining * (1 - pct)));
}
