/**
 * Ritualist skill mechanics owned by the Ritualist Necromancer module.
 *
 * The root catalog composes this inert fragment with the other active module
 * fragments. Weapon skills remain Core-owned because Weaponmaster Training
 * makes elite weapon families profession-wide.
 */
import { NECROMANCER_SKILL_IDS as ID } from "../../data/ids.js";
import type { SkillFragment } from "../../../../platform/engine/types.js";

export const RITUALIST_BASE_SKILL_MECHANICS: Readonly<
  Record<number, SkillFragment>
> = Object.freeze({
  [ID.INNERVATE_PRESERVATION]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: "necromancer.innervate",
  },
  [ID.SUMMON_SPIRITS]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    type: "Profession",
    slot: "Weapon_5",
    shroud: "ritualist",
    shroudSlot: 5,
    specialization: "Ritualist",
    handlerId: "necromancer.ritualist",
  },
  [ID.PRESERVATION]: {
    implemented: true,
    castTimeMs: 720,
    quicknessCastTimeMs: 480,
    effects: [],
    type: "Profession",
    slot: "Weapon_4",
    shroud: "ritualist",
    shroudSlot: 4,
    specialization: "Ritualist",
    handlerId: "necromancer.ritualist",
  },
  [ID.INNERVATE_WANDERLUST]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: "necromancer.innervate",
  },
  [ID.NIGHTMARE_WEAPON]: {
    implemented: true,
    castTimeMs: 360,
    quicknessCastTimeMs: 240,
    effects: [],
    handlerId: "necromancer.weapon-spell",
  },
  [ID.WEAPON_OF_WARDING]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "control",
        metadata: {
          controlKind: "control",
        },
      },
    ],
  },
  [ID.ANGUISH]: {
    implemented: true,
    castTimeMs: 840,
    quicknessCastTimeMs: 560,
    effects: [],
    type: "Profession",
    slot: "Weapon_2",
    shroud: "ritualist",
    shroudSlot: 2,
    specialization: "Ritualist",
    handlerId: "necromancer.ritualist",
  },
  [ID.EXIT_RITUALISTS_SHROUD]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    cooldown: 0,
    specialization: "Ritualist",
    handlerId: "necromancer.shroud",
  },
  [ID.XINRAES_WEAPON]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: "control",
        metadata: {
          controlKind: "control",
        },
      },
    ],
  },
  [ID.WANDERLUST]: {
    implemented: true,
    castTimeMs: 1140,
    quicknessCastTimeMs: 760,
    effects: [],
    type: "Profession",
    slot: "Weapon_3",
    shroud: "ritualist",
    shroudSlot: 3,
    specialization: "Ritualist",
    handlerId: "necromancer.ritualist",
  },
  [ID.SPLINTER_WEAPON]: {
    implemented: true,
    castTimeMs: 360,
    quicknessCastTimeMs: 240,
    effects: [],
    handlerId: "necromancer.weapon-spell",
  },
  [ID.INNERVATE_ANGUISH]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: "necromancer.innervate",
  },
  [ID.WEAPON_OF_REMEDY]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
  },
  [ID.ESSENCE_BLAST]: {
    implemented: true,
    castTimeMs: 900,
    quicknessCastTimeMs: 600,
    effects: [],
    type: "Profession",
    slot: "Weapon_1",
    shroud: "ritualist",
    shroudSlot: 1,
    specialization: "Ritualist",
    handlerId: "necromancer.ritualist",
  },
  [ID.RITUALISTS_SHROUD]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    cooldown: 10,
    specialization: "Ritualist",
    handlerId: "necromancer.shroud",
  },
  [ID.RESILIENT_WEAPON]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
    handlerId: "necromancer.weapon-spell",
  },
});
