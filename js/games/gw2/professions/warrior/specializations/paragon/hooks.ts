import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { paragonCommandLifecycle } from '#gw2/professions/warrior/specializations/paragon/mechanics/command-echoes.js';
import { paragonRefrainLifecycle } from '#gw2/professions/warrior/specializations/paragon/mechanics/refrains.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Refrain entry and command completion retain independent owners and their original runtime boundaries. */
export const paragonHooks = composeRuntimeHooks<WarriorRuntimeState, WarriorSkill>([
  paragonRefrainLifecycle,
  paragonCommandLifecycle
]);
