import { enqueueOrdered } from '#kernel/events/queue.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerResolverEvent } from '#gw2/content/professions/ranger/types.js';
import { rangerBalanceProfile, rangerBalanceProfileEffect } from '#gw2/content/professions/ranger/core/profiles.js';
import { DRUID_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/ranger/specializations/druid/profiles.js';

function triggerBloodMoon(context: RangerResolverContext, event: RangerResolverEvent): void {
  if (!hasTrait(context, TRAIT.BLOOD_MOON)) return;
  const bleeding = rangerBalanceProfileEffect(rangerBalanceProfile(context, PROFILE.bloodMoon), 'condition');
  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.BLOOD_MOON,
    actorType: 'effect',
    ownerActorType: 'player',
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
