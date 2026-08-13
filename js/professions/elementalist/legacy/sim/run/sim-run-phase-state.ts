import type { ElementalistLegacyRuntimeState } from "../../types.js";

export function initializeRunPhaseState(
  S: ElementalistLegacyRuntimeState,
): void {
  S.runPhase = {
    mode: "runtime",
  };
}

export function enterSetupPhase(S: ElementalistLegacyRuntimeState): void {
  if (!S.runPhase) initializeRunPhaseState(S);
  if (!S.runPhase) return;
  S.runPhase.mode = "setup";
}

export function exitSetupPhase(S: ElementalistLegacyRuntimeState): void {
  if (!S.runPhase) initializeRunPhaseState(S);
  if (!S.runPhase) return;
  S.runPhase.mode = "runtime";
}

export function isSetupPhase(S: ElementalistLegacyRuntimeState): boolean {
  return S.runPhase?.mode === "setup";
}

export function hasExplicitCombatStart(
  S: ElementalistLegacyRuntimeState,
): boolean {
  return !!S?.hasExplicitCombatStart;
}

export function isCombatActiveAt(
  S: ElementalistLegacyRuntimeState,
  time: number,
): boolean {
  if (!hasExplicitCombatStart(S)) return true;
  if (
    typeof S?.combatStartTime !== "number" ||
    !Number.isFinite(S.combatStartTime)
  )
    return false;
  return time >= S.combatStartTime;
}

export function isPrecombatAt(
  S: ElementalistLegacyRuntimeState,
  time: number,
): boolean {
  return hasExplicitCombatStart(S) && !isCombatActiveAt(S, time);
}
