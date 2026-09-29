import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  triggerBloodThirst,
  triggerPoisonousStrikes,
  triggerSharpeningStone,
  triggerStrengthOfThePack
} from '#gw2/professions/ranger/core/mechanics/skill-reactions.js';
import {
  consumeOpeningStrike,
  triggerArachnophobia,
  triggerHuntersGaze,
  triggerLightOnYourFeet,
  triggerPoisonMaster,
  triggerTrappersExpertise
} from '#gw2/professions/ranger/core/traits/behavior.js';
import { triggerGoForTheThroat } from '#gw2/professions/ranger/core/traits/pet-behavior.js';
import type { RangerResolverContext } from '#gw2/professions/ranger/types.js';

/** Dispatch qualifying hits in their established trait/skill order so queued effects and charge use stay stable. */
export function reactToRangerCoreDamage(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!(Number(event.coefficient) > 0) || event.actorType === 'effect') return;
  consumeOpeningStrike(context, event);
  // The Beast skill's strike resolves before Lesser Sic 'Em is applied, so
  // the triggering hit cannot benefit from the buff it creates.
  triggerGoForTheThroat(context, event);
  triggerHuntersGaze(context, event);
  triggerPoisonMaster(context, event);
  triggerPoisonousStrikes(context, event);
  triggerSharpeningStone(context, event);
  triggerArachnophobia(context, event);
  triggerStrengthOfThePack(context, event);
  triggerTrappersExpertise(context, event);
  triggerBloodThirst(context, event);
  triggerLightOnYourFeet(context, event);
}
