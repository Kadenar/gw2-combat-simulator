import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasThiefTrait } from "../../core/state.js";
import { gainThiefInitiative } from "../../core/shared.js";
import type { ThiefCastContext } from "../../types.js";
import { deadeyeState } from "./state.js";

export function initialDeadeyeMalice(context: ThiefCastContext): number {
  return hasThiefTrait(context.config, TRAIT.MALICIOUS_INTENT) ? 1 : 0;
}

export function applyMaleficentSeven(
  context: ThiefCastContext,
  at: number,
): void {
  const state = deadeyeState.from(context);
  if (
    state.malice !== state.maximumMalice ||
    state.maleficentSevenTriggered ||
    !hasThiefTrait(context.config, TRAIT.MALEFICENT_SEVEN)
  ) {
    return;
  }
  state.maleficentSevenTriggered = true;
  gainThiefInitiative(context, 7, at, "maleficent-seven");
}
