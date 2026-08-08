/**
 * Raw Virtuoso skill mechanics. Generated once from the characterized
 * pre-migration table; this file is now the runtime source owner.
 */
import { MESMER_SKILL_IDS as ID } from "../../data/ids.js";
import type {
  Skill,
  SkillFragment,
  SkillId,
} from "../../../../platform/engine/types.js";
import type { MesmerSkill } from "../../types.js";

export const MESMER_VIRTUOSO_SKILL_MECHANICS: Readonly<
  Record<SkillId, SkillFragment>
> = Object.freeze({
  [ID.THOUSAND_CUTS]: {
    implemented: true,
    type: "Elite",
    weapon: "",
    specialization: "Virtuoso",
    environment: "Terrestrial",
    castTimeMs: 0,
    cooldown: 60,
    phantasm: false,
    resource: null,
    blade: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 0,
            coefficient: 0.5,
          },
          {
            atMs: 517,
            coefficient: 0.5,
          },
          {
            atMs: 1033,
            coefficient: 0.5,
          },
          {
            atMs: 1550,
            coefficient: 0.5,
          },
          {
            atMs: 2067,
            coefficient: 0.5,
          },
          {
            atMs: 2600,
            coefficient: 0.5,
          },
          {
            atMs: 3117,
            coefficient: 0.5,
          },
          {
            atMs: 3633,
            coefficient: 0.5,
          },
          {
            atMs: 4150,
            coefficient: 0.5,
          },
          {
            atMs: 4667,
            coefficient: 0.5,
          },
        ],
        name: "Damage",
        actorType: "player",
        weapon: "unequipped",
        timingAnchor: "castEnd",
        timingScale: "fixed",
      },
    ],
  },
  [ID.SWORD_OF_DECIMATION]: {
    implemented: true,
    type: "Utility",
    weapon: "",
    specialization: "Virtuoso",
    environment: "Terrestrial",
    castTimeMs: 500,
    quicknessCastTimeMs: 333.333333333,
    cooldown: 25,
    phantasm: false,
    resource: null,
    blade: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
        name: "Damage",
        actorType: "player",
        weapon: "utility",
      },
    ],
  },
  [ID.BLADE_RENEWAL]: {
    implemented: true,
    type: "Utility",
    weapon: "",
    specialization: "Virtuoso",
    environment: "Terrestrial",
    castTimeMs: 2000,
    quicknessCastTimeMs: 1333.333333333,
    cooldown: 35,
    phantasm: false,
    resource: {
      mode: "fill",
      count: 5,
    },
    blade: true,
    effects: [],
  },
  [ID.RAIN_OF_SWORDS]: {
    implemented: true,
    type: "Utility",
    weapon: "",
    specialization: "Virtuoso",
    environment: "Terrestrial",
    castTimeMs: 1020,
    cooldown: 25,
    phantasm: false,
    resource: null,
    blade: true,
    effects: [
      {
        type: "strike",
        coefficient: 6,
        hits: 5,
        name: "Damage",
        actorType: "player",
        weapon: "utility",
      },
    ],
  },
  [ID.TWIN_BLADE_RESTORATION]: {
    implemented: true,
    type: "Heal",
    weapon: "",
    specialization: "Virtuoso",
    environment: "Terrestrial",
    castTimeMs: 1000,
    quicknessCastTimeMs: 666.666666667,
    cooldown: 20,
    phantasm: false,
    resource: null,
    blade: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.7,
        hits: 2,
        name: "Damage",
        actorType: "player",
        weapon: "unequipped",
      },
    ],
  },
  [ID.PSYCHIC_FORCE]: {
    implemented: true,
    type: "Utility",
    weapon: "",
    specialization: "Virtuoso",
    environment: "Terrestrial",
    castTimeMs: 500,
    quicknessCastTimeMs: 333.333333333,
    cooldown: 3,
    phantasm: false,
    resource: null,
    blade: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
        name: "Damage",
        actorType: "player",
        weapon: "utility",
      },
    ],
  },
  [ID.BLADETURN_REQUIEM]: {
    implemented: true,
    type: "Profession",
    weapon: "",
    specialization: "Virtuoso",
    environment: "Terrestrial",
    castTimeMs: 0,
    lockouts: [
      {
        group: "mesmer.shatter",
        durationMs: 50,
      },
    ],
    cooldown: 30,
    phantasm: false,
    resource: null,
    blade: true,
    effects: [],
  },
  [ID.BLADESONG_DISSONANCE]: {
    implemented: true,
    type: "Profession",
    weapon: "",
    specialization: "Virtuoso",
    environment: "Terrestrial",
    castTimeMs: 720,
    lockouts: [
      {
        group: "mesmer.shatter",
        durationMs: 50,
      },
    ],
    cooldown: 30,
    phantasm: false,
    resource: null,
    blade: true,
    effects: [],
  },
  [ID.BLADESONG_SORROW]: {
    implemented: true,
    type: "Profession",
    weapon: "",
    specialization: "Virtuoso",
    environment: "Terrestrial",
    castTimeMs: 720,
    lockouts: [
      {
        group: "mesmer.shatter",
        durationMs: 50,
      },
    ],
    cooldown: 20,
    phantasm: false,
    resource: null,
    blade: true,
    effects: [],
  },
  [ID.BLADESONG_HARMONY]: {
    implemented: true,
    type: "Profession",
    weapon: "",
    specialization: "Virtuoso",
    environment: "Terrestrial",
    castTimeMs: 960,
    lockouts: [
      {
        group: "mesmer.shatter",
        durationMs: 50,
      },
    ],
    cooldown: 12,
    phantasm: false,
    resource: null,
    blade: true,
    effects: [],
  },
  [ID.BLADESONG_DISTORTION]: {
    implemented: true,
    type: "Profession",
    weapon: "",
    specialization: "Virtuoso",
    environment: "Terrestrial",
    castTimeMs: 0,
    lockouts: [
      {
        group: "mesmer.shatter",
        durationMs: 50,
      },
    ],
    rechargeAnchor: "castStart",
    cooldown: 50,
    phantasm: false,
    resource: null,
    blade: true,
    effects: [],
  },
});

export const MESMER_VIRTUOSO_SUPPLEMENTAL_SKILL_MECHANICS: Readonly<
  Record<SkillId, SkillFragment>
> = Object.freeze({});

export const MESMER_VIRTUOSO_EXTRA_SKILLS: readonly Skill[] = Object.freeze(
  [] satisfies readonly MesmerSkill[],
);
