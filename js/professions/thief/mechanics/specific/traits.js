import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasThiefTrait } from "../../state.js";
import {
  emitThiefCondition,
  emitThiefState,
  gainThiefInitiative,
} from "./shared.js";

export function updateThiefTraitCastState(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  if (
    context.config.specialization === "Deadeye"
    && state.markedTargetId
    && skill.type === "Weapon"
    && Number(skill.initiativeCost || 0) > 0
    && !skill.stealthAttack
  ) {
    state.malice = Math.min(state.maximumMalice, state.malice + 1);
    if (
      state.malice === state.maximumMalice
      && !state.maleficentSevenTriggered
      && hasThiefTrait(context.config, TRAIT.MALEFICENT_SEVEN)
    ) {
      state.maleficentSevenTriggered = true;
      gainThiefInitiative(context, 7, at, "maleficent-seven");
    }
    emitThiefState(context, at, "malice");
  }
  if (
    skill.requiredMainHand
    && skill.requiredOffHand != null
    && hasThiefTrait(context.config, TRAIT.DEADLY_AMBITION)
  ) {
    emitThiefCondition(context, {
      at,
      condition: "Poisoned",
      duration: 6,
      stacks: 2,
      sourceId: TRAIT.DEADLY_AMBITION,
      name: "Deadly Ambition — Poison",
    });
  }
}
