/**
 * Ritualist skill mechanics owned by the Ritualist Necromancer module.
 *
 * The root catalog composes this inert fragment with the other active module
 * fragments. Weapon skills remain Core-owned because Weaponmaster Training
 * makes elite weapon families profession-wide.
 */
import { NECROMANCER_SKILL_IDS as ID } from '../../data/ids.js';
import type { SkillFragment } from '../../../../platform/engine/types.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

export const RITUALIST_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.INNERVATE_PRESERVATION]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    usableInShroud: true,
    handlerId: 'necromancer.innervate'
  },
  [ID.SUMMON_SPIRITS]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    type: 'Profession',
    slot: 'Weapon_5',
    shroud: 'ritualist',
    shroudSlot: 5,
    specialization: 'Ritualist',
    handlerId: 'necromancer.ritualist'
  },
  [ID.PRESERVATION]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [],
    type: 'Profession',
    slot: 'Weapon_4',
    shroud: 'ritualist',
    shroudSlot: 4,
    specialization: 'Ritualist',
    handlerId: 'necromancer.ritualist'
  },
  [ID.INNERVATE_WANDERLUST]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    usableInShroud: true,
    handlerId: 'necromancer.innervate'
  },
  [ID.NIGHTMARE_WEAPON]: {
    implemented: true,
    quicknessCastTimeMs: 240,
    effects: [
      {
        type: 'buff',
        kind: 'nightmare-weapon',
        duration: 10,
        stacks: 5,
        allyStacks: 3,
        maximumRecipients: 5
      }
    ],
    handlerId: 'necromancer.weapon-spell'
  },
  [ID.WEAPON_OF_WARDING]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
  },
  [ID.ANGUISH]: {
    implemented: true,
    quicknessCastTimeMs: 560,
    effects: [],
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'ritualist',
    shroudSlot: 2,
    specialization: 'Ritualist',
    handlerId: 'necromancer.ritualist'
  },
  [ID.EXIT_RITUALISTS_SHROUD]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    cooldown: 0,
    specialization: 'Ritualist',
    shroudExit: 'ritualist',
    handlerId: 'necromancer.shroud'
  },
  [ID.XINRAES_WEAPON]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
  },
  [ID.WANDERLUST]: {
    implemented: true,
    quicknessCastTimeMs: 760,
    effects: [],
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'ritualist',
    shroudSlot: 3,
    specialization: 'Ritualist',
    handlerId: 'necromancer.ritualist'
  },
  [ID.SPLINTER_WEAPON]: {
    implemented: true,
    quicknessCastTimeMs: 240,
    effects: [
      {
        type: 'buff',
        kind: 'splinter-weapon',
        duration: 10,
        stacks: 5,
        allyStacks: 3,
        maximumRecipients: 5
      }
    ],
    handlerId: 'necromancer.weapon-spell'
  },
  [ID.INNERVATE_ANGUISH]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      { type: 'strike', coefficient: 1.3, hits: 1 },
      { type: 'boon', boon: 'might', duration: 10, stacks: 8 },
      { type: 'boon', boon: 'fury', duration: 5, stacks: 1 }
    ],
    usableInShroud: true,
    handlerId: 'necromancer.innervate'
  },
  [ID.WEAPON_OF_REMEDY]: {
    implemented: true,
    castTimeMs: 500,
    effects: []
  },
  [ID.ESSENCE_BLAST]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        damageIncreasePerStack: 0.15
      }
    ],
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'ritualist',
    shroudSlot: 1,
    specialization: 'Ritualist',
    handlerId: 'necromancer.ritualist'
  },
  [ID.RITUALISTS_SHROUD]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    cooldown: 10,
    specialization: 'Ritualist',
    shroudEntry: 'ritualist',
    shroudProfileId: PROFILE.resources,
    minimumShroudLifeForcePercent: 10,
    handlerId: 'necromancer.shroud'
  },
  [ID.RESILIENT_WEAPON]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: 'buff',
        kind: 'resilient-weapon',
        duration: 10,
        stacks: 5,
        allyStacks: 3,
        maximumRecipients: 5
      }
    ],
    handlerId: 'necromancer.weapon-spell'
  }
});
