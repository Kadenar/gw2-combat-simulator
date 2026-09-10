/** Shares Ranger modifier queries across player and pet rule collections. */
import {
  buffMatchesAudience,
  durationStackingBoonCapSeconds,
  GW2_STANDARD_BOONS,
  isDurationStackingBoon,
  isStandardBoon,
  remainingDurationStackSeconds
} from '#gw2/platform/combat/state/boons.js';
import { GW2_EVENT_ACTOR_TYPES, gw2EventActorType } from '#gw2/platform/combat/state/event-ownership.js';
import { boonActive, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers/types.js';

export function rangerPetEvent(context: Gw2ModifierContext): boolean {
  // Pet modifiers require both canonical summon classification and Ranger-specific source ownership.
  return gw2EventActorType(context.event) === GW2_EVENT_ACTOR_TYPES.SUMMON && context.event?.source === 'ranger-pet';
}

export function rangerBoonActive(context: Gw2ModifierContext, boon: string): boolean {
  // Standard boons use chronological player recipients; custom player/pet buff keys retain their existing lookup.
  if (isStandardBoon(boon)) return boonActive(context, boon);
  if (context.config?.boons?.[boon] || context.timeline?.timedActive(boon, context.time)) return true;
  return (context.runtime?.boons?.get(boon) || []).some(
    (application) => application.at <= context.time && application.expiresAt > context.time
  );
}

function rangerPetBoonActive(context: Gw2ModifierContext, boon: string): boolean {
  // Query the attacking pet's incarnation, including delayed packets after a swap. Recipient selection already owns sharing and caps.
  const companionId = context.event?.summonOwner == null ? null : String(context.event.summonOwner);
  if (!context.runtime) {
    return Boolean(context.timeline?.buffStacksAt(boon, context.time, 0, 25, 'summon', companionId));
  }

  const applications = (context.runtime.boons?.get(boon) || []).filter((application) =>
    buffMatchesAudience(application, 'summon', companionId)
  );
  if (isDurationStackingBoon(boon)) {
    return (
      remainingDurationStackSeconds(applications, context.time, { maximum: durationStackingBoonCapSeconds(boon) }) > 0
    );
  }

  return applications.some((application) => application.at <= context.time && application.expiresAt > context.time);
}

export function rangerActiveBoonCount(context: Gw2ModifierContext, audience: 'player' | 'pet'): number {
  return GW2_STANDARD_BOONS.filter((boon) =>
    audience === 'pet' ? rangerPetBoonActive(context, boon) : rangerBoonActive(context, boon)
  ).length;
}

export function rangerTargetImpaired(context: Gw2ModifierContext): boolean {
  if (context.config?.target?.defiant || context.config?.target?.disabled || context.config?.target?.defianceBroken) {
    return true;
  }

  return ['Chilled', 'Crippled', 'Immobilized', 'Taunt', 'Fear'].some((condition) =>
    targetConditionActive(context, condition)
  );
}
