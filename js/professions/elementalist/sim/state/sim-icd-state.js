function ensureTraitIcdState(S) {
    if (!S.traitICD) S.traitICD = {};
    return S.traitICD;
}

function ensureRelicIcdState(S) {
    if (!S.relicICD) S.relicICD = {};
    return S.relicICD;
}

function ensureSigilIcdState(S) {
    if (!S.sigilICD) S.sigilICD = {};
    return S.sigilICD;
}

export function getTraitIcd(S, key, fallback = 0) {
    return ensureTraitIcdState(S)[key] || fallback;
}

export function setTraitIcd(S, key, readyAt) {
    ensureTraitIcdState(S)[key] = readyAt;
    return readyAt;
}

export function isTraitIcdReady(S, key, time) {
    return time > getTraitIcd(S, key, 0);
}

export function armTraitIcd(S, key, time, icdMs) {
    return setTraitIcd(S, key, time + icdMs);
}

export function getRelicIcd(S, key, fallback = 0) {
    return ensureRelicIcdState(S)[key] || fallback;
}

export function setRelicIcd(S, key, readyAt) {
    ensureRelicIcdState(S)[key] = readyAt;
    return readyAt;
}

export function isRelicIcdReady(S, key, time) {
    return time > getRelicIcd(S, key, 0);
}

export function armRelicIcd(S, key, time, icdMs) {
    return setRelicIcd(S, key, time + icdMs);
}

export function getSigilIcd(S, key, fallback = 0) {
    return ensureSigilIcdState(S)[key] || fallback;
}

export function setSigilIcd(S, key, readyAt) {
    ensureSigilIcdState(S)[key] = readyAt;
    return readyAt;
}

export function isSigilIcdReady(S, key, time) {
    return time > getSigilIcd(S, key, 0);
}

export function armSigilIcd(S, key, time, icdMs) {
    return setSigilIcd(S, key, time + icdMs);
}
