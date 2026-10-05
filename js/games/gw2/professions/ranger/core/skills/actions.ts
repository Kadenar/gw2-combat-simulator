import type { RangerRuntime } from '#gw2/professions/ranger/types.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import { handleRangerPetSwapped } from '#gw2/professions/ranger/core/mechanics/event-handlers.js';
import { rangerPetCompanionId, resetRangerPet } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import { createDodgeSkill, createWeaponSwapSkill } from '#gw2/platform/skills/shared-actions.js';

/**
 * Owns synthetic Core Ranger actions that do not come from the GW2 skill catalog.
 * Runtime behavior remains in the named execution and mechanic owners.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';

export const RANGER_CORE_ACTION_SKILLS: readonly Skill[] = Object.freeze([
  createDodgeSkill({
    rechargeAnchor: 'castStart',
    cost: { resource: 'endurance', profileAmount: { profileId: PROFILE.resources, field: 'resourceCost' } }
  }),
  {
    id: ID.PET_SWAP,
    name: 'Swap Pets',
    description: 'Swap your active pet and trigger pet-swap traits.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
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
  const outgoingCompanionId = rangerPetCompanionId(runtime);
  // Pet lifetime cancellation also covers launched packets; registered fields have independent lifetimes.
  runtime.cancelOwner({ id: outgoingCompanionId, generation: 0 });
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'marker',
      action: 'companion-retired',
      at: runtime.time,
      source: 'ranger',
      sourceId: skill.id,
      actorType: 'player',
      summonOwner: outgoingCompanionId
    }
  });
  const slot = state.activePetSlot === 1 ? 2 : 1;
  const pet = rangerPetByName(state.petNames[slot - 1]);
  handleRangerPetSwapped(
    runtime,
    buildRangerPacket({ at: runtime.time, activePet: pet.name, activePetSlot: slot }, 'ranger.pet-swapped')
  );
  state.petSwapCount += 1;
  state.petAutoActivationCounts[slot - 1] += 1;
  state.petAutoActivationUses = {};
  state.petAutoOpeningBasic = state.petAutoActivationCounts[slot - 1] === 1;
  resetRangerPet(runtime);
  runtime.effects.emit({
    kind: 'packet',
    event: buildRangerPacket(
      {
        at: runtime.time,
        skillId: skill.id,
        skillName: skill.name,
        activePet: pet.name,
        activePetSlot: slot,
        generation: state.petAutoGeneration
      },
      'ranger.pet-swapped'
    )
  });
}
