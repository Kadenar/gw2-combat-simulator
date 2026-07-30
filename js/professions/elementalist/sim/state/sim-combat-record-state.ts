import type {
    SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type {
    ElementalistCombatConditionStack,
    ElementalistLegacyRuntimeState,
} from "../../types.js";

function getCombatRecordTarget(
    S: ElementalistLegacyRuntimeState,
): ElementalistLegacyRuntimeState {
    return S?.schedulerCombatState || S;
}

export function ensureCombatFields(
    S: ElementalistLegacyRuntimeState,
): SchedulerRecord[] {
    const target = getCombatRecordTarget(S);
    if (!Array.isArray(target.fields)) target.fields = [];
    return target.fields;
}

export function getCombatFields(
    S: ElementalistLegacyRuntimeState,
): SchedulerRecord[] {
    return ensureCombatFields(S);
}

export function pushCombatField<T extends SchedulerRecord>(
    S: ElementalistLegacyRuntimeState,
    entry: T,
): T {
    ensureCombatFields(S).push(entry);
    return entry;
}

export function ensureCombatAuras(
    S: ElementalistLegacyRuntimeState,
): SchedulerRecord[] {
    const target = getCombatRecordTarget(S);
    if (!Array.isArray(target.auras)) target.auras = [];
    return target.auras;
}

export function getCombatAuras(
    S: ElementalistLegacyRuntimeState,
): SchedulerRecord[] {
    return ensureCombatAuras(S);
}

export function pushCombatAura<T extends SchedulerRecord>(
    S: ElementalistLegacyRuntimeState,
    entry: T,
): T {
    ensureCombatAuras(S).push(entry);
    return entry;
}

export function ensureCombatCondMap(
    S: ElementalistLegacyRuntimeState,
): Map<string, ElementalistCombatConditionStack[]> {
    const target = getCombatRecordTarget(S);
    if (!(target._condMap instanceof Map)) target._condMap = new Map();
    return target._condMap;
}

export function ensureCombatCondStacks(
    S: ElementalistLegacyRuntimeState,
): ElementalistCombatConditionStack[] {
    const target = getCombatRecordTarget(S);
    if (!Array.isArray(target.allCondStacks)) target.allCondStacks = [];
    return target.allCondStacks;
}

export function peekCombatCondStacks(
    S: ElementalistLegacyRuntimeState,
    cond: string,
): ElementalistCombatConditionStack[] | null {
    return ensureCombatCondMap(S).get(cond) || null;
}

export function pushCombatCondStack<T extends ElementalistCombatConditionStack>(
    S: ElementalistLegacyRuntimeState,
    entry: T,
): T {
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

export function restoreCombatRecordState(
    S: ElementalistLegacyRuntimeState,
    combatState?: ElementalistLegacyRuntimeState | null,
): ElementalistLegacyRuntimeState {
    if (!combatState) return S;
    S.fields = combatState.fields || [];
    S.auras = combatState.auras || [];
    S.allCondStacks = combatState.allCondStacks || [];
    S._condMap = combatState._condMap || new Map();
    return S;
}
