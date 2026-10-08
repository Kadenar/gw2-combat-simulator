import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

export function applyRangerDodgeTraits(context: RangerRuntime, at = context.time): void {
  if (!hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET);
  const effect = requireEffect(profile, 'buff', 'light-on-your-feet');
  if (!effect) return;
  const kind = String(effect.kind);
  const baseDuration = effectNumber(profile, effect, 'duration');
  // Reapplications stack duration in game, so preserve the live remainder
  // instead of replacing it with another six-second overlapping window.
  const activeUntil = context.facts
    .read()
    .filter((event) => event.type === 'buff' && event.kind === kind && event.at <= at)
    .reduce((maximum, event) => Math.max(maximum, gw2EffectExpiresAt(event.at, event.duration || 0)), at);
  context.effects.emit({
    kind: 'packet',
    event: buildRangerPacket(
      {
        at,
        source: 'Trait',
        sourceId: TRAIT.LIGHT_ON_YOUR_FEET,
        actorType: 'effect',
        skillId: TRAIT.LIGHT_ON_YOUR_FEET,
        skillName: 'Light on your Feet',
        kind,
        duration: baseDuration + Math.max(0, activeUntil - at),
        stacks: effectNumber(profile, effect, 'stacks')
      },
      'buff'
    )
  });
}

// Apply combat-only weapon-swap traits on independent ICDs and arm Quick Draw's
// one-use window for the next qualifying weapon skill.
export function applyRangerWeaponSwapTraits(context: RangerRuntime, skill: RangerSkill, at = context.time): void {
  const state = professionCoreState(context);
  const inCombat = context.combatStartTime != null && at >= context.combatStartTime;
  if (inCombat && hasTrait(context.traits, TRAIT.TAIL_WIND)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.TAIL_WIND);
    const effect = requireEffect(profile, 'boon', 'swiftness');
    // The cooldown gates only swiftness, so a removed boon leaves it ready.
    if (effect && context.procs.claim(TRAIT.TAIL_WIND, 'ranger.core.tailWind', at)) {
      context.effects.emit({
        kind: 'packet',
        event: buildRangerPacket(
          {
            at,
            source: 'Trait',
            sourceId: TRAIT.TAIL_WIND,
            actorType: 'effect',
            skillId: skill.id,
            skillName: 'Tail Wind',
            kind: String(effect.boon),
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks')
          },
          'buff'
        )
      });
    }
  }

  if (
    inCombat &&
    hasTrait(context.traits, TRAIT.QUICK_DRAW) &&
    context.procs.claim(TRAIT.QUICK_DRAW, 'ranger.core.quickDraw', at)
  ) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.QUICK_DRAW);
    const effect = requireEffect(profile, 'boon', 'quickness');
    // The recharge window is trait-owned, so it and its cooldown survive a removed quickness packet.
    state.quickDraw = grantCharges(1, at + balanceProfileNumber(profile, 'durationMultiplier'));
    if (effect)
      context.effects.emit({
        kind: 'packet',
        event: buildRangerPacket(
          {
            at,
            source: 'Trait',
            sourceId: TRAIT.QUICK_DRAW,
            actorType: 'effect',
            skillId: skill.id,
            skillName: 'Quick Draw',
            kind: String(effect.boon),
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks')
          },
          'buff'
        )
      });
  }

  if (inCombat && hasTrait(context.traits, TRAIT.FURIOUS_GRIP)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.FURIOUS_GRIP);
    const effect = requireEffect(profile, 'boon', 'fury');
    // The cooldown gates only fury, so a removed boon leaves it ready.
    if (effect && context.procs.claim(TRAIT.FURIOUS_GRIP, 'ranger.core.furiousGrip', at)) {
      context.effects.emit({
        kind: 'packet',
        event: buildRangerPacket(
          {
            at,
            source: 'Trait',
            sourceId: TRAIT.FURIOUS_GRIP,
            actorType: 'effect',
            skillId: skill.id,
            skillName: 'Furious Grip',
            kind: String(effect.boon),
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks')
          },
          'buff'
        )
      });
    }
  }
}

/** Apply Trapper's Expertise once per trap activation when its damage resolves. */
export function triggerTrappersExpertise(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  const skill = skillForEvent(context.helpers, event);
  if (skill?.categories?.includes('Trap') && event.activationId && hasTrait(context, TRAIT.TRAPPERS_EXPERTISE)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.TRAPPERS_EXPERTISE);
    const cripple = requireEffect(profile, 'condition', 'Crippled');
    if (!cripple) return;
    if (!claimActivation(state.activationClaims, 'ranger.trappers-expertise', event.activationId)) return;
    context.effects.emit({
      kind: 'packet',
      event: buildResolverCondition({
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.TRAPPERS_EXPERTISE,
        actorType: 'effect',
        skillId: TRAIT.TRAPPERS_EXPERTISE,
        skillName: "Trapper's Expertise",
        name: "Trapper's Expertise — Crippled",
        condition: String(cripple.condition),
        duration: effectNumber(profile, cripple, 'duration'),
        stacks: effectNumber(profile, cripple, 'stacks'),
        fixedDuration: true,
        triggeredBy: event.skillName
      })
    });
  }
}

/** Apply the trait-selected shortbow condition upgrades after base on-hit effects. */
export function triggerLightOnYourFeet(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const skill = skillForEvent(context.helpers, event);
  // Crossfire gains duration through the base-duration hook, never an additional bleed stack.
  if (skill?.id === ID.CONCUSSION_SHOT && hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET);
    const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
    if (vulnerability)
      context.effects.emit({
        kind: 'packet',
        event: buildResolverCondition({
          at: event.at,
          source: 'Trait',
          sourceId: TRAIT.LIGHT_ON_YOUR_FEET,
          actorType: 'effect',
          skillId: TRAIT.LIGHT_ON_YOUR_FEET,
          skillName: 'Light on your Feet',
          name: 'Light on your Feet — Vulnerability',
          condition: String(vulnerability.condition),
          // The vulnerability upgrade is unconditional once the trait is selected.
          duration: effectNumber(profile, vulnerability, 'duration'),
          stacks: effectNumber(profile, vulnerability, 'stacks'),
          triggeredBy: event.skillName
        })
      });
  }
}
