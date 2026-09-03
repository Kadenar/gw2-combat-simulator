/** Registers scheduler-phase skill activations for this module. */
import {
  balanceProfileFromContext,
  balanceProfileEffect,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { untamedState } from '#gw2/content/professions/ranger/specializations/untamed/state.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import type { RangerCastContext, RangerSkill } from '#gw2/content/professions/ranger/types.js';

import { UNTAMED_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/ranger/specializations/untamed/profiles.js';

function unleash(context: RangerCastContext, rangerUnleashed: boolean): void {
  const state = untamedState.from(context);
  state.rangerUnleashed = rangerUnleashed;
  // Emit at effectiveEnd so the resolver state flip aligns with when the skill animation completes.
  context.emit({
    type: 'ranger.untamed-state',
    at: context.effectiveEnd,
    source: 'ranger',
    sourceId: rangerUnleashed ? 'ranger.unleash-ranger' : 'ranger.unleash-pet',
    actorType: 'player',
    rangerUnleashed
  });
  if (
    // Only Unleash Ranger opens an ambush window; Unleash Pet does not.
    !rangerUnleashed ||
    // Unleashed Power (minor trait) gates ambush grants to one per 9s; skip if on cooldown.
    !isInternalCooldownReady(context.start, state.unleashedPowerReadyAt)
  ) {
    return;
  }

  // 4-second window from the cast start, not effectiveEnd, matching the in-game timing.
  state.ambushReadyUntil =
    context.start + balanceProfileValueFromContext(context, PROFILE.resources, 'durationMultiplier', 4);
  state.unleashedPowerReadyAt =
    context.start + balanceProfileValueFromContext(context, PROFILE.resources, 'internalCooldown', 9);
}

export const untamedSkillHandlers = Object.freeze({
  'ranger.unleash-ranger': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext) {
      unleash(context, true);
    }
  },
  'ranger.unleash-pet': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext) {
      unleash(context, false);
    }
  },
  'ranger.unleashed-ambush': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext) {
      // Consuming an ambush closes the window immediately; another Unleash Ranger is required.
      untamedState.from(context).ambushReadyUntil = 0;
    }
  },
  'ranger.exploding-spores': {
    mode: 'augment' as const,
    // Capture the unleash state at cast start; it could flip by afterEffects if Unleash is queued.
    beforeEffects(context: RangerCastContext) {
      return untamedState.from(context).rangerUnleashed;
    },
    afterEffects(context: RangerCastContext, skill: RangerSkill, rangerWasUnleashed: unknown) {
      // Boon and duration differ depending on which side was unleashed when the skill was cast.
      const profileId = rangerWasUnleashed ? PROFILE.explodingSporesRanger : PROFILE.explodingSporesPet;
      const effect = balanceProfileEffect(balanceProfileFromContext(context, profileId), 'boon');
      const boon = String(effect?.boon || (rangerWasUnleashed ? 'might' : 'protection'));
      emitSkillBuff(context, {
        at: context.effectiveEnd,
        source: 'ranger',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        name: `${skill.name} - ${boon}`,
        kind: boon,
        duration: gw2SchedulerBoonDuration(
          context,
          skill,
          boon,
          Number(effect?.duration ?? (rangerWasUnleashed ? 10 : 4))
        ),
        stacks: Number(effect?.stacks ?? (rangerWasUnleashed ? 8 : 1))
      });
    }
  },
  'ranger.venomous-outburst': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      // Venomous Outburst applies Vulnerability only when the target has a defiance bar
      // (defiant, disabled, or broken); it has no effect on normal enemies.
      if (context.config.target?.defiant || context.config.target?.disabled || context.config.target?.defianceBroken) {
        emitSkillCondition(context, {
          at: context.start,
          // Attributed to ranger-pet so Ferocious Symbiosis cross-triggers correctly.
          source: 'ranger-pet',
          sourceId: skill.id,
          actorType: 'summon',
          skillId: skill.id,
          skillName: skill.name,
          condition: 'Vulnerability',
          duration: 10,
          stacks: 8
        });
      }
    }
  }
});
