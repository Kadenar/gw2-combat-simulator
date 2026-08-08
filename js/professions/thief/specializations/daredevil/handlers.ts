import { daredevilState } from "./state.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { hasThiefTrait } from "../../core/state.js";
import {
  emitThiefState,
  emitThiefCondition,
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
  const dodgeSkillName = state.selectedDodge === "Bounding Dodger"
    ? "Bound"
    : state.selectedDodge === "Lotus Training"
      ? "Impaling Lotus"
      : state.selectedDodge;
  const common = {
    at: context.effectiveEnd,
    source: "Trait",
    sourceId: effect.sourceId,
    actorType: "player",
    skillId: skill.id,
    skillName: dodgeSkillName,
    name: dodgeSkillName,
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
      name: `${dodgeSkillName} — ${effect.condition}`,
      condition: effect.condition,
      stacks: Number(effect.stacks || 1),
      duration: Number(effect.duration || 0),
    });
  } else if (effect.type === "boon") {
    context.emit({
      ...common,
      type: "boon",
      name: `${dodgeSkillName} — ${effect.boon}`,
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
    state.boundingDamageUntil = context.effectiveEnd + 6;
  }
  if (state.selectedDodge === "Lotus Training") {
    state.lotusConditionDamageUntil = context.effectiveEnd + 6;
  }
  if (hasThiefTrait(context.config, TRAIT.WEAKENING_STRIKES)) {
    state.weakeningStrikeReady = true;
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
    && skill.id !== ID.PALM_STRIKE
    && hasThiefTrait(context.config, TRAIT.BRAWLERS_TENACITY)
  ) {
    gainThiefEndurance(context, 15, context.start, "brawlers-tenacity");
  }
}

function skillAttacks(skill: ThiefSkill): boolean {
  return skill.id !== ID.DODGE && (skill.effects || []).some(effect =>
    effect.type === "strike" || effect.type === "condition");
}

export function applyWeakeningStrike(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = daredevilState.from(context);
  if (!state.weakeningStrikeReady || !skillAttacks(skill)) return;
  state.weakeningStrikeReady = false;
  emitThiefCondition(context, {
    at: context.start,
    condition: "Weakness",
    duration: 3,
    stacks: 1,
    sourceId: TRAIT.WEAKENING_STRIKES,
    name: "Weakening Strikes — Weakness",
  });
  emitThiefState(context, context.start, "weakening-strikes");
}

export function updatePalmStrikeWindow(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = daredevilState.from(context);
  if (skill.id === ID.FIST_FLURRY) {
    state.palmStrikeUntil = context.effectiveEnd + 5;
    emitThiefState(context, context.effectiveEnd, "palm-strike-ready");
  } else if (skill.id === ID.PALM_STRIKE) {
    state.palmStrikeUntil = 0;
    emitThiefState(context, context.effectiveEnd, "palm-strike-used");
  }
}

function beginDaredevilCast(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  spendDaredevilResources(context, skill);
  applyWeakeningStrike(context, skill);
}

export const daredevilSchedulerHooks = Object.freeze({
  onCastStart: beginDaredevilCast,
  afterCast: Object.freeze([
    {
      id: "thief.daredevil-dodge",
      order: 30,
      handler: applyDaredevilDodge,
    },
    {
      id: "thief.daredevil-palm-strike",
      order: 40,
      handler: updatePalmStrikeWindow,
    },
  ]),
});
