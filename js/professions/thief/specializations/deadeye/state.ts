import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import { hasThiefTrait, selectedThiefTraits } from "../../core/state.js";
import type { DeadeyeState, ThiefConfig } from "../../types.js";

export function createDeadeyeState(config: ThiefConfig = {}): DeadeyeState {
  const traits = selectedThiefTraits(config);
  return {
    usesMaliciousStealthAttacks: true,
    markedTargetId: null,
    markExpiresAt: 0,
    markGeneration: 0,
    malice: 0,
    maximumMalice: hasThiefTrait(traits, TRAIT.MALEFICENT_SEVEN) ? 7 : 5,
    maliceCriticalProgress: 0,
    maleficentSevenTriggered: false,
    deadeyeRelicUntil: 0,
    stealthAttackCharges: 0,
    stealthAttackExpiresAt: 0,
  };
}

export const deadeyeState = defineProfessionSpecializationState(
  "Deadeye",
  createDeadeyeState,
);
