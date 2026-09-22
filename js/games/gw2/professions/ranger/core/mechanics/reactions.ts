import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  onResolvedCriticalHit,
  onResolvedDamage,
  onResolvedControl,
  onBuffApplied
} from '#gw2/platform/profession-definition/mechanics.js';
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
import type { RangerResolverContext } from '#gw2/professions/ranger/types.js';
import {
  handleRangerBeastSkillUsed,
  handleRangerBloodThirst,
  handleRangerPetActive,
  handleRangerPetSwapped,
  handleRangerPoisonousStrikes,
  handleRangerSharpeningStone,
  handleRangerWinterBiteReady
} from '#gw2/professions/ranger/core/mechanics/event-handlers.js';
import {
  rangerCoreProfiledCriticalReaction,
  reactToRangerCoreBuff,
  reactToRangerCoreControl,
  triggerTrappersExpertise,
  triggerLightOnYourFeet
} from '#gw2/professions/ranger/core/traits/index.js';

import { reactToRangerGreatswordDamage } from '#gw2/professions/ranger/core/mechanics/greatsword.js';

export { rangerCoreCriticalReactions } from '#gw2/professions/ranger/core/traits/index.js';

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

export const rangerCoreEventHandlers = Object.freeze({
  'ranger.pet-active': handleRangerPetActive,
  'ranger.blood-thirst': handleRangerBloodThirst,
  'ranger.winter-bite-ready': handleRangerWinterBiteReady,
  'ranger.beast-skill-used': handleRangerBeastSkillUsed,
  'ranger.poisonous-strikes': handleRangerPoisonousStrikes,
  'ranger.sharpening-stone': handleRangerSharpeningStone,
  'ranger.pet-swapped': handleRangerPetSwapped
});

// Tag reactions here so module composition preserves their stage and registration order.
export const rangerCoreEventReactions = Object.freeze([
  onResolvedCriticalHit(rangerCoreProfiledCriticalReaction),
  onResolvedDamage({ id: 'ranger.greatsword-damage', order: 5, handler: reactToRangerGreatswordDamage }),
  onResolvedDamage({
    id: 'ranger.core-damage',
    order: 10,
    handler: reactToRangerCoreDamage
  }),
  onResolvedControl({
    id: 'ranger.core-control',
    order: 10,
    handler: reactToRangerCoreControl
  }),
  onBuffApplied({
    id: 'ranger.core-buff',
    order: 10,
    handler: reactToRangerCoreBuff
  })
]);
