import { createWeaponSwapSkill } from '#gw2/platform/skills/shared-actions.js';

/**
 * Owns synthetic Core Mesmer actions that do not come from the GW2 skill catalog.
 * Runtime behavior remains in the registered skill handlers.
 */

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export const MESMER_CORE_EXTRA_SKILLS: readonly MesmerSkill[] = Object.freeze([
  createWeaponSwapSkill()
] satisfies readonly MesmerSkill[]);
