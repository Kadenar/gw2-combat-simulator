import { soulbeastState } from "./state.js";
import type { RangerCastContext, RangerSkill } from "../../types.js";
import { applyUnstoppableUnion, soulbeastStanceDuration } from "./traits.js";
import { rangerBalanceValue } from "../../core/profiles.js";
import { SOULBEAST_BALANCE_PROFILE_IDS as PROFILE } from "./profiles.js";

function emitBeastmodeState(
  context: RangerCastContext,
  skill: RangerSkill,
  active: boolean,
): void {
  // Mutate scheduler state immediately so subsequent casts in the same tick see the correct mode.
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
      const duration = soulbeastStanceDuration(
        context,
        rangerBalanceValue(
          context,
          PROFILE.oneWolfPack,
          "durationMultiplier",
          6,
        ),
      );
      // oneWolfPackUntil is written here so the resolver's per-hit ICD guard can cheaply
      // skip the active-buff lookup when the stance has clearly expired.
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
        duration: soulbeastStanceDuration(
          context,
          rangerBalanceValue(
            context,
            PROFILE.vultureStance,
            "durationMultiplier",
            6,
          ),
        ),
        stacks: 1,
      });
    },
  },
});
