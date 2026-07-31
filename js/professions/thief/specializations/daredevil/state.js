import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import {
  hasThiefTrait,
  selectedThiefTraits,
  thiefBaseMaximumHealth,
} from "../../core/state.js";
import {
  professionStaticRulesApplied,
} from "../../../../platform/gw2/attribute-provenance.js";

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
  let maximumHealth = thiefBaseMaximumHealth(config);
  if (
    !professionStaticRulesApplied(config)
    && hasThiefTrait(traits, TRAIT.MARAUDERS_RESILIENCE)
  ) {
    maximumHealth += Number(
      config.stats?.power
      ?? config.attributes?.power
      ?? 1000,
    ) * 0.7;
  }
  return {
    maximumEndurance: 150,
    maximumHealth,
    selectedDodge: selectedDodge(config, traits),
    boundingDamageUntil: 0,
    thievesGuildVariant: "Daredevil",
  };
}
