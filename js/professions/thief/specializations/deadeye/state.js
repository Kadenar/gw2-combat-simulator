import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  hasThiefTrait,
  selectedThiefTraits,
} from "../../core/state.js";

export function createDeadeyeState(config = {}) {
  const traits = selectedThiefTraits(config);
  return {
    professionSkillId: ID.DEADEYES_MARK,
    usesMaliciousStealthAttacks: true,
    markedTargetId: null,
    malice: 0,
    maximumMalice: hasThiefTrait(traits, TRAIT.MALEFICENT_SEVEN) ? 7 : 5,
    maleficentSevenTriggered: false,
    thievesGuildVariant: "Deadeye",
  };
}
