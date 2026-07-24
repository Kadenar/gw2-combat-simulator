export function initializeRunPhaseState(S) {
    S.runPhase = {
        mode: 'runtime',
    };
}

export function enterSetupPhase(S) {
    S.runPhase.mode = 'setup';
}

export function exitSetupPhase(S) {
    S.runPhase.mode = 'runtime';
}

export function isSetupPhase(S) {
    return S.runPhase?.mode === 'setup';
}

export function hasExplicitCombatStart(S) {
    return !!S?.hasExplicitCombatStart;
}

export function isCombatActiveAt(S, time) {
    if (!hasExplicitCombatStart(S)) return true;
    if (typeof S?.combatStartTime !== 'number' || !Number.isFinite(S.combatStartTime)) return false;
    return time >= S.combatStartTime;
}

export function isPrecombatAt(S, time) {
    return hasExplicitCombatStart(S) && !isCombatActiveAt(S, time);
}
