import { enqueueOrdered } from '../../../../platform/engine/events/queue.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { onResolvedPlayerCriticalHit } from '../../../../platform/gw2/authoring/mechanics.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { resolveSummonOwnedComboFinisher } from './combos.js';
import { applyTraitCondition, queueTraitCoefficientDamage, targetIsChilled } from '../../core/traits.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails
} from '../../types.js';
import { balanceProfileEffect, necromancerBalanceProfile } from '../../core/profiles.js';
import { REAPER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { reaperState } from './state.js';

// Chilling Nova is gated on the target already being Chilled at the moment of the crit, not just on trait presence.
const chillingNovaCriticalHit = onResolvedPlayerCriticalHit<
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails
>({
  id: 'necromancer.chilling-nova',
  chanceOnCriticalHit: (context) =>
    Number(necromancerBalanceProfile(context, PROFILE.chillingNova)?.criticalChance || 1),
  when: (context, event) =>
    Number(event.coefficient) > 0 && hasTrait(context, TRAIT.CHILLING_NOVA) && targetIsChilled(context, event.at),
  expectedProgress: {
    get: (context) => reaperState.from(context).chillingNovaProgress,
    set: (context, value) => {
      reaperState.from(context).chillingNovaProgress = value;
    }
  },
  internalCooldown: {
    duration: (context) => Number(necromancerBalanceProfile(context, PROFILE.chillingNova)?.cooldown || 3),
    readyAt: (context) => Number(reaperState.from(context).chillingNovaReadyAt || 0),
    setReadyAt: (context, readyAt) => {
      reaperState.from(context).chillingNovaReadyAt = readyAt;
    }
  },
  attribution: { kind: 'trait', id: TRAIT.CHILLING_NOVA },
  handler: (context, event) => {
    const profile = necromancerBalanceProfile(context, PROFILE.chillingNova);
    const strike = balanceProfileEffect(profile, 'strike');
    const chill = balanceProfileEffect(profile, 'condition');
    queueTraitCoefficientDamage(context, event, {
      name: 'Chilling Nova',
      traitId: TRAIT.CHILLING_NOVA,
      coefficient: Number(strike?.coefficient || 1.125)
    });
    enqueueOrdered(context.queue, {
      type: 'necromancer.chill',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.CHILLING_NOVA,
      actorType: 'effect',
      skillName: 'Chilling Nova',
      duration: Number(chill?.duration || 2)
    });
  }
});

function reactToDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {}
): void {
  resolveSummonOwnedComboFinisher(context, event);
  chillingNovaCriticalHit.handler(context, event, details);
}

function reactToCondition(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.condition === 'Chilled' && hasTrait(context, TRAIT.DEATHLY_CHILL)) {
    const effect = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.deathlyChill), 'condition');
    applyTraitCondition(context, event, {
      name: 'Deathly Chill',
      traitId: TRAIT.DEATHLY_CHILL,
      condition: String(effect?.condition || 'Bleeding'),
      stacks: Number(effect?.stacks || 4),
      duration: Number(effect?.duration || 4)
    });
  }
}

function reactToControl(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // controlKind and kind are both checked because fear appears under different fields depending on the event schema version.
  if ((event.controlKind !== 'fear' && event.kind !== 'fear') || !hasTrait(context, TRAIT.SHIVERS_OF_DREAD)) {
    return;
  }

  const chill = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.shiversOfDread), 'condition');
  enqueueOrdered(context.queue, {
    type: 'necromancer.chill',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.SHIVERS_OF_DREAD,
    actorType: 'effect',
    skillName: 'Shivers of Dread',
    duration: Number(chill?.duration || 2)
  });
}

export const reaperResolverEventReactions = Object.freeze({
  damage: reactToDamage,
  condition: reactToCondition,
  control: reactToControl
});
