import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import {
  hasThiefTrait,
  selectedThiefTraits,
} from "../../core/state.js";

function selectedDodge(config, traits) {
  if (hasThiefTrait(traits, TRAIT.LOTUS_TRAINING)) return "Lotus Training";
  if (hasThiefTrait(traits, TRAIT.BOUNDING_DODGER)) return "Bounding Dodger";
  if (hasThiefTrait(traits, TRAIT.UNHINDERED_COMBATANT)) {
    return "Unhindered Combatant";
  }
  return config.selectedDodge || "Dodge";
}

export function createDaredevilState(config = {}) {
  const traits = selectedThiefTraits(config);
  return {
    selectedDodge: selectedDodge(config, traits),
    boundingDamageUntil: 0,
  };
}

export const daredevilState = defineProfessionSpecializationState(
  "Daredevil",
  createDaredevilState,
);
