import { enqueueOrdered } from '../../../../platform/engine/events/queue.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import { RANGER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import type { RangerResolverContext, RangerResolverEvent } from '../../types.js';
import { rangerBalanceProfile, rangerBalanceProfileEffect } from '../../core/profiles.js';
import { DRUID_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

function triggerBloodMoon(context: RangerResolverContext, event: RangerResolverEvent): void {
  if (!hasTrait(context, TRAIT.BLOOD_MOON)) return;
  const bleeding = rangerBalanceProfileEffect(rangerBalanceProfile(context, PROFILE.bloodMoon), 'condition');
  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.BLOOD_MOON,
    actorType: 'effect',
    skillId: TRAIT.BLOOD_MOON,
    skillName: 'Blood Moon',
    name: 'Blood Moon - Bleeding',
    condition: String(bleeding?.condition || 'Bleeding'),
    duration: Number(bleeding?.duration ?? 4),
    stacks: Number(bleeding?.stacks ?? 2),
    triggeredBy: event.skillName
  });
}

export function reactToDruidControl(context: RangerResolverContext, event: RangerResolverEvent): void {
  triggerBloodMoon(context, event);
}

export function reactToDruidCondition(context: RangerResolverContext, event: RangerResolverEvent): void {
  // Blood Moon only triggers on Immobilize, not on all conditions; "Immobile" is an alternate name used by some event sources
  if (event.condition === 'Immobilized' || event.condition === 'Immobile') {
    triggerBloodMoon(context, event);
  }
}
