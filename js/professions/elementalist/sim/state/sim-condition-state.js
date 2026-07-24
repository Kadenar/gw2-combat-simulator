function getConditionStateTarget(S) {
    return S?.schedulerConditionState || S;
}

export function ensureConditionStateMap(S) {
    const target = getConditionStateTarget(S);
    if (!target.condState || typeof target.condState !== 'object') target.condState = {};
    return target.condState;
}

export function peekConditionState(S, cond) {
    return ensureConditionStateMap(S)[cond] || null;
}

export function ensureConditionStateEntry(S, cond) {
    const condState = ensureConditionStateMap(S);
    if (!condState[cond]) {
        condState[cond] = { stacks: [], tickActive: false, nextTick: null };
    }
    return condState[cond];
}

export function restoreConditionState(S, schedulerConditionState) {
    if (!schedulerConditionState) return S;
    S.condState = schedulerConditionState.condState || {};
    return S;
}
