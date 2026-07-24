function getCombatRecordTarget(S) {
    return S?.schedulerCombatState || S;
}

export function ensureCombatFields(S) {
    const target = getCombatRecordTarget(S);
    if (!Array.isArray(target.fields)) target.fields = [];
    return target.fields;
}

export function getCombatFields(S) {
    return ensureCombatFields(S);
}

export function pushCombatField(S, entry) {
    ensureCombatFields(S).push(entry);
    return entry;
}

export function ensureCombatAuras(S) {
    const target = getCombatRecordTarget(S);
    if (!Array.isArray(target.auras)) target.auras = [];
    return target.auras;
}

export function getCombatAuras(S) {
    return ensureCombatAuras(S);
}

export function pushCombatAura(S, entry) {
    ensureCombatAuras(S).push(entry);
    return entry;
}

export function ensureCombatCondMap(S) {
    const target = getCombatRecordTarget(S);
    if (!(target._condMap instanceof Map)) target._condMap = new Map();
    return target._condMap;
}

export function ensureCombatCondStacks(S) {
    const target = getCombatRecordTarget(S);
    if (!Array.isArray(target.allCondStacks)) target.allCondStacks = [];
    return target.allCondStacks;
}

export function peekCombatCondStacks(S, cond) {
    return ensureCombatCondMap(S).get(cond) || null;
}

export function pushCombatCondStack(S, entry) {
    const condMap = ensureCombatCondMap(S);
    let arr = condMap.get(entry.cond);
    if (!arr) {
        arr = [];
        condMap.set(entry.cond, arr);
    }
    arr.push(entry);
    ensureCombatCondStacks(S).push(entry);
    return entry;
}

export function restoreCombatRecordState(S, combatState) {
    if (!combatState) return S;
    S.fields = combatState.fields || [];
    S.auras = combatState.auras || [];
    S.allCondStacks = combatState.allCondStacks || [];
    S._condMap = combatState._condMap || new Map();
    return S;
}
