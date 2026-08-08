import { professionCoreState } from "../../../platform/engine/profession.js";
import { THIEF_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { hasThiefTrait } from "./state.js";
import {
  emitThiefCondition,
  emitThiefState,
  gainThiefEndurance,
} from "./shared.js";
import type { ThiefCastContext, ThiefSkill } from "../types.js";

export function updateThiefTraitCastState(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const initiativeCost = Math.max(0, Number(skill.initiativeCost || 0));
  if (
    initiativeCost > 0
    && hasThiefTrait(context.config, TRAIT.LEAD_ATTACKS)
  ) {
    const expirations = state.leadAttackExpirations || [];
    for (
      let stack = 0;
      stack < initiativeCost && expirations.length < 15;
      stack += 1
    ) {
      expirations.push(at + 10);
    }
    state.leadAttackExpirations = expirations;
    state.leadAttacksStacks = expirations.length;
    state.leadAttacksUntil = expirations.length
      ? Math.max(...expirations)
      : 0;
    emitThiefState(context, at, "lead-attacks");
  }
  if (skill.movementSkill) {
    let movementStateChanged = false;
    if (hasThiefTrait(context.config, TRAIT.FLUID_STRIKES)) {
      state.fluidStrikesUntil = at + 5;
      movementStateChanged = true;
    }
    if (hasThiefTrait(context.config, TRAIT.HARD_TO_CATCH)) {
      gainThiefEndurance(context, 8, at, "hard-to-catch");
    } else if (movementStateChanged) {
      emitThiefState(context, at, "fluid-strikes");
    }
  }
  const isDualWieldAttack = skill.categories?.includes("DualWield")
    || Boolean(skill.requiredMainHand && typeof skill.requiredOffHand === "string");
  if (
    isDualWieldAttack
    && hasThiefTrait(context.config, TRAIT.DEADLY_AMBITION)
  ) {
    const potentPoison = hasThiefTrait(
      context.config,
      TRAIT.POTENT_POISON,
    );
    emitThiefCondition(context, {
      at,
      condition: "Poisoned",
      duration: 3,
      stacks: potentPoison ? 2 : 1,
      sourceId: TRAIT.DEADLY_AMBITION,
      name: "Deadly Ambition — Poison",
    });
  }
}
