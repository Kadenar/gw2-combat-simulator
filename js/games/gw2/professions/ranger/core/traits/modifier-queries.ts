import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { buffActive, countActiveBoons, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2EventActorType } from '#gw2/platform/combat/state/event-ownership.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import { isPetStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { rangerMerged, type RangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { rangerPetForState, selectedRangerPet } from '#gw2/professions/ranger/data/pets.js';
import type { RangerModifierContext, RangerPetDefinition } from '#gw2/professions/ranger/types.js';

/** Shares Ranger modifier queries across player and pet rule collections. */

/** Ranger chooses the attacking actor; shared queries own storage, recipients, and live visibility. */
export function activeBuff(context: RangerModifierContext, kind: string): boolean {
  return buffActive(context, kind, rangerPetEvent(context) ? petRecipient(context) : { actor: ACTOR.PLAYER });
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
  return rangerMerged(context.runtime?.profession);
}

export function rangerPetEvent(context: Gw2ModifierContext): boolean {
  // Pet modifiers require both canonical summon classification and Ranger-specific source ownership.
  return gw2EventActorType(context.event) === ACTOR.SUMMON && isPetStrike(context.event);
}

/** Player preview totals never replace the pet's own boon count. */
export function rangerActiveBoonCount(context: Gw2ModifierContext, audience: typeof ACTOR.PLAYER | 'pet'): number {
  return countActiveBoons(context, audience === 'pet' ? petRecipient(context) : { actor: ACTOR.PLAYER });
}

export function rangerTargetImpaired(context: Gw2ModifierContext): boolean {
  // Defiance and modeled conditions qualify; generic disable windows are not simulated.
  if (context.config?.target?.defiant) {
    return true;
  }

  return [CONDITION.CHILLED, CONDITION.CRIPPLED, CONDITION.IMMOBILIZED, CONDITION.TAUNT, CONDITION.FEAR].some(
    (condition) => targetConditionActive(context, condition)
  );
}

/** Live combat reads the active pet; detached previews fall back to the configured first pet. */
export function activeRangerPet(context: RangerModifierContext): RangerPetDefinition {
  const state = readProfessionCoreState<RangerCoreState>(context.runtime?.profession);
  return state.petNames && state.activePetSlot
    ? rangerPetForState({ petNames: state.petNames, activePetSlot: state.activePetSlot })
    : selectedRangerPet(context.config);
}

export function activePetFamily(context: RangerModifierContext): string {
  return activeRangerPet(context).family;
}

/** Defiant targets qualify for flanking/behind bonuses because simulated golems never rotate. */
export function qualifiesForFlankingBonuses(context: Gw2ModifierContext): boolean {
  return Boolean(context.config?.target?.defiant);
}
