import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { onResolvedCriticalHit } from '#gw2/platform/profession-definition/mechanics.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { resolveSummonOwnedComboFinisher } from '#gw2/professions/necromancer/specializations/reaper/mechanics/combos.js';
import {
  applyTraitCondition,
  queueTraitCoefficientDamage,
  targetIsChilled
} from '#gw2/professions/necromancer/core/traits/index.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails
} from '#gw2/professions/necromancer/types.js';

import { REAPER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/reaper/profiles.js';
import { reaperState } from '#gw2/professions/necromancer/specializations/reaper/state.js';

// Chilling Nova is gated on the target already being Chilled at the moment of the crit, not just on trait presence.
const chillingNovaCriticalHit = onResolvedCriticalHit<
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails
>({
  id: 'necromancer.chilling-nova',
  materialization: 'threshold',
  chanceOnCriticalHit: (context) =>
    Number(balanceProfileFromContext(context, PROFILE.chillingNova)?.criticalChance ?? 1),
  when: (context, event) =>
    Number(event.coefficient) > 0 && hasTrait(context, TRAIT.CHILLING_NOVA) && targetIsChilled(context, event.at),
  expectedProgress: {
    get: (context) => reaperState.from(context).chillingNovaProgress,
    set: (context, value) => {
      reaperState.from(context).chillingNovaProgress = value;
    }
  },
  internalCooldown: {
    duration: (context) => Number(balanceProfileFromContext(context, PROFILE.chillingNova)?.cooldown ?? 3),
    readyAt: (context) => Number(reaperState.from(context).chillingNovaReadyAt || 0),
    setReadyAt: (context, readyAt) => {
      reaperState.from(context).chillingNovaReadyAt = readyAt;
    }
  },
  attribution: { kind: 'trait', id: TRAIT.CHILLING_NOVA },
  handler: (context, event, _details, application) => {
    // Chilling Nova is a discrete strike-and-chill package for each materialized proc.
    for (let proc = 0; proc < application.quantity; proc += 1) {
      const profile = balanceProfileFromContext(context, PROFILE.chillingNova);
      const strike = balanceProfileEffect(profile, 'strike');
      const chill = balanceProfileEffect(profile, 'condition');
      queueTraitCoefficientDamage(context, event, {
        name: 'Chilling Nova',
        traitId: TRAIT.CHILLING_NOVA,
        coefficient: Number(strike?.coefficient ?? 1.125)
      });
      enqueueOrdered(context.queue, {
        type: 'necromancer.chill',
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.CHILLING_NOVA,
        actorType: 'effect',
        skillName: 'Chilling Nova',
        duration: Number(chill?.duration ?? 2)
      });
    }
  }
});

/** Resolves summon combo finishers and Chilling Nova from one eligible damage packet. */
function reactToDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {}
): void {
  resolveSummonOwnedComboFinisher(context, event);
  chillingNovaCriticalHit.handler(context, event, details);
}

/** Converts Chilled applications into Deathly Chill's configured condition packet. */
function reactToCondition(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.condition === 'Chilled' && hasTrait(context, TRAIT.DEATHLY_CHILL)) {
    const effect = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.deathlyChill), 'condition');
    applyTraitCondition(context, event, {
      name: 'Deathly Chill',
      traitId: TRAIT.DEATHLY_CHILL,
      condition: String(effect?.condition || 'Bleeding'),
      stacks: Number(effect?.stacks ?? 4),
      duration: Number(effect?.duration ?? 4)
    });
  }
}

/** Converts eligible Fear controls into Shivers of Dread's Chill event. */
function reactToControl(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // controlKind and kind are both checked because fear appears under different fields depending on the event schema version.
  if ((event.controlKind !== 'fear' && event.kind !== 'fear') || !hasTrait(context, TRAIT.SHIVERS_OF_DREAD)) {
    return;
  }

  const chill = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.shiversOfDread), 'condition');
  enqueueOrdered(context.queue, {
    type: 'necromancer.chill',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.SHIVERS_OF_DREAD,
    actorType: 'effect',
    skillName: 'Shivers of Dread',
    duration: Number(chill?.duration ?? 2)
  });
}

export const reaperResolverEventReactions = Object.freeze({
  damage: reactToDamage,
  condition: reactToCondition,
  control: reactToControl
});
