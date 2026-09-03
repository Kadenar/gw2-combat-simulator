/**
 * Ritualist skill mechanics owned by the Ritualist Necromancer module.
 *
 * The root catalog composes this inert fragment with the other active module
 * fragments. Weapon skills remain Core-owned because Weaponmaster Training
 * makes elite weapon families profession-wide.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';

export const RITUALIST_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.INNERVATE_PRESERVATION]: {
    castTimeMs: 0,
    effects: [],
    usableInShroud: true,
    // Custom: Emits party Aegis, Resistance, and Stability, then restores life force; see `ritualist/mechanics/spirits.ts`.
    handlerId: 'necromancer.innervate'
  },
  [ID.SUMMON_SPIRITS]: {
    castTimeMs: 0,
    effects: [],
    type: 'Profession',
    slot: 'Weapon_5',
    shroud: 'ritualist',
    shroudSlot: 5,
    specialization: 'Ritualist',
    // Custom: Commands each available spirit's coordinated attack and updates its busy state; see `ritualist/mechanics/spirits.ts`.
    handlerId: 'necromancer.ritualist'
  },
  [ID.PRESERVATION]: {
    quicknessCastTimeMs: 480,
    effects: [],
    type: 'Profession',
    slot: 'Weapon_4',
    shroud: 'ritualist',
    shroudSlot: 4,
    specialization: 'Ritualist',
    // Custom: Summons Preservation, grants party Protection/Vigor, and schedules autoattacks; see `ritualist/mechanics/spirits.ts`.
    handlerId: 'necromancer.ritualist'
  },
  [ID.INNERVATE_WANDERLUST]: {
    castTimeMs: 0,
    effects: [],
    usableInShroud: true,
    // Custom: Emits Wanderlust's Fear, then restores life force; see `ritualist/mechanics/spirits.ts`.
    handlerId: 'necromancer.innervate'
  },
  [ID.NIGHTMARE_WEAPON]: {
    quicknessCastTimeMs: 240,
    effects: [
      {
        type: 'buff',
        kind: 'nightmare-weapon',
        duration: 10,
        stacks: 5,
        allyStacks: 3,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ],
    // Custom: Snapshots recipient charges and schedules weapon-spell procs; see `ritualist/execution/weapon-spells.ts`.
    handlerId: 'necromancer.weapon-spell'
  },
  [ID.WEAPON_OF_WARDING]: {
    castTimeMs: 500,
    effects: [
      {
        type: 'control',
        controlKind: 'control'
      }
    ]
  },
  [ID.ANGUISH]: {
    quicknessCastTimeMs: 560,
    effects: [],
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'ritualist',
    shroudSlot: 2,
    specialization: 'Ritualist',
    // Custom: Summons Anguish, emits its opening barrage, tracks its busy window, and schedules autoattacks; see `ritualist/mechanics/spirits.ts`.
    handlerId: 'necromancer.ritualist'
  },
  [ID.EXIT_RITUALISTS_SHROUD]: {
    castTimeMs: 0,
    effects: [],
    cooldown: 0,
    specialization: 'Ritualist',
    shroudExit: 'ritualist',
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/shroud.ts`.
    handlerId: 'necromancer.shroud'
  },
  [ID.XINRAES_WEAPON]: {
    castTimeMs: 1000,
    effects: [
      {
        type: 'control',
        controlKind: 'control'
      }
    ]
  },
  [ID.WANDERLUST]: {
    quicknessCastTimeMs: 760,
    effects: [],
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'ritualist',
    shroudSlot: 3,
    specialization: 'Ritualist',
    // Custom: Summons Wanderlust, emits its opening/lingering sequence, and schedules autoattacks; see `ritualist/mechanics/spirits.ts`.
    handlerId: 'necromancer.ritualist'
  },
  [ID.SPLINTER_WEAPON]: {
    quicknessCastTimeMs: 240,
    effects: [
      {
        type: 'buff',
        kind: 'splinter-weapon',
        duration: 10,
        stacks: 5,
        allyStacks: 3,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ],
    // Custom: Snapshots recipient charges and schedules weapon-spell procs; see `ritualist/execution/weapon-spells.ts`.
    handlerId: 'necromancer.weapon-spell'
  },
  [ID.INNERVATE_ANGUISH]: {
    castTimeMs: 0,
    effects: [
      { type: 'strike', coefficient: 1.3, hits: 1 },
      { type: 'boon', boon: 'might', duration: 10, stacks: 8 },
      { type: 'boon', boon: 'fury', duration: 5, stacks: 1 }
    ],
    usableInShroud: true,
    // Custom: Emits Anguish's strike and party Might/Fury, then restores life force; see `ritualist/mechanics/spirits.ts`.
    handlerId: 'necromancer.innervate'
  },
  [ID.WEAPON_OF_REMEDY]: {
    castTimeMs: 500,
    effects: []
  },
  [ID.ESSENCE_BLAST]: {
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
    // Custom: Emits the equipped-weapon strike with damage scaled by active spirits; see `ritualist/mechanics/spirits.ts`.
    handlerId: 'necromancer.ritualist'
  },
  [ID.RITUALISTS_SHROUD]: {
    castTimeMs: 0,
    effects: [],
    cooldown: 10,
    specialization: 'Ritualist',
    shroudEntry: 'ritualist',
    shroudProfileId: PROFILE.resources,
    minimumShroudLifeForcePercent: 10,
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/shroud.ts`.
    handlerId: 'necromancer.shroud'
  },
  [ID.RESILIENT_WEAPON]: {
    castTimeMs: 1000,
    effects: [
      {
        type: 'buff',
        kind: 'resilient-weapon',
        duration: 10,
        stacks: 5,
        allyStacks: 3,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ],
    // Custom: Snapshots recipient charges and schedules weapon-spell procs; see `ritualist/execution/weapon-spells.ts`.
    handlerId: 'necromancer.weapon-spell'
  }
});
