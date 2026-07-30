import type {
    ElementalistLegacyRuntimeState,
    ElementalistPerSkillRecord,
} from "../../types.js";

function getReportingStateTarget(
    S: ElementalistLegacyRuntimeState,
): ElementalistLegacyRuntimeState {
    return S?.schedulerReportingState || S;
}

export function ensureReportingLog(
    S: ElementalistLegacyRuntimeState,
): unknown[] {
    const target = getReportingStateTarget(S);
    if (!Array.isArray(target.log)) target.log = [];
    return target.log;
}

export function pushReportingLog<T>(
    S: ElementalistLegacyRuntimeState,
    entry: T,
): T {
    ensureReportingLog(S).push(entry);
    return entry;
}

export function ensureReportingSteps(
    S: ElementalistLegacyRuntimeState,
): unknown[] {
    const target = getReportingStateTarget(S);
    if (!Array.isArray(target.steps)) target.steps = [];
    return target.steps;
}

export function pushReportingStep<T>(
    S: ElementalistLegacyRuntimeState,
    entry: T,
): T {
    ensureReportingSteps(S).push(entry);
    return entry;
}

export function ensureReportingPerSkill(
    S: ElementalistLegacyRuntimeState,
): Record<string, ElementalistPerSkillRecord> {
    const target = getReportingStateTarget(S);
    if (!target.perSkill || typeof target.perSkill !== 'object') target.perSkill = {};
    return target.perSkill;
}

export function ensurePerSkillRecord(
    S: ElementalistLegacyRuntimeState,
    name: string,
): ElementalistPerSkillRecord {
    const perSkill = ensureReportingPerSkill(S);
    if (!perSkill[name]) {
        perSkill[name] = { strike: 0, condition: 0, casts: 0, castTimeMs: 0, hits: 0 };
    }
    return perSkill[name];
}

export function addPerSkillStrike(
    S: ElementalistLegacyRuntimeState,
    name: string,
    amount: number,
): void {
    ensurePerSkillRecord(S, name).strike += amount;
}

export function addPerSkillCondition(
    S: ElementalistLegacyRuntimeState,
    name: string,
    amount: number,
): void {
    ensurePerSkillRecord(S, name).condition += amount;
}

export function addPerSkillHit(
    S: ElementalistLegacyRuntimeState,
    name: string,
): void {
    ensurePerSkillRecord(S, name).hits++;
}

export function recordPerSkillCast(
    S: ElementalistLegacyRuntimeState,
    name: string,
    castMs: number,
): void {
    const entry = ensurePerSkillRecord(S, name);
    entry.casts++;
    entry.castTimeMs += castMs;
}

export function restoreReportingState(
    S: ElementalistLegacyRuntimeState,
    reportingState?: ElementalistLegacyRuntimeState | null,
): ElementalistLegacyRuntimeState {
    if (!reportingState) return S;
    S.log = reportingState.log || [];
    S.steps = reportingState.steps || [];
    S.perSkill = reportingState.perSkill || {};
    return S;
}
