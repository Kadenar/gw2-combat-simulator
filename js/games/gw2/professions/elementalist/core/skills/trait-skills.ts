/**
 * Owns the patchable skills invoked by Evasive Arcana.
 * The trait selects the attunement; each skill owns its payload and recharge.
 */
import { ACTOR, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/** Proc ownership preserves trait recharge across rotation resets and excludes these skills from ordinary selection. */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_TRAIT_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.FLAME_BURST_TRAIT]: {
    name: 'Flame Burst (trait)',
    description: 'Burn foes at the target location.',
    icon: 'https://render.guildwars2.com/file/610424237E18EA90F0D824454104355309FF5DDA/102959.png',
    type: 'Proc',
    slot: 'Action',

    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: 'Trait',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', weaponStrengthProfileId: 'nonweapon.unequipped', coefficient: 1 },
      { type: 'condition', actorType: ACTOR.PLAYER, condition: CONDITION.BURNING, stacks: 3, duration: 6 }
    ])
  },
  [ID.CLEANSING_WAVE_TRAIT]: {
    name: 'Cleansing Wave (trait)',
    description: 'Heal yourself and nearby allies, curing conditions.',
    icon: 'https://render.guildwars2.com/file/180D2C7CDB69E301401509737CEC35F90D57E358/102819.png',
    type: 'Proc',
    slot: 'Action',

    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: 'Trait',
    castTimeMs: 0,
    effects: []
  },
  [ID.BLINDING_FLASH_TRAIT]: {
    name: 'Blinding Flash (trait)',
    description: 'Blind your foes with a flash of light. Vulnerable foes are also weakened.',
    icon: 'https://render.guildwars2.com/file/A9B10F55FF0922633B0CCC3C42AB7C093372A8E2/102831.png',
    type: 'Proc',
    slot: 'Action',

    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: 'Trait',
    castTimeMs: 0,
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
    description: 'Create a shock wave that bleeds and immobilizes your target.',
    icon: 'https://render.guildwars2.com/file/69CFF22DD8599E35164720AC02A5F2044C33C7DD/103136.png',
    type: 'Proc',
    slot: 'Action',

    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: 'Trait',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        weaponStrengthProfileId: 'nonweapon.unequipped',
        coefficient: 0.5,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      {
        type: 'condition',
        actorType: ACTOR.PLAYER,
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 20
      },
      {
        type: 'condition',
        actorType: ACTOR.PLAYER,
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2
      }
    ])
  }
});
