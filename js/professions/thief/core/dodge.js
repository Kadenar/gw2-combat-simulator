import { professionCoreState } from "../../../platform/engine/profession.js";
import { THIEF_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { hasThiefTrait } from "./state.js";
import {
  emitThiefCondition,
  emitThiefState,
  gainThiefInitiative,
} from "./shared.js";

export function performThiefDodge(context) {
  const state = professionCoreState(context);
  state.endurance = Math.max(0, state.endurance - 50);
  emitThiefState(context, context.start, "dodge");
  if (hasThiefTrait(context.config, TRAIT.UNCATCHABLE)) {
    for (let pulse = 0; pulse < 3; pulse += 1) {
      const at = context.start + 0.8 + pulse;
      emitThiefCondition(context, {
        at,
        condition: "Bleeding",
        duration: 5,
        stacks: 1,
        sourceId: TRAIT.UNCATCHABLE,
        name: "Uncatchable — Lesser Caltrops",
      });
      emitThiefCondition(context, {
        at,
        condition: "Crippled",
        duration: 1,
        stacks: 1,
        sourceId: TRAIT.UNCATCHABLE,
        name: "Uncatchable — Lesser Caltrops",
      });
    }
  }
}

export function completeThiefDodge(context) {
  if (!hasThiefTrait(context.config, TRAIT.UPPER_HAND)) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const readyAt = Number(
    state.traitProcReadyAt[TRAIT.UPPER_HAND] || 0,
  );
  if (at + Number(context.epsilon || 0.0001) < readyAt) return;
  state.traitProcReadyAt[TRAIT.UPPER_HAND] = at + 2;
  gainThiefInitiative(context, 1, at, "upper-hand");
}
