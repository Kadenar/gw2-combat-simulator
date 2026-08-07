import { daredevilState } from "./state.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { hasThiefTrait } from "../../core/state.js";
import {
  emitThiefState,
  gainThiefEndurance,
} from "../../core/shared.js";
import { DAREDEVIL_DODGE_EFFECTS } from "./mechanics.js";
import type { DaredevilDodgeEffect } from "./mechanics.js";
import type { ThiefCastContext, ThiefSkill } from "../../types.js";

function emitDodgeEffect(
  context: ThiefCastContext,
  skill: ThiefSkill,
  effect: DaredevilDodgeEffect,
): void {
  const state = daredevilState.from(context);
  const common = {
    at: context.start + 0.8,
    source: "Trait",
    sourceId: effect.sourceId,
    actorType: "player",
    skillId: skill.id,
    skillName: state.selectedDodge,
    name: state.selectedDodge,
  } as const;
  if (effect.type === "strike") {
    context.emit({
      ...common,
      type: "damage",
      source: "thief",
      coefficient: Number(effect.coefficient || 0),
      hits: Number(effect.hits || 1),
      hitIndex: 1,
      totalHits: Number(effect.hits || 1),
      skillWeapon: "Unequipped",
    });
  } else if (effect.type === "condition") {
    context.emit({
      ...common,
      type: "condition",
      name: `${state.selectedDodge} — ${effect.condition}`,
      condition: effect.condition,
      stacks: Number(effect.stacks || 1),
      duration: Number(effect.duration || 0),
    });
  } else if (effect.type === "boon") {
    context.emit({
      ...common,
      type: "boon",
      name: `${state.selectedDodge} — ${effect.boon}`,
      boon: effect.boon,
      stacks: Number(effect.stacks || 1),
      duration: Number(effect.duration || 0),
    });
  }
}

export function applyDaredevilDodge(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  if (skill.id !== ID.DODGE) return;
  const state = daredevilState.from(context);
  if (state.selectedDodge === "Bounding Dodger") {
    state.boundingDamageUntil = context.start + 4;
  }
  for (const effect of DAREDEVIL_DODGE_EFFECTS[state.selectedDodge] || []) {
    emitDodgeEffect(context, skill, effect);
  }
  emitThiefState(context, context.effectiveEnd, "daredevil-dodge");
}

export function spendDaredevilResources(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const cost = Number(skill.initiativeCost || 0);
  if (
    cost > 0
    && skill.weapon === "Staff"
    && hasThiefTrait(context.config, TRAIT.STAFF_MASTER)
  ) {
    gainThiefEndurance(context, cost * 2, context.start, "staff-master");
  }
  if (
    (skill.categories || []).some(category =>
      String(category).toLowerCase().includes("physical"))
    && hasThiefTrait(context.config, TRAIT.BRAWLERS_TENACITY)
  ) {
    gainThiefEndurance(context, 10, context.start, "brawlers-tenacity");
  }
}

export const daredevilSchedulerHooks = Object.freeze({
  onCastStart: spendDaredevilResources,
  afterCast: Object.freeze([{
    id: "thief.daredevil-dodge",
    order: 30,
    handler: applyDaredevilDodge,
  }]),
});
