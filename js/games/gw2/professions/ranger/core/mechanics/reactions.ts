import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { triggerStrengthOfThePack } from '#gw2/professions/ranger/core/mechanics/skill-reactions.js';
import { triggerSharpeningStone } from '#gw2/professions/ranger/core/skills/slot-skills.js';
import { triggerPoisonousStrikes } from '#gw2/professions/ranger/core/skills/weapons/dagger.js';
import { triggerBloodThirst } from '#gw2/professions/ranger/core/skills/weapons/shortbow.js';
import { triggerGoForTheThroat } from '#gw2/professions/ranger/core/traits/beastmastery/pet-behavior.js';
import {
  consumeOpeningStrike,
  triggerHuntersGaze
} from '#gw2/professions/ranger/core/traits/marksmanship/opening-strike.js';
import {
  triggerLightOnYourFeet,
  triggerTrappersExpertise
} from '#gw2/professions/ranger/core/traits/skirmishing/movement.js';
import {
  triggerArachnophobia,
  triggerPoisonMaster
} from '#gw2/professions/ranger/core/traits/wilderness-survival/poison.js';
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
