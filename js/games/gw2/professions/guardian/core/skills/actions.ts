import { createWeaponSwapSkill } from '#gw2/platform/skills/shared-actions.js';

/**
 * Owns synthetic Core Guardian actions that do not come from the GW2 skill catalog.
 * Runtime behavior remains with the platform weapon-swap handler.
 */

import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Supplies the frozen synthetic-action catalog to Core module composition. */
export const GUARDIAN_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([Object.freeze(createWeaponSwapSkill())]);
