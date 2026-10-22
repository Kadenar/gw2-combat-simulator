import { createDodgeSkill, createWeaponSwapSkill, WEAPON_SWAP_ICON } from '#gw2/platform/skills/shared-actions.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { applyRangerPetSwap } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profile-ids.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { rangerPetByName } from '#gw2/professions/ranger/data/pets.js';
import type { RangerRuntime, RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

/**
 * Owns synthetic Core Ranger actions that do not come from the GW2 skill catalog.
 * Runtime behavior remains in the named execution and mechanic owners.
 */

export const RANGER_CORE_ACTION_SKILLS: readonly Skill[] = Object.freeze([
  createDodgeSkill({
    // A late-cancelled dodge commits while keeping the rest of its animation reserved.
    interruptCommitMs: 760,
    retainsCastLockoutAfterInterrupt: true,
    rechargeAnchor: 'castStart',
    cost: { resource: 'endurance', profileAmount: { profileId: PROFILE.resources, field: 'resourceCost' } }
  }),
  {
    id: ID.PET_SWAP,
    name: 'Swap Pets',
    // Pet swapping occupies the fourth profession control on the active pet bar.
    inputControl: 'profession-4',
    description: 'Swap your active pet and trigger pet-swap traits.',
    icon: WEAPON_SWAP_ICON,
    type: 'Action',
    weapon: '',
    slot: 'Action',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 20,
    // Publish the new pet generation before shared pet-swap observers execute.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.swap-pets' } }],

    effects: []
  },
  createWeaponSwapSkill()
]);

/** Record outgoing retirement, then publish the swap after the incoming generation is ready. */
export function swapRangerPets(runtime: RangerRuntime, skill: Skill): void {
  const state = runtime.profession.core;
  const slot = state.activePetSlot === 1 ? 2 : 1;
  const pet = rangerPetByName(state.petNames[slot - 1]);
  applyRangerPetSwap(runtime, pet, slot);
  runtime.effects.emit({
    kind: 'packet',
    event: buildRangerPacket(
      {
        at: runtime.time,
        skillId: skill.id,
        skillName: skill.name,
        activePet: pet.name,
        activePetSlot: slot,
        companionId: state.pet!.id
      },
      'ranger.pet-swapped'
    )
  });
}

/** Publish the new pet generation at the swap's commit boundary, before shared pet-swap observers execute. */
export const petSwapLifecycle = {
  sideEffectHandlers: {
    'ranger.swap-pets'(runtime, context) {
      swapRangerPets(runtime, context.skill);
    }
  }
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;
