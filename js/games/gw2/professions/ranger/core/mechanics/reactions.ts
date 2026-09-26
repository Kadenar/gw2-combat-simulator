import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RangerResolverContext } from '#gw2/professions/ranger/types.js';
import { consumeOpeningStrike, triggerHuntersGaze } from '#gw2/professions/ranger/core/traits/marksmanship.js';
import { triggerGoForTheThroat } from '#gw2/professions/ranger/core/traits/beastmastery.js';
import { triggerPoisonMaster, triggerArachnophobia } from '#gw2/professions/ranger/core/traits/wilderness-survival.js';
import {
  triggerPoisonousStrikes,
  triggerSharpeningStone,
  triggerStrengthOfThePack,
  triggerStalkersStrike,
  triggerBloodThirst
} from '#gw2/professions/ranger/core/mechanics/skill-reactions.js';
import { triggerTrappersExpertise, triggerLightOnYourFeet } from '#gw2/professions/ranger/core/traits/index.js';
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
  triggerStalkersStrike(context, event);
  triggerTrappersExpertise(context, event);
  triggerBloodThirst(context, event);
  triggerLightOnYourFeet(context, event);
}
