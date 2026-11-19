import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { timedBuffWindow } from '#gw2/platform/combat/effect-state.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { paragonCommandLifecycle } from '#gw2/professions/warrior/specializations/paragon/mechanics/command-echoes.js';
import { paragonRefrainLifecycle } from '#gw2/professions/warrior/specializations/paragon/mechanics/refrains.js';
import { paragonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Refrain entry and command completion retain independent owners and their original runtime boundaries. */
export const paragonHooks = composeRuntimeHooks<WarriorRuntimeState, WarriorSkill>([
  paragonRefrainLifecycle,
  paragonCommandLifecycle,
  {
    // Strengthening Stanzas follows Chant of Action until it ends or another refrain replaces it.
    observeEffects: (runtime) => [
      timedBuffWindow(
        'chant-of-action',
        hasTrait(runtime, TRAIT.STRENGTHENING_STANZAS) ? 'Chant of Action (Strengthening Stanzas)' : 'Chant of Action',
        paragonState.from(runtime.profession).activeRefrainId === ID.CHANT_OF_ACTION ? Infinity : 0
      )
    ]
  }
]);
