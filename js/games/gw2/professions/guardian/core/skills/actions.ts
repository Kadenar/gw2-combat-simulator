/**
 * Owns synthetic Core Guardian actions that do not come from the GW2 skill catalog.
 * Runtime behavior remains with the platform weapon-swap handler.
 */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Supplies the frozen synthetic-action catalog to Core module composition. */
export const GUARDIAN_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  Object.freeze({
    id: ID.SWAP_WEAPONS,
    name: 'Swap Weapons',
    icon: '',
    type: 'Action',
    slot: 'Action',
    weapon: '',
    specialization: undefined,
    categories: [],

    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null,
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 10,
    // Custom: Performs the shared weapon-set transition; see `platform/equipment/weapons/swap.ts`.
    inputCategory: 'weapon-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'guardian.weapon-swap',
    effects: []
  })
]);
