import { untamedState } from "./state.js";
import type { RangerCastContext, RangerSkill } from "../../types.js";

function unleash(context: RangerCastContext, rangerUnleashed: boolean): void {
  const state = untamedState.from(context);
  state.rangerUnleashed = rangerUnleashed;
  // Emit at effectiveEnd so the resolver state flip aligns with when the skill animation completes.
  context.emit({
    type: "ranger.untamed-state",
    at: context.effectiveEnd,
    source: "ranger",
    sourceId: rangerUnleashed ? "ranger.unleash-ranger" : "ranger.unleash-pet",
    actorType: "player",
    rangerUnleashed,
  });
  if (
    // Only Unleash Ranger opens an ambush window; Unleash Pet does not.
    !rangerUnleashed ||
    // Unleashed Power (minor trait) gates ambush grants to one per 9s; skip if on cooldown.
    context.start + context.epsilon < state.unleashedPowerReadyAt
  ) {
    return;
  }
  // 4-second window from the cast start, not effectiveEnd, matching the in-game timing.
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
      // Consuming an ambush closes the window immediately; another Unleash Ranger is required.
      untamedState.from(context).ambushReadyUntil = 0;
    },
  },
  "ranger.exploding-spores": {
    mode: "augment" as const,
    // Capture the unleash state at cast start; it could flip by afterEffects if Unleash is queued.
    beforeEffects(context: RangerCastContext) {
      return untamedState.from(context).rangerUnleashed;
    },
    afterEffects(
      context: RangerCastContext,
      skill: RangerSkill,
      rangerWasUnleashed: unknown,
    ) {
      // Boon and duration differ depending on which side was unleashed when the skill was cast.
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
      // Venomous Outburst applies Vulnerability only when the target has a defiance bar
      // (defiant, disabled, or broken); it has no effect on normal enemies.
      if (
        context.config.target?.defiant ||
        context.config.target?.disabled ||
        context.config.target?.defianceBroken
      ) {
        context.emit({
          type: "condition",
          at: context.start,
          // Attributed to ranger-pet so Ferocious Symbiosis cross-triggers correctly.
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
