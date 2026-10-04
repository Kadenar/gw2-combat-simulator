import { createWeaponSwapSkill, createDodgeSkill } from '#gw2/platform/skills/shared-actions.js';

/**
 * Owns simulator-only Core Revenant action declarations.
 * Their runtime behavior is registered through `core/hooks.ts`.
 */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

const actions: readonly Skill[] = [
  createWeaponSwapSkill(),
  {
    id: ID.SWAP_LEGENDS,
    // Complete the legend transition before cast traits and elite observers.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.swap-legends' } }],
    // Custom: Switches legends and resets energy through `core/hooks.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    name: 'Swap Legends',
    description: 'Invoke the other selected legend and reset energy.',
    icon: '',
    type: 'Profession',
    slot: 'Profession_1',
    castTimeMs: 0,
    cooldown: 10,
    // Invoking a legend always has a 10 second recharge; Alacrity does not shorten it.
    rechargeIgnoresAlacrity: true,
    resourceGain: 50,
    effects: []
  },
  {
    ...createDodgeSkill({
      description: 'Perform the selected dodge.',
      castTimeMs: 0,
      resourceCost: 50,
      cost: { resource: 'endurance' }
    }),
    // The family registers this shared action; only Vindicator supplies a landing.
    sideEffects: [
      {
        on: 'castStart',
        when: (runtime) => runtime.config.specialization === 'Vindicator',
        do: { type: 'revenant.vindicator-dodge' }
      }
    ]
  }
];

export const REVENANT_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze(actions.map((skill) => Object.freeze(skill)));
