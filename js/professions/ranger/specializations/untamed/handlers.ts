import { untamedState } from "./state.js";
import type { RangerCastContext, RangerSkill } from "../../types.js";

function unleash(context: RangerCastContext, rangerUnleashed: boolean): void {
  const state = untamedState.from(context);
  state.rangerUnleashed = rangerUnleashed;
  context.emit({
    type: "ranger.untamed-state",
    at: context.effectiveEnd,
    source: "ranger",
    sourceId: rangerUnleashed ? "ranger.unleash-ranger" : "ranger.unleash-pet",
    actorType: "player",
    rangerUnleashed,
  });
  if (context.start + context.epsilon < state.unleashedPowerReadyAt) return;
  state.ambushReadyUntil = context.start + 4;
  state.unleashedPowerReadyAt = context.start + 9;
}

export const untamedSkillHandlers = Object.freeze({
  "ranger.unleash-ranger": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext) {
      unleash(context, true);
    },
  },
  "ranger.unleash-pet": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext) {
      unleash(context, false);
    },
  },
  "ranger.unleashed-ambush": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext) {
      untamedState.from(context).ambushReadyUntil = 0;
    },
  },
  "ranger.exploding-spores": {
    mode: "augment" as const,
    beforeEffects(context: RangerCastContext) {
      return untamedState.from(context).rangerUnleashed;
    },
    afterEffects(
      context: RangerCastContext,
      skill: RangerSkill,
      rangerWasUnleashed: unknown,
    ) {
      const boon = rangerWasUnleashed ? "might" : "protection";
      context.emit({
        type: "buff",
        at: context.effectiveEnd,
        source: "ranger",
        sourceId: skill.id,
        actorType: "player",
        skillId: skill.id,
        skillName: skill.name,
        name: `${skill.name} - ${boon}`,
        kind: boon,
        duration: rangerWasUnleashed ? 10 : 4,
        stacks: rangerWasUnleashed ? 8 : 1,
      });
    },
  },
  "ranger.venomous-outburst": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      if (
        context.config.target?.defiant ||
        context.config.target?.disabled ||
        context.config.target?.defianceBroken
      ) {
        context.emit({
          type: "condition",
          at: context.start,
          source: "ranger-pet",
          sourceId: skill.id,
          actorType: "summon",
          skillId: skill.id,
          skillName: skill.name,
          condition: "Vulnerability",
          duration: 10,
          stacks: 8,
        });
      }
    },
  },
});
