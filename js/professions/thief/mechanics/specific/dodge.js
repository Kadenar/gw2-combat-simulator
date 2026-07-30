import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasThiefTrait } from "../../state.js";
import {
  emitThiefCondition,
  emitThiefState,
  gainThiefInitiative,
} from "./shared.js";

export function performThiefDodge(context, skill) {
  const state = context.state.profession;
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
  if (state.selectedDodge === "Bounding Dodger") {
    state.boundingDamageUntil = context.start + 4;
  }
  for (const effect of skill.dodgeEffects?.[state.selectedDodge] || []) {
    if (effect.type === "strike") {
      context.emit({
        type: "damage",
        at: context.start + 0.8,
        source: "thief",
        sourceId: effect.sourceId,
        actorType: "player",
        skillId: skill.id,
        skillName: state.selectedDodge,
        name: state.selectedDodge,
        coefficient: Number(effect.coefficient || 0),
        hits: Number(effect.hits || 1),
        hitIndex: 1,
        totalHits: Number(effect.hits || 1),
        skillWeapon: "Unequipped",
      });
    } else if (effect.type === "condition") {
      context.emit({
        type: "condition",
        at: context.start + 0.8,
        source: "Trait",
        sourceId: effect.sourceId,
        actorType: "player",
        skillId: skill.id,
        skillName: state.selectedDodge,
        name: `${state.selectedDodge} — ${effect.condition}`,
        condition: effect.condition,
        stacks: Number(effect.stacks || 1),
        duration: Number(effect.duration || 0),
      });
    } else if (effect.type === "boon") {
      context.emit({
        type: "boon",
        at: context.start + 0.8,
        source: "Trait",
        sourceId: effect.sourceId,
        actorType: "player",
        skillId: skill.id,
        skillName: state.selectedDodge,
        name: `${state.selectedDodge} — ${effect.boon}`,
        boon: effect.boon,
        stacks: Number(effect.stacks || 1),
        duration: Number(effect.duration || 0),
      });
    }
  }
}

export function completeThiefDodge(context) {
  if (!hasThiefTrait(context.config, TRAIT.UPPER_HAND)) return;
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const readyAt = Number(
    state.traitProcReadyAt[TRAIT.UPPER_HAND] || 0,
  );
  if (at + Number(context.epsilon || 0.0001) < readyAt) return;
  state.traitProcReadyAt[TRAIT.UPPER_HAND] = at + 2;
  gainThiefInitiative(
    context,
    1,
    at,
    "upper-hand",
  );
}
