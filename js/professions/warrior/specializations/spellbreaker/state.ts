import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type { SpellbreakerState } from "../../types.js";

export function createSpellbreakerState(): SpellbreakerState {
  return {
    attackerInsightExpiries: [],
    fullCounterActiveUntil: 0,
    magebaneTetherUntil: 0,
    magebaneTetherReadyAt: 0,
  };
}

export const spellbreakerState = defineProfessionSpecializationState(
  "Spellbreaker",
  createSpellbreakerState,
);
