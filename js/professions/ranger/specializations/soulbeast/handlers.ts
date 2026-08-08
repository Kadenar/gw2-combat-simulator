import { soulbeastState } from "./state.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { RANGER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import type { RangerCastContext, RangerSkill } from "../../types.js";

function emitBeastmodeState(
  context: RangerCastContext,
  skill: RangerSkill,
  active: boolean,
): void {
  soulbeastState.from(context).beastmodeActive = active;
  context.emit({
    type: "ranger.beastmode",
    at: context.start,
    source: "ranger",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    active,
  });
  if (hasTrait(context, TRAIT.UNSTOPPABLE_UNION)) {
    context.emit({
      type: "buff",
      at: context.start,
      source: "Trait",
      sourceId: TRAIT.UNSTOPPABLE_UNION,
      actorType: "effect",
      skillId: skill.id,
      skillName: "Unstoppable Union",
      kind: "protection",
      duration: 2.5,
      stacks: 1,
    });
  }
}

function stanceDuration(
  context: RangerCastContext,
  baseDuration: number,
): number {
  return hasTrait(context, TRAIT.LEADER_OF_THE_PACK)
    ? baseDuration * 1.2
    : baseDuration;
}

export const soulbeastSkillHandlers = Object.freeze({
  "ranger.beastmode-enter": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      emitBeastmodeState(context, skill, true);
    },
  },
  "ranger.beastmode-exit": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      emitBeastmodeState(context, skill, false);
    },
  },
  "ranger.one-wolf-pack": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const duration = stanceDuration(context, 6);
      soulbeastState.from(context).oneWolfPackUntil = context.start + duration;
      context.emit({
        type: "buff",
        at: context.start,
        source: "ranger",
        sourceId: skill.id,
        actorType: "player",
        skillId: skill.id,
        skillName: skill.name,
        kind: "one-wolf-pack",
        duration,
        stacks: 1,
      });
    },
  },
  "ranger.vulture-stance": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      context.emit({
        type: "buff",
        at: context.start,
        source: "ranger",
        sourceId: skill.id,
        actorType: "player",
        skillId: skill.id,
        skillName: skill.name,
        kind: "vulture-stance",
        duration: stanceDuration(context, 6),
        stacks: 1,
      });
    },
  },
});
