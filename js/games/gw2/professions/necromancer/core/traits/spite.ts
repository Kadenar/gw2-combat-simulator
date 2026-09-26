import { buildResolverBuff, buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
/** Owns imperative Core Necromancer Spite trait behavior for ordered dispatcher calls. */
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { BalanceProfile, ConditionEffect } from '#gw2/platform/engine/skills/types.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { remainingTargetHealthBelow } from '#gw2/platform/combat/state/target-health.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';

import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { queueTraitCoefficientDamage } from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';

import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

/** Reports whether the target is strictly below half health, using the shared threshold contract. */
function targetBelowHalfHealth(context: NecromancerResolverContext): boolean {
  return remainingTargetHealthBelow(context.config, context, 0.5);
}

export function applyReapersMight(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  firstHit: boolean,
  shroudSkillOne: boolean
): void {
  if (!hasTrait(context, TRAIT.REAPERS_MIGHT) || !firstHit || !shroudSkillOne) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.reapersMight);
  const effect = requireEffect(profile, 'boon', 'might');
  // The proc record reports only a delivered boon.
  if (!effect) return;
  queueResolverBoon(
    context,
    event,
    buildResolverBuff({
      at: event.at,

      skillName: "Reaper's Might",
      kind: String(effect.boon),
      stacks: effectNumber(profile, effect, 'stacks'),
      duration: effectNumber(profile, effect, 'duration'),
      source: 'Trait',
      sourceId: TRAIT.REAPERS_MIGHT,
      actorType: 'effect',
      triggeredBy: event.skillName
    })
  );
  context.recordProc?.('trait', "Reaper's Might", event.at, event.skillName);
}

export function applySiphonedPower(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.SIPHONED_POWER) || !targetBelowHalfHealth(context)) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.siphonedPower);
  const effect = requireEffect(profile, 'boon', 'might');
  // Claim only after local eligibility, before conditions, resources or queued strikes; the cooldown gates only
  // might, so a removed boon leaves it ready.
  if (
    !effect ||
    !tryConsumeProcCooldown(
      professionCoreState(context).traitProcReadyAt,
      'siphonedPower',
      event.at,
      balanceProfileNumber(profile, 'cooldown')
    )
  )
    return;
  queueResolverBoon(
    context,
    event,
    buildResolverBuff({
      at: event.at,

      skillName: 'Siphoned Power',
      kind: String(effect.boon),
      stacks: effectNumber(profile, effect, 'stacks'),
      duration: effectNumber(profile, effect, 'duration'),
      source: 'Trait',
      sourceId: TRAIT.SIPHONED_POWER,
      actorType: 'effect',
      triggeredBy: event.skillName
    })
  );
  context.recordProc?.('trait', 'Siphoned Power', event.at, event.skillName);
}

export function applyChillOfDeath(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.CHILL_OF_DEATH) || !targetBelowHalfHealth(context)) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.chillOfDeath);
  // No target boons can be removed, so use only the zero-boon strike profile.
  const strike = requireEffect(profile, 'strike', 'Lesser Spinal Shivers - No Boons');
  const chilled = requireEffect(profile, 'condition', 'Chilled');
  // Claim only after local eligibility, before conditions, resources or queued strikes; with both packets removed
  // there is no proc to gate.
  if (
    (!strike && !chilled) ||
    !tryConsumeProcCooldown(
      professionCoreState(context).traitProcReadyAt,
      'chillOfDeath',
      event.at,
      balanceProfileNumber(profile, 'cooldown')
    )
  )
    return;
  if (strike)
    queueTraitCoefficientDamage(context, event, {
      name: 'Lesser Spinal Shivers',
      traitId: TRAIT.CHILL_OF_DEATH,
      coefficient: effectNumber(profile, strike, 'coefficient'),
      noCrit: true
    });
  // Without its strike, Chill has no resolved hit to follow and applies at the trigger instead.
  else if (chilled) queueChillOfDeathCondition(context, event, profile, chilled);
}

function queueChillOfDeathCondition(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  profile: BalanceProfile,
  chilled: ConditionEffect
): void {
  context.queue.enqueue(
    buildResolverCondition({
      condition: String(chilled.condition),
      stacks: effectNumber(profile, chilled, 'stacks'),
      name: 'Lesser Spinal Shivers — Chilled',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.CHILL_OF_DEATH,
      actorType: 'effect',
      skillName: 'Lesser Spinal Shivers',
      duration: effectNumber(profile, chilled, 'duration')
    })
  );
}

/** Queue Chill from the resolved trait strike so sibling strikes keep their pre-Chill state. */
export function applyChillOfDeathCondition(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.actorType !== 'effect' || event.sourceId !== TRAIT.CHILL_OF_DEATH) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.chillOfDeath);
  const chilled = requireEffect(profile, 'condition', 'Chilled');
  if (chilled) queueChillOfDeathCondition(context, event, profile, chilled);
}
