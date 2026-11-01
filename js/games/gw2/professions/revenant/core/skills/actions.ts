/**
 * Owns simulator-only Core Revenant action declarations.
 * Their runtime behavior is registered through `core/hooks.ts`.
 */
import { createDodgeSkill, createWeaponSwapSkill } from '#gw2/platform/skills/shared-actions.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { battleScarsSkill } from '#gw2/professions/revenant/core/skills/battle-scars.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';

const actions: readonly Skill[] = [
  battleScarsSkill,
  createWeaponSwapSkill(),
  {
    name: 'Swap Legends',
    // Count the explicit bar-changing input in effort summaries.
    description: 'Invoke the other selected legend and reset energy.',
    icon: 'https://render.guildwars2.com/file/67CDD35F6BC3072E0837715A5E0A90646529BAA2/1030005.png',
    id: ID.SWAP_LEGENDS,
    // Custom: Switches legends and resets energy through `core/hooks.ts`.
    inputCategory: 'bar-swap',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 10,
    // Invoking a legend always has a 10 second recharge; Alacrity does not shorten it.
    rechargeIgnoresAlacrity: true,
    resourceGain: 50,
    castTimeMs: 0,
    effects: [],
    // Complete the legend transition before cast traits and elite observers.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.swap-legends' } }]
  },
  // Core owns the input and its cost; active specialization hooks supply any dodge replacement.
  createDodgeSkill({
    description: 'Perform the selected dodge.',
    castTimeMs: 0
  })
];

export const REVENANT_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze(actions.map((skill) => Object.freeze(skill)));
