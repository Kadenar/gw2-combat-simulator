import { professionSpecializationState } from "../../../../platform/engine/profession.js";
import { EPSILON } from "../../../../platform/engine/clock.js";
import { MESMER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { timedStacks } from "../../core/attribute-rules.js";
import { initializeMirageRuntime } from "./runtime.js";
import { mesmerRuntimeFor } from "../../core/runtime.js";
import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import type { Gw2ModifierRule } from "../../../../platform/gw2/types.js";
import type { MesmerPrecastContext, MesmerSkill } from "../../types.js";

function mirageAvailability(
  context: MesmerPrecastContext,
  skill: MesmerSkill,
): AvailabilityResult {
  if (!skill.ambush) return { ready: true };
  const runtime = mesmerRuntimeFor(context);
  const activeAmbush = runtime.ambushAttacks[runtime.activePrimaryWeapon()];
  const state = professionSpecializationState(context, "Mirage");
  if (
    activeAmbush
    && activeAmbush.name === skill.name
    && state.ambushSource
    && state.ambushUntil > context.start + EPSILON
  ) {
    return { ready: true };
  }
  return {
    ready: false,
    retryAt: null,
    code: "mesmer.ambush",
    reason: `${skill.name} has no active Mirage Cloak ambush window.`,
  };
}

export const mirageCastRules = Object.freeze({
  availability: {
    id: "mesmer.mirage.availability",
    order: 20,
    handler: mirageAvailability,
  },
});

export const mirageModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "mesmer.nomads-endurance",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: (_context, target) =>
      target === MODIFIER_TARGET.STRIKE_DAMAGE ? 0.1 : 0.05,
    when: (context) =>
      hasTrait(context, TRAIT.NOMADS_ENDURANCE) &&
      Boolean(context.timeline?.vigorActiveAt(context.time)),
  },
  {
    id: "mesmer.phantom-pain",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: (context, target) =>
      timedStacks(context, "phantom-pain", 10, 4) *
      (target === MODIFIER_TARGET.CONDITION_DAMAGE ? 0.05 : 0.0625),
  },
]);

export const mirageAttributeRules = Object.freeze({
  modifierRules: mirageModifierRules,
});

export const mirageSchedulerHooks = Object.freeze({
  initialize: initializeMirageRuntime,
});
