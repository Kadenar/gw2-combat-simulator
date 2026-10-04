import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { DamageCalculationError } from '#gw2/platform/skill-damage/execution.js';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { photonForgeHooks } from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge.js';
import {
  holosmithSlotEventHandlers,
  prepareHolosmithSlotEvent
} from '#gw2/professions/engineer/specializations/holosmith/skills/slot-skills.js';
import {
  holosmithSwordEventHandlers,
  prepareHolosmithSwordEvent
} from '#gw2/professions/engineer/specializations/holosmith/skills/weapons/sword.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import type { HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';
import type { EngineerRuntimeState } from '#gw2/professions/engineer/types.js';

/** Heat pulses execute during the cast; committed pulses may survive its animation or a later Forge exit. */
export const holosmithHooks: Partial<RuntimeProfession<EngineerRuntimeState, HolosmithSkill>> = composeRuntimeHooks([
  photonForgeHooks,
  {
    /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
    prepareDamageState(runtime, skill, inputs) {
      const state = holosmithState.from(runtime);
      state.photonForgeActive = Boolean(skill?.forgeSkill);
      const charges = Number(inputs.lensCharges ?? 0);
      const profile = requireBalanceProfileFromContext(runtime, TRAIT.SOLAR_FOCUSING_LENS);
      if (!Number.isInteger(charges) || charges > balanceProfileNumber(profile, 'maximumStacks'))
        throw new DamageCalculationError('missing-input', 'Choose a valid Solar Focusing Lens charge count.');
      state.solarFocusingLens = grantCharges(charges, balanceProfileNumber(profile, 'durationMultiplier'));
    },

    prepareEvent: (runtime, event) => prepareHolosmithSwordEvent(runtime, prepareHolosmithSlotEvent(runtime, event)),

    eventHandlers: {
      ...holosmithSlotEventHandlers,
      ...holosmithSwordEventHandlers
    }
  }
]);
