import { ACTOR } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  bloodThirstApplied,
  packStrikeApplied,
  strike,
  strikeEffectsApplied
} from '#gw2/professions/ranger/core/mechanics/trigger-points.js';
import { triggerSharpeningStone, triggerStrengthOfThePack } from '#gw2/professions/ranger/core/skills/slot-skills.js';
import { triggerPoisonousStrikes } from '#gw2/professions/ranger/core/skills/weapons/dagger.js';
import { triggerBloodThirst } from '#gw2/professions/ranger/core/skills/weapons/shortbow.js';
import type { RangerResolverContext } from '#gw2/professions/ranger/types.js';

/** Dispatch qualifying hits in their established trait/skill order so queued effects and charge use stay stable. */
export function reactToRangerCoreDamage(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!(Number(event.coefficient) > 0) || event.actorType === ACTOR.EFFECT) return;

  context.fireTrigger(strike, { event });
  triggerPoisonousStrikes(context, event);
  triggerSharpeningStone(context, event);
  context.fireTrigger(strikeEffectsApplied, { event });
  triggerStrengthOfThePack(context, event);
  context.fireTrigger(packStrikeApplied, { event });
  triggerBloodThirst(context, event);
  context.fireTrigger(bloodThirstApplied, { event });
}
