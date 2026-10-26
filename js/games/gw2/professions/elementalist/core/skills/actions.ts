import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { SHARED_SKILL_IDS, WEAPON_SWAP_ICON } from '#gw2/platform/skills/shared-actions.js';
import { createDodgeSkill, createWeaponSwapSkill } from '#gw2/platform/skills/shared-actions.js';
/**
 * Owns declarative simulator-only Elementalist actions.
 * Bundle equip state remains with its persistent mechanics.
 */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Dodge is a fixed-duration rotation action; it spends endurance only once the roll commits. */
export const ELEMENTALIST_CORE_ACTION_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [SHARED_SKILL_IDS.DODGE]: createDodgeSkill({
    categories: ['Dodge'],
    cost: {
      resource: 'endurance',
      amount: ENDURANCE.dodgeCost,
      spendOn: 'castCommit'
    },
    skillFamily: 'Dodge'
  })
});

const CONJURE_ACTION_ICONS = Object.freeze({
  'Frost Bow': 'https://render.guildwars2.com/file/CC6D556B7C3F95C49E54D697CC2B4E79105DC594/103348.png',
  'Lightning Hammer': 'https://render.guildwars2.com/file/C3DA6AC980062B0A0EEA14CE51393748CFAE01CA/103369.png',
  'Fiery Greatsword': 'https://render.guildwars2.com/file/EEDA0B1847077DE93DBB0575D44BE0615FBCE728/103328.png'
});

/** Supplies bundle controls absent from the API catalog so rotations can drop and recover conjures. */
export const ELEMENTALIST_CORE_ACTION_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  createWeaponSwapSkill(),
  {
    name: '__drop_bundle',
    id: ID.DROP_BUNDLE,
    inputCategory: 'bar-swap', // Dropping a conjure is an explicit return to the equipped weapon bar.
    displayName: 'Drop Bundle',
    description: 'Drop the currently equipped conjured weapon.',
    icon: WEAPON_SWAP_ICON,
    type: 'Action',
    weapon: '',
    slot: 'Action',
    specialization: '',
    categories: ['Bundle'],
    cooldown: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null,
    simulatorExcluded: false,
    castTimeMs: 0,
    effects: [],
    // Dropping clears the equipped copy and reports one real bundle swap.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.drop-conjure' } }]
  },
  ...[
    ['Frost Bow', ID.PICK_UP_FROST_BOW],
    ['Lightning Hammer', ID.PICK_UP_LIGHTNING_HAMMER],
    ['Fiery Greatsword', ID.PICK_UP_FIERY_GREATSWORD]
  ].map(([weapon, id]): Skill => ({
    name: `__pickup_${weapon}`,
    id: Number(id),
    inputCategory: 'bar-swap',
    displayName: `Pick up ${weapon}`,
    description: `Pick up the available ${weapon}.`,
    icon: CONJURE_ACTION_ICONS[weapon as keyof typeof CONJURE_ACTION_ICONS],
    type: 'Action',
    weapon: '',
    slot: 'Action',
    specialization: '',
    categories: ['Bundle'],
    cooldown: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null,

    simulatorExcluded: false,
    castTimeMs: 300,
    effects: [],
    // Capture an available ground copy before expiry, then consume that copy only on successful commitment.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: { type: 'elementalist.capture-conjure-pickup' }
      },
      { on: 'castCommit', do: { type: 'elementalist.pick-up-conjure' } }
    ]
  }))
]);
