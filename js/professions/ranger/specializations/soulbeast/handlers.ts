import { soulbeastState } from "./state.js";
import type { RangerCastContext, RangerSkill } from "../../types.js";
import { applyUnstoppableUnion, soulbeastStanceDuration } from "./traits.js";

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
  applyUnstoppableUnion(context, skill);
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
      const duration = soulbeastStanceDuration(context, 6);
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
        duration: soulbeastStanceDuration(context, 6),
        stacks: 1,
      });
    },
  },
});
