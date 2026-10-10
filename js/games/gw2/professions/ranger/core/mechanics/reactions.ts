import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  bloodThirstApplied,
  packStrikeApplied,
  strike,
  strikeEffectsApplied
} from '#gw2/professions/ranger/core/mechanics/combat.js';
import { triggerStrengthOfThePack } from '#gw2/professions/ranger/core/mechanics/skill-reactions.js';
import { triggerSharpeningStone } from '#gw2/professions/ranger/core/skills/slot-skills.js';
import { triggerPoisonousStrikes } from '#gw2/professions/ranger/core/skills/weapons/dagger.js';
import { triggerBloodThirst } from '#gw2/professions/ranger/core/skills/weapons/shortbow.js';
import type { RangerResolverContext } from '#gw2/professions/ranger/types.js';

/** Dispatch qualifying hits in their established trait/skill order so queued effects and charge use stay stable. */
export function reactToRangerCoreDamage(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!(Number(event.coefficient) > 0) || event.actorType === 'effect') return;
  context.fireTrigger(strike, { event });
  // The Beast skill's strike resolves before Lesser Sic 'Em is applied, so
  // the triggering hit cannot benefit from the buff it creates.

  triggerPoisonousStrikes(context, event);
  triggerSharpeningStone(context, event);
  context.fireTrigger(strikeEffectsApplied, { event });
  triggerStrengthOfThePack(context, event);
  context.fireTrigger(packStrikeApplied, { event });
  triggerBloodThirst(context, event);
  context.fireTrigger(bloodThirstApplied, { event });
}
