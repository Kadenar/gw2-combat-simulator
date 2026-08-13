import type {
  ElementalistConditionStateEntry,
  ElementalistLegacyRuntimeState,
} from "../../types.js";

function getConditionStateTarget(
  S: ElementalistLegacyRuntimeState,
): ElementalistLegacyRuntimeState {
  return S?.schedulerConditionState || S;
}

export function ensureConditionStateMap(
  S: ElementalistLegacyRuntimeState,
): Record<string, ElementalistConditionStateEntry> {
  const target = getConditionStateTarget(S);
  if (!target.condState || typeof target.condState !== "object")
    target.condState = {};
  return target.condState;
}

export function peekConditionState(
  S: ElementalistLegacyRuntimeState,
  cond: string,
): ElementalistConditionStateEntry | null {
  return ensureConditionStateMap(S)[cond] || null;
}

export function ensureConditionStateEntry(
  S: ElementalistLegacyRuntimeState,
  cond: string,
): ElementalistConditionStateEntry {
  const condState = ensureConditionStateMap(S);
  if (!condState[cond]) {
    condState[cond] = { stacks: [], tickActive: false, nextTick: null };
  }
  return condState[cond];
}

export function restoreConditionState(
  S: ElementalistLegacyRuntimeState,
  schedulerConditionState?: ElementalistLegacyRuntimeState | null,
): ElementalistLegacyRuntimeState {
  if (!schedulerConditionState) return S;
  S.condState = schedulerConditionState.condState || {};
  return S;
}
