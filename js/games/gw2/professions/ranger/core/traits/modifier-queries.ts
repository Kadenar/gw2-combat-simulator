import { buffApplicationStacks, GW2_STANDARD_BOONS, isStandardBoon } from '#gw2/platform/combat/boons.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { boonActive, countActiveBoons, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2EventActorType } from '#gw2/platform/combat/state/event-ownership.js';
import { GW2_EVENT_ACTOR_TYPES } from '#gw2/platform/events/actors.js';
import {
  readProfessionCoreState,
  readProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import type { RangerModifierContext } from '#gw2/professions/ranger/types.js';

/** Shares Ranger modifier queries across player and pet rule collections. */

/** Custom damage windows share the same configured, timeline, and live-stack lookup across Core and Soulbeast. */
export function activeBuff(context: RangerModifierContext, kind: string): boolean {
  if (context.config?.boons?.[kind]) return true;
  if (context.timeline?.timedActive(kind, context.time)) return true;
  return (context.runtime?.boons?.get(kind) || []).some(
    (application) => application.at <= context.time && application.expiresAt > context.time && application.stacks > 0
  );
}

/** Core merged traits and Soulbeast attributes read the same live merge state. */
export function beastmodeActive(context: RangerModifierContext): boolean {
  return Boolean(
    readProfessionSpecializationState<{ beastmodeActive?: boolean }>(context.runtime?.profession, 'Soulbeast')
      ?.beastmodeActive
  );
}

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

  // Live queries use only resolved applications; the shared helper owns recipient filtering and stacking.
  return (
    buffApplicationStacks(context.runtime.boons?.get(boon) || [], boon, context.time, 1, {
      audience: 'summon',
      companionId
    }) > 0
  );
}

export function rangerActiveBoonCount(context: Gw2ModifierContext, audience: 'player' | 'pet'): number {
  // The player-only preview total must not replace an independently simulated pet's boon count.
  return audience === 'pet'
    ? GW2_STANDARD_BOONS.filter((boon) => rangerPetBoonActive(context, boon)).length
    : countActiveBoons(context);
}

export function rangerTargetImpaired(context: Gw2ModifierContext): boolean {
  // Defiance and modeled conditions qualify; generic disable windows are not simulated.
  if (context.config?.target?.defiant) {
    return true;
  }

  return ['Chilled', 'Crippled', 'Immobilized', 'Taunt', 'Fear'].some((condition) =>
    targetConditionActive(context, condition)
  );
}

export function weaponSetIncludes(context: Gw2ModifierContext, weaponSet: number, names: readonly string[]): boolean {
  const weapons = gw2ConfiguredWeaponSet(context.config, weaponSet);
  return weapons.some((weapon) => names.includes(weapon || ''));
}

export function activePetFamily(context: RangerModifierContext): string {
  const activePet = readProfessionCoreState<{ activePet?: string }>(context.runtime?.profession).activePet;
  return rangerPetByName(activePet || context.config?.selectedPet || 'Pig').family;
}

export function positional(context: Gw2ModifierContext): boolean {
  // Defiant is the positional proxy: a defiant golem never rotates, so
  // flanking/behind bonuses always apply and need no separate control.
  return Boolean(context.config?.target?.defiant);
}
