function getReportingStateTarget(S) {
    return S?.schedulerReportingState || S;
}

export function ensureReportingLog(S) {
    const target = getReportingStateTarget(S);
    if (!Array.isArray(target.log)) target.log = [];
    return target.log;
}

export function pushReportingLog(S, entry) {
    ensureReportingLog(S).push(entry);
    return entry;
}

export function ensureReportingSteps(S) {
    const target = getReportingStateTarget(S);
    if (!Array.isArray(target.steps)) target.steps = [];
    return target.steps;
}

export function pushReportingStep(S, entry) {
    ensureReportingSteps(S).push(entry);
    return entry;
}

export function ensureReportingPerSkill(S) {
    const target = getReportingStateTarget(S);
    if (!target.perSkill || typeof target.perSkill !== 'object') target.perSkill = {};
    return target.perSkill;
}

export function ensurePerSkillRecord(S, name) {
    const perSkill = ensureReportingPerSkill(S);
    if (!perSkill[name]) {
        perSkill[name] = { strike: 0, condition: 0, casts: 0, castTimeMs: 0, hits: 0 };
    }
    return perSkill[name];
}

export function addPerSkillStrike(S, name, amount) {
    ensurePerSkillRecord(S, name).strike += amount;
}

export function addPerSkillCondition(S, name, amount) {
    ensurePerSkillRecord(S, name).condition += amount;
}

export function addPerSkillHit(S, name) {
    ensurePerSkillRecord(S, name).hits++;
}

export function recordPerSkillCast(S, name, castMs) {
    const entry = ensurePerSkillRecord(S, name);
    entry.casts++;
    entry.castTimeMs += castMs;
}

export function restoreReportingState(S, reportingState) {
    if (!reportingState) return S;
    S.log = reportingState.log || [];
    S.steps = reportingState.steps || [];
    S.perSkill = reportingState.perSkill || {};
    return S;
}
