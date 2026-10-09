import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { buffActive, countActiveBoons, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
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

/** Ranger chooses the attacking actor; shared queries own storage, recipients, and live visibility. */
export function activeBuff(context: RangerModifierContext, kind: string): boolean {
  return buffActive(context, kind, rangerPetEvent(context) ? petRecipient(context) : { actor: 'player' });
}

/** Delayed pet packets retain the incarnation that launched them, even after a swap. */
function petRecipient(context: Gw2ModifierContext) {
  return {
    actor: 'companion' as const,
    companionId: context.event?.summonOwner == null ? null : String(context.event.summonOwner)
  };
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

/** Player preview totals never replace the pet's own boon count. */
export function rangerActiveBoonCount(context: Gw2ModifierContext, audience: 'player' | 'pet'): number {
  return countActiveBoons(context, audience === 'pet' ? petRecipient(context) : { actor: 'player' });
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

/** Defiant targets qualify for flanking/behind bonuses because simulated golems never rotate. */
export function qualifiesForFlankingBonuses(context: Gw2ModifierContext): boolean {
  return Boolean(context.config?.target?.defiant);
}
