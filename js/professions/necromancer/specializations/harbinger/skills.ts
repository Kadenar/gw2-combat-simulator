/**
 * Harbinger skill mechanics owned by the Harbinger Necromancer module.
 *
 * The root catalog composes this inert fragment with the other active module
 * fragments. Weapon skills remain Core-owned because Weaponmaster Training
 * makes elite weapon families profession-wide.
 */
import { NECROMANCER_SKILL_IDS as ID } from "../../data/ids.js";
import type { SkillFragment } from "../../../../platform/engine/types.js";

export const HARBINGER_BASE_SKILL_MECHANICS: Readonly<
  Record<number, SkillFragment>
> = Object.freeze({
  [ID.ELIXIR_OF_BLISS]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
    handlerId: "necromancer.elixir",
  },
  [ID.ELIXIR_OF_RISK]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
    cooldown: 20,
    handlerId: "necromancer.elixir",
  },
  [ID.VORACIOUS_ARC]: {
    implemented: true,
    castTimeMs: 750,
    effects: [],
    type: "Profession",
    slot: "Weapon_4",
    shroud: "harbinger",
    shroudSlot: 4,
    specialization: "Harbinger",
    handlerId: "necromancer.blight-skill",
  },
  [ID.EXIT_HARBINGER_SHROUD]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    cooldown: 0,
    specialization: "Harbinger",
    handlerId: "necromancer.shroud",
  },
  [ID.VITAL_DRAW]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: "strike",
        ticks: [
          { atMs: 760, coefficient: 0.4 },
          { atMs: 1760, coefficient: 0.4 },
          { atMs: 2760, coefficient: 0.4 },
        ],
        timingAnchor: "castStart",
        timingScale: "fixed",
        metadata: {
          extendsResolutionHorizon: true,
        },
      },
      {
        type: "control",
        applications: 3,
        atMs: 760,
        intervalMs: 1000,
        timingAnchor: "castStart",
        timingScale: "fixed",
        metadata: {
          controlKind: "float",
          duration: 1,
        },
      },
    ],
    lifeForceGain: 3,
    type: "Profession",
    slot: "Weapon_5",
    shroud: "harbinger",
    shroudSlot: 5,
    specialization: "Harbinger",
  },
  [ID.HARBINGER_SHROUD]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    cooldown: 10,
    specialization: "Harbinger",
    handlerId: "necromancer.shroud",
  },
  [ID.TAINTED_BOLTS]: {
    implemented: true,
    dhuumfireDuration: 1,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        ticks: [
          { atMs: 320, coefficient: 0.6 },
          { atMs: 600, coefficient: 0.6 },
        ],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 320,
            condition: "Torment",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 600,
            condition: "Torment",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    type: "Profession",
    slot: "Weapon_1",
    shroud: "harbinger",
    shroudSlot: 1,
    specialization: "Harbinger",
  },
  [ID.DARK_BARRAGE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        ticks: [
          { atMs: 600, coefficient: 0.6 },
          { atMs: 680, coefficient: 0.6 },
          { atMs: 680, coefficient: 0.6 },
          { atMs: 800, coefficient: 0.6 },
          { atMs: 800, coefficient: 0.6 },
          { atMs: 800, coefficient: 0.6 },
        ],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        ticks: [
          { atMs: 600, condition: "Torment", stacks: 1, duration: 3 },
          { atMs: 680, condition: "Torment", stacks: 1, duration: 3 },
          { atMs: 680, condition: "Torment", stacks: 1, duration: 3 },
          { atMs: 800, condition: "Torment", stacks: 1, duration: 3 },
          { atMs: 800, condition: "Torment", stacks: 1, duration: 3 },
          { atMs: 800, condition: "Torment", stacks: 1, duration: 3 },
        ],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    type: "Profession",
    slot: "Weapon_2",
    shroud: "harbinger",
    shroudSlot: 2,
    specialization: "Harbinger",
    handlerId: "necromancer.dark-barrage",
  },
  [ID.ELIXIR_OF_IGNORANCE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
    handlerId: "necromancer.elixir",
  },
  [ID.ELIXIR_OF_AMBITION]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
    handlerId: "necromancer.elixir",
  },
  [ID.ELIXIR_OF_ANGUISH]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
    handlerId: "necromancer.elixir",
  },
  [ID.ELIXIR_OF_PROMISE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
    handlerId: "necromancer.elixir",
  },
  [ID.DEVOURING_CUT]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
    type: "Profession",
    slot: "Weapon_3",
    shroud: "harbinger",
    shroudSlot: 3,
    specialization: "Harbinger",
    handlerId: "necromancer.blight-skill",
  },
});

export const HARBINGER_QUICKNESS_CAST_TIMES_MS: Readonly<
  Record<string, number>
> = Object.freeze({
  [ID.ELIXIR_OF_PROMISE]: 680,
  [ID.ELIXIR_OF_ANGUISH]: 680,
  [ID.DARK_BARRAGE]: 920,
  [ID.VORACIOUS_ARC]: 840,
  [ID.DEVOURING_CUT]: 480,
  [ID.TAINTED_BOLTS]: 600,
  [ID.ELIXIR_OF_RISK]: 540,
  [ID.VITAL_DRAW]: 800,
  [ID.ELIXIR_OF_AMBITION]: 680,
});
