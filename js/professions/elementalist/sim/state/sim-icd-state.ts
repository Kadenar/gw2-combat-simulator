import {
    isInternalCooldownReady,
} from '../../../../platform/engine/internal-cooldown.js';
import type {
    ElementalistLegacyRuntimeState,
} from "../../types.js";

function ensureTraitIcdState(
    S: ElementalistLegacyRuntimeState,
): Record<string, number> {
    if (!S.traitICD) S.traitICD = {};
    return S.traitICD;
}

function ensureRelicIcdState(
    S: ElementalistLegacyRuntimeState,
): Record<string, number> {
    if (!S.relicICD) S.relicICD = {};
    return S.relicICD;
}

function ensureSigilIcdState(
    S: ElementalistLegacyRuntimeState,
): Record<string, number> {
    if (!S.sigilICD) S.sigilICD = {};
    return S.sigilICD;
}

export function getTraitIcd(
    S: ElementalistLegacyRuntimeState,
    key: string,
    fallback = 0,
): number {
    return ensureTraitIcdState(S)[key] || fallback;
}

export function setTraitIcd(
    S: ElementalistLegacyRuntimeState,
    key: string,
    readyAt: number,
): number {
    ensureTraitIcdState(S)[key] = readyAt;
    return readyAt;
}

export function isTraitIcdReady(
    S: ElementalistLegacyRuntimeState,
    key: string,
    time: number,
): boolean {
    return isInternalCooldownReady(time, getTraitIcd(S, key, 0));
}

export function armTraitIcd(
    S: ElementalistLegacyRuntimeState,
    key: string,
    time: number,
    icdMs: number,
): number {
    return setTraitIcd(S, key, time + icdMs);
}

export function getRelicIcd(
    S: ElementalistLegacyRuntimeState,
    key: string,
    fallback = 0,
): number {
    return ensureRelicIcdState(S)[key] || fallback;
}

export function setRelicIcd(
    S: ElementalistLegacyRuntimeState,
    key: string,
    readyAt: number,
): number {
    ensureRelicIcdState(S)[key] = readyAt;
    return readyAt;
}

export function isRelicIcdReady(
    S: ElementalistLegacyRuntimeState,
    key: string,
    time: number,
): boolean {
    return isInternalCooldownReady(time, getRelicIcd(S, key, 0));
}

export function armRelicIcd(
    S: ElementalistLegacyRuntimeState,
    key: string,
    time: number,
    icdMs: number,
): number {
    return setRelicIcd(S, key, time + icdMs);
}

export function getSigilIcd(
    S: ElementalistLegacyRuntimeState,
    key: string,
    fallback = 0,
): number {
    return ensureSigilIcdState(S)[key] || fallback;
}

export function setSigilIcd(
    S: ElementalistLegacyRuntimeState,
    key: string,
    readyAt: number,
): number {
    ensureSigilIcdState(S)[key] = readyAt;
    return readyAt;
}

export function isSigilIcdReady(
    S: ElementalistLegacyRuntimeState,
    key: string,
    time: number,
): boolean {
    return isInternalCooldownReady(time, getSigilIcd(S, key, 0));
}

export function armSigilIcd(
    S: ElementalistLegacyRuntimeState,
    key: string,
    time: number,
    icdMs: number,
): number {
    return setSigilIcd(S, key, time + icdMs);
}
