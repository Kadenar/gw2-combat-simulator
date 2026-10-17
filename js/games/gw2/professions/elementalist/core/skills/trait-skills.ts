import { ACTOR, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
/**
 * Owns the patchable skills invoked by Evasive Arcana.
 * The trait selects the attunement; each skill owns its payload and recharge.
 */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Proc ownership preserves trait recharge across rotation resets and excludes these skills from ordinary selection. */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_TRAIT_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.FLAME_BURST_TRAIT]: {
    name: 'Flame Burst (trait)',
    type: 'Proc',
    slot: 'Action',
    categories: ['Trait'],
    castTimeMs: 0,
    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: 'Trait',

    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', weaponStrengthProfileId: 'nonweapon.unequipped', coefficient: 1 },
      { type: 'condition', actorType: ACTOR.PLAYER, condition: CONDITION.BURNING, stacks: 3, duration: 6, metadata: {} }
    ])
  },
  [ID.CLEANSING_WAVE_TRAIT]: {
    name: 'Cleansing Wave (trait)',
    type: 'Proc',
    slot: 'Action',
    categories: ['Trait'],
    castTimeMs: 0,
    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: 'Trait',

    effects: []
  },
  [ID.BLINDING_FLASH_TRAIT]: {
    name: 'Blinding Flash (trait)',
    type: 'Proc',
    slot: 'Action',
    categories: ['Trait'],
    castTimeMs: 0,
    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: 'Trait',

    effects: [
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5,
        atMs: 0,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.SHOCK_WAVE_TRAIT]: {
    name: 'Shock Wave (trait)',
    type: 'Proc',
    slot: 'Action',
    categories: ['Trait'],
    castTimeMs: 0,
    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: 'Trait',

    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        weaponStrengthProfileId: 'nonweapon.unequipped',
        coefficient: 0.5,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        actorType: ACTOR.PLAYER,
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 20,
        metadata: {}
      },
      {
        type: 'condition',
        actorType: ACTOR.PLAYER,
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2,
        metadata: {}
      }
    ])
  }
});
