import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { onResolvedCriticalHit } from '#gw2/platform/profession-definition/mechanics.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { resolveSummonOwnedComboFinisher } from '#gw2/professions/necromancer/specializations/reaper/mechanics/combos.js';
import {
  applyTraitCondition,
  queueTraitCoefficientDamage,
  targetIsChilled
} from '#gw2/professions/necromancer/core/traits/index.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';
import type { BalanceProfile, ConditionEffect } from '#gw2/platform/engine/skills/types.js';

import { REAPER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/reaper/profiles.js';
import { reaperState } from '#gw2/professions/necromancer/specializations/reaper/state.js';

// Chilling Nova is gated on the target already being Chilled at the moment of the crit, not just on trait presence.
const chillingNovaCriticalHit = onResolvedCriticalHit<
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'necromancer.chilling-nova',
  chanceOnCriticalHit: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.chillingNova), 'criticalChance'),
  when: (context, event) =>
    Number(event.coefficient) > 0 && hasTrait(context, TRAIT.CHILLING_NOVA) && targetIsChilled(context, event.at),
  internalCooldown: {
    duration: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.chillingNova), 'cooldown'),
    readyAt: (context) => Number(reaperState.from(context).chillingNovaReadyAt || 0),
    setReadyAt: (context, readyAt) => {
      reaperState.from(context).chillingNovaReadyAt = readyAt;
    }
  },
  attribution: { kind: 'trait', id: TRAIT.CHILLING_NOVA },
  handler: (context, event, _details, application) => {
    // Chilling Nova is a discrete strike-and-chill package for each materialized proc.
    const profile = requireBalanceProfileFromContext(context, PROFILE.chillingNova);
    const strike = requireEffect(profile, 'strike', 'Strike');
    const chill = requireEffect(profile, 'condition', 'Chilled');
    for (let proc = 0; proc < application.quantity; proc += 1) {
      if (strike)
        queueTraitCoefficientDamage(context, event, {
          name: 'Chilling Nova',
          traitId: TRAIT.CHILLING_NOVA,
          coefficient: effectNumber(profile, strike, 'coefficient')
        });
      // Without its strike, Chill has no resolved hit to follow and applies at the trigger instead.
      else if (chill) queueChillingNovaChill(context, event, profile, chill);
    }
  }
});

function queueChillingNovaChill(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  profile: BalanceProfile,
  chill: ConditionEffect
): void {
  context.queue.enqueue(
    buildResolverCondition({
      condition: String(chill.condition),
      stacks: effectNumber(profile, chill, 'stacks'),
      name: 'Chilling Nova — Chilled',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.CHILLING_NOVA,
      actorType: 'effect',
      skillName: 'Chilling Nova',
      duration: effectNumber(profile, chill, 'duration')
    })
  );
}

/** Resolves Chilling Nova from actual strikes; combo production belongs to the caller's runtime. */
export function reactToReaperDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NativeResolvedDamageDetails = {}
): void {
  // The resolved Nova strike queues its condition after sibling strikes, preserving their pre-Chill state.
  if (event.actorType === 'effect' && event.sourceId === TRAIT.CHILLING_NOVA) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.chillingNova);
    const chill = requireEffect(profile, 'condition', 'Chilled');
    if (chill) queueChillingNovaChill(context, event, profile, chill);
  }

  chillingNovaCriticalHit.handler(context, event, details);
}

/** Converts Chilled applications into Deathly Chill's configured condition packet. */
function reactToCondition(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.condition === 'Chilled' && hasTrait(context, TRAIT.DEATHLY_CHILL)) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.deathlyChill);
    const effect = requireEffect(profile, 'condition', 'Bleeding');
    if (effect)
      applyTraitCondition(context, event, {
        name: 'Deathly Chill',
        traitId: TRAIT.DEATHLY_CHILL,
        condition: String(effect.condition),
        stacks: effectNumber(profile, effect, 'stacks'),
        duration: effectNumber(profile, effect, 'duration')
      });
  }
}

/** Converts eligible Fear controls into Shivers of Dread's Chill event. */
function reactToControl(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // controlKind and kind are both checked because fear appears under different fields depending on the event schema version.
  if ((event.controlKind !== 'fear' && event.kind !== 'fear') || !hasTrait(context, TRAIT.SHIVERS_OF_DREAD)) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, PROFILE.shiversOfDread);
  const chill = requireEffect(profile, 'condition', 'Chilled');
  if (!chill) return;
  context.queue.enqueue(
    buildResolverCondition({
      condition: String(chill.condition),
      stacks: effectNumber(profile, chill, 'stacks'),
      name: 'Shivers of Dread — Chilled',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.SHIVERS_OF_DREAD,
      actorType: 'effect',
      skillName: 'Shivers of Dread',
      duration: effectNumber(profile, chill, 'duration')
    })
  );
}

export const reaperResolverEventReactions = Object.freeze({
  damage(
    context: NecromancerResolverContext,
    event: NecromancerResolverEvent,
    details: NativeResolvedDamageDetails = {}
  ) {
    resolveSummonOwnedComboFinisher(context, event);
    reactToReaperDamage(context, event, details);
  },
  condition: reactToCondition,
  control: reactToControl
});
