/** Weaver Elementalist skill mechanics. */
import { ELEMENTALIST_SKILL_IDS as ID } from "../../data/ids.js";
import type { SkillFragment } from "../../../../platform/engine/types.js";

export const WEAVER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> =
  Object.freeze({
    [ID.STEAM_SURGE]: {
      name: "Steam Surge",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Dagger",
      attunement: "Fire+Water",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 560,
      cooldown: 18,
      comboFields: [
        {
          ownerId: "elementalist",
          fieldType: "Water",
          duration: 4,
          startAnchor: "castEnd",
        },
      ],
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 840,
              coefficient: 1.75,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
      ],
      specialization: "Weaver",
    },
    [ID.PLASMA_BURST]: {
      name: "Plasma Burst",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Dagger",
      attunement: "Fire+Air",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 600,
      cooldown: 15,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 720,
              coefficient: 2,
              comboFinishers: [
                {
                  ownerId: "elementalist",
                  finisherType: "Blast",
                  ambiguousFieldSelection: "oldest",
                },
              ],
              metadata: {},
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 720,
              condition: "Burning",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.ASHEN_BLAST]: {
      name: "Ashen Blast",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Dagger",
      attunement: "Fire+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 920,
      cooldown: 12,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 660,
              coefficient: 0.1,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "blind",
          atMs: 660,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "blind",
          },
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 1380,
              coefficient: 1.4,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1380,
              condition: "Burning",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.KATABATIC_WIND]: {
      name: "Katabatic Wind",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Dagger",
      attunement: "Air+Water",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 280,
      cooldown: 18,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 351,
              coefficient: 0.1,
              comboFinishers: [
                {
                  ownerId: "elementalist",
                  finisherType: "Blast",
                  ambiguousFieldSelection: "oldest",
                },
              ],
              metadata: {},
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          canCrit: true,
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 351,
              condition: "Chilled",
              stacks: 1,
              duration: 3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "boon",
          boon: "Regeneration",
          stacks: 1,
          duration: 4,
          durationScale: "boon",
          atMs: 351,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "control",
          atMs: 351,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "crowd-control",
          },
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 2271,
              coefficient: 1.25,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          canCrit: true,
        },
        {
          type: "control",
          atMs: 2271,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "crowd-control",
          },
        },
      ],
      specialization: "Weaver",
    },
    [ID.MUD_SLIDE]: {
      name: "Mud Slide",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Dagger",
      attunement: "Water+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 1000,
      cooldown: 20,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 1440,
              coefficient: 0.15,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          canCrit: true,
        },
        {
          type: "control",
          atMs: 1440,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "crowd-control",
          },
        },
      ],
      specialization: "Weaver",
    },
    [ID.GRINDING_STONES]: {
      name: "Grinding Stones",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Dagger",
      attunement: "Air+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 600,
      cooldown: 15,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 1380,
              coefficient: 0.275,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1380,
              condition: "Bleeding",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "boon",
          boon: "Stability",
          stacks: 1,
          duration: 5,
          durationScale: "boon",
          atMs: 1380,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 2160,
              coefficient: 0.275,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 2160,
              condition: "Bleeding",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 2940,
              coefficient: 0.275,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 2940,
              condition: "Bleeding",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 3720,
              coefficient: 0.275,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 3720,
              condition: "Bleeding",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 4500,
              coefficient: 0.275,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 4500,
              condition: "Bleeding",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 5280,
              coefficient: 0.275,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 5280,
              condition: "Bleeding",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.FIERY_FROST]: {
      name: "Fiery Frost",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Scepter",
      attunement: "Fire+Water",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 880,
      cooldown: 15,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 480,
              coefficient: 1.1,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 480,
              condition: "Burning",
              stacks: 1,
              duration: 4,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 480,
              condition: "Chilled",
              stacks: 1,
              duration: 3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.PLASMA_BEAM]: {
      name: "Plasma Beam",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Scepter",
      attunement: "Fire+Air",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 920,
      cooldown: 15,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 360,
              coefficient: 0.55,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 540,
              coefficient: 0.55,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 780,
              coefficient: 0.55,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 960,
              coefficient: 0.55,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 1140,
              coefficient: 0.55,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
      ],
      specialization: "Weaver",
    },
    [ID.FRACTURING_STRIKE]: {
      name: "Fracturing Strike",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Scepter",
      attunement: "Fire+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 920,
      cooldown: 12,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 360,
              coefficient: 1.2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 360,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 360,
              condition: "Vulnerability",
              stacks: 3,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 1260,
              coefficient: 1.2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1260,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1260,
              condition: "Vulnerability",
              stacks: 3,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.GLACIAL_DRIFT]: {
      name: "Glacial Drift",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Scepter",
      attunement: "Air+Water",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 560,
      cooldown: 15,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 720,
              coefficient: 2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          canCrit: true,
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 720,
              condition: "Chilled",
              stacks: 1,
              duration: 4,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "boon",
          boon: "Stability",
          stacks: 1,
          duration: 5,
          durationScale: "boon",
          atMs: 720,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "control",
          atMs: 720,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "crowd-control",
          },
        },
      ],
      specialization: "Weaver",
    },
    [ID.STONE_TIDE]: {
      name: "Stone Tide",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Scepter",
      attunement: "Water+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 600,
      cooldown: 15,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 1140,
              coefficient: 0.3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1140,
              condition: "Bleeding",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1140,
              condition: "Vulnerability",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1140,
              condition: "Cripple",
              stacks: 1,
              duration: 4,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 1560,
              coefficient: 0.3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1560,
              condition: "Bleeding",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1560,
              condition: "Vulnerability",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 1980,
              coefficient: 0.3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1980,
              condition: "Bleeding",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1980,
              condition: "Vulnerability",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 2400,
              coefficient: 0.3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 2400,
              condition: "Bleeding",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 2400,
              condition: "Vulnerability",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 2820,
              coefficient: 0.3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 2820,
              condition: "Bleeding",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 2820,
              condition: "Vulnerability",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 3240,
              coefficient: 0.3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 3240,
              condition: "Bleeding",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 3240,
              condition: "Vulnerability",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 3660,
              coefficient: 0.3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 3660,
              condition: "Bleeding",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 3660,
              condition: "Vulnerability",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 4080,
              coefficient: 0.3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 4080,
              condition: "Bleeding",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 4080,
              condition: "Vulnerability",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.EARTHEN_SYNERGY]: {
      name: "Earthen Synergy",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Scepter",
      attunement: "Air+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 560,
      cooldown: 15,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 660,
              coefficient: 1.4,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 1080,
              coefficient: 1,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          canCrit: true,
        },
        {
          type: "control",
          atMs: 1080,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "crowd-control",
          },
        },
      ],
      specialization: "Weaver",
    },
    [ID.TWIN_STRIKE]: {
      name: "Twin Strike",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Sword",
      attunement: "Fire+Water",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 640,
      cooldown: 10,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 420,
              coefficient: 1,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 420,
              condition: "Chilled",
              stacks: 1,
              duration: 3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 840,
              coefficient: 1.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 840,
              condition: "Burning",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.PYRO_VORTEX]: {
      name: "Pyro Vortex",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Sword",
      attunement: "Fire+Air",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 560,
      cooldown: 12,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 600,
              coefficient: 1,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 600,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 1140,
              coefficient: 0.33,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1140,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 1680,
              coefficient: 0.33,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1680,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 2220,
              coefficient: 0.33,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 2220,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 2760,
              coefficient: 0.33,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 2760,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 3300,
              coefficient: 0.33,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 3300,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 3840,
              coefficient: 0.33,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 3840,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 4380,
              coefficient: 0.33,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 4380,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 4920,
              coefficient: 0.33,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 4920,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.LAVA_SKIN]: {
      name: "Lava Skin",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Sword",
      attunement: "Fire+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 400,
      cooldown: 18,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 1860,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 3360,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 4860,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 6360,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 7860,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1860,
              condition: "Burning",
              stacks: 1,
              duration: 1,
            },
            {
              atMs: 3360,
              condition: "Burning",
              stacks: 1,
              duration: 1,
            },
            {
              atMs: 4860,
              condition: "Burning",
              stacks: 1,
              duration: 1,
            },
            {
              atMs: 6360,
              condition: "Burning",
              stacks: 1,
              duration: 1,
            },
            {
              atMs: 7860,
              condition: "Burning",
              stacks: 1,
              duration: 1,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.SHEARING_EDGE]: {
      name: "Shearing Edge",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Sword",
      attunement: "Air+Water",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 640,
      cooldown: 12,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 720,
              coefficient: 1.8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 720,
              condition: "Bleeding",
              stacks: 3,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 720,
              condition: "Chilled",
              stacks: 1,
              duration: 2.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.NATURAL_FRENZY]: {
      name: "Natural Frenzy",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Sword",
      attunement: "Water+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 1400,
      cooldown: 10,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 600,
              coefficient: 0.44,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 600,
              condition: "Bleeding",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 600,
              condition: "Cripple",
              stacks: 1,
              duration: 1.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 600,
              coefficient: 0.44,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 600,
              condition: "Bleeding",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 600,
              condition: "Cripple",
              stacks: 1,
              duration: 1.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 960,
              coefficient: 0.44,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 960,
              condition: "Bleeding",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 960,
              condition: "Cripple",
              stacks: 1,
              duration: 1.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 1020,
              coefficient: 0.44,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1020,
              condition: "Bleeding",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1020,
              condition: "Cripple",
              stacks: 1,
              duration: 1.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 1320,
              coefficient: 0.44,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1320,
              condition: "Bleeding",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1320,
              condition: "Cripple",
              stacks: 1,
              duration: 1.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 1320,
              coefficient: 0.44,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1320,
              condition: "Bleeding",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1320,
              condition: "Cripple",
              stacks: 1,
              duration: 1.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 1680,
              coefficient: 0.44,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1680,
              condition: "Bleeding",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1680,
              condition: "Cripple",
              stacks: 1,
              duration: 1.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 1740,
              coefficient: 0.44,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1740,
              condition: "Bleeding",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1740,
              condition: "Cripple",
              stacks: 1,
              duration: 1.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.GALE_STRIKE]: {
      name: "Gale Strike",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Sword",
      attunement: "Air+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 720,
      cooldown: 20,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 780,
              coefficient: 0.275,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          canCrit: true,
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 780,
              condition: "Bleeding",
              stacks: 1,
              duration: 5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 780,
              condition: "Vulnerability",
              stacks: 1,
              duration: 5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "control",
          atMs: 780,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "crowd-control",
          },
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 1380,
              coefficient: 0.275,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          canCrit: true,
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1380,
              condition: "Bleeding",
              stacks: 1,
              duration: 5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1380,
              condition: "Vulnerability",
              stacks: 1,
              duration: 5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "control",
          atMs: 1380,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "crowd-control",
          },
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 1980,
              coefficient: 0.275,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          canCrit: true,
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1980,
              condition: "Bleeding",
              stacks: 1,
              duration: 5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1980,
              condition: "Vulnerability",
              stacks: 1,
              duration: 5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "control",
          atMs: 1980,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "crowd-control",
          },
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 2580,
              coefficient: 0.275,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          canCrit: true,
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 2580,
              condition: "Bleeding",
              stacks: 1,
              duration: 5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 2580,
              condition: "Vulnerability",
              stacks: 1,
              duration: 5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "control",
          atMs: 2580,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "crowd-control",
          },
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 3180,
              coefficient: 0.275,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          canCrit: true,
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 3180,
              condition: "Bleeding",
              stacks: 1,
              duration: 5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 3180,
              condition: "Vulnerability",
              stacks: 1,
              duration: 5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "control",
          atMs: 3180,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "crowd-control",
          },
        },
      ],
      specialization: "Weaver",
    },
    [ID.PRESSURE_BLAST]: {
      name: "Pressure Blast",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Staff",
      attunement: "Fire+Water",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 650,
      cooldown: 15,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 900,
              coefficient: 2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "blind",
          atMs: 900,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "blind",
          },
        },
        {
          type: "boon",
          boon: "Regeneration",
          stacks: 1,
          duration: 4,
          durationScale: "boon",
          atMs: 900,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.PLASMA_BLAST]: {
      name: "Plasma Blast",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Staff",
      attunement: "Fire+Air",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 480,
      cooldown: 12,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 480,
              coefficient: 1.66,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
      ],
      specialization: "Weaver",
    },
    [ID.PYROCLASTIC_BLAST]: {
      name: "Pyroclastic Blast",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Staff",
      attunement: "Fire+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 680,
      cooldown: 15,
      comboFields: [
        {
          ownerId: "elementalist",
          fieldType: "Fire",
          duration: 4,
          startAnchor: "castEnd",
        },
      ],
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 1080,
              coefficient: 0.8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1080,
              condition: "Burning",
              stacks: 1,
              duration: 3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 2580,
              coefficient: 0.4,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 4080,
              coefficient: 0.4,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 5580,
              coefficient: 0.4,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 7080,
              coefficient: 0.4,
              metadata: {
                damageKind: "field-tick",
              },
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 2580,
              condition: "Burning",
              stacks: 1,
              duration: 1,
            },
            {
              atMs: 4080,
              condition: "Burning",
              stacks: 1,
              duration: 1,
            },
            {
              atMs: 5580,
              condition: "Burning",
              stacks: 1,
              duration: 1,
            },
            {
              atMs: 7080,
              condition: "Burning",
              stacks: 1,
              duration: 1,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.MONSOON]: {
      name: "Monsoon",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Staff",
      attunement: "Air+Water",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 640,
      cooldown: 20,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 420,
              coefficient: 0.25,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          canCrit: true,
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 420,
              condition: "Vulnerability",
              stacks: 8,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 420,
              condition: "Chilled",
              stacks: 1,
              duration: 4,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "control",
          atMs: 420,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "crowd-control",
          },
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 960,
              coefficient: 0.25,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 1500,
              coefficient: 0.25,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
      ],
      specialization: "Weaver",
    },
    [ID.LAHAR]: {
      name: "Lahar",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Staff",
      attunement: "Water+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 640,
      cooldown: 20,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 1920,
              coefficient: 0.25,
            },
            {
              atMs: 3420,
              coefficient: 0.25,
            },
            {
              atMs: 4920,
              coefficient: 0.25,
            },
            {
              atMs: 6420,
              coefficient: 0.25,
            },
            {
              atMs: 7920,
              coefficient: 0.25,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1920,
              condition: "Cripple",
              stacks: 1,
              duration: 2,
            },
            {
              atMs: 3420,
              condition: "Cripple",
              stacks: 1,
              duration: 2,
            },
            {
              atMs: 4920,
              condition: "Cripple",
              stacks: 1,
              duration: 2,
            },
            {
              atMs: 6420,
              condition: "Cripple",
              stacks: 1,
              duration: 2,
            },
            {
              atMs: 7920,
              condition: "Cripple",
              stacks: 1,
              duration: 2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1920,
              condition: "Immobilize",
              stacks: 1,
              duration: 2,
            },
            {
              atMs: 3420,
              condition: "Immobilize",
              stacks: 1,
              duration: 2,
            },
            {
              atMs: 4920,
              condition: "Immobilize",
              stacks: 1,
              duration: 2,
            },
            {
              atMs: 6420,
              condition: "Immobilize",
              stacks: 1,
              duration: 2,
            },
            {
              atMs: 7920,
              condition: "Immobilize",
              stacks: 1,
              duration: 2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.PILE_DRIVER]: {
      name: "Pile Driver",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Staff",
      attunement: "Air+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 1320,
      cooldown: 18,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 1740,
              coefficient: 2.1,
              comboFinishers: [
                {
                  ownerId: "elementalist",
                  finisherType: "Projectile",
                  ambiguousFieldSelection: "oldest",
                },
              ],
              metadata: {},
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          canCrit: true,
        },
        {
          type: "control",
          atMs: 1740,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "crowd-control",
          },
        },
      ],
      specialization: "Weaver",
    },
    [ID.AQUATIC_STANCE]: {
      name: "Aquatic Stance",
      type: "Heal",
      slot: "Heal",
      specialization: "Weaver",
      categories: ["Stance"],
      quicknessCastTimeMs: 640,
      cooldown: 20,
      enduranceCost: 50,
      skillFamily: "Stance",
      implemented: true,
      effects: [],
    },
    [ID.PRIMORDIAL_STANCE_FIRE]: {
      name: "Primordial Stance (Fire)",
      type: "Utility",
      slot: "Utility",
      specialization: "Weaver",
      attunement: "Fire",
      categories: ["Stance"],
      quicknessCastTimeMs: 0,
      cooldown: 5,
      ammo: 2,
      ammoRecharge: 20,
      skillFamily: "Stance",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 0,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 1000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 2000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 3000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 4000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 5000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 0,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
            {
              atMs: 1000,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
            {
              atMs: 2000,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
            {
              atMs: 3000,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
            {
              atMs: 4000,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
            {
              atMs: 5000,
              condition: "Burning",
              stacks: 1,
              duration: 2,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
    },
    [ID.PRIMORDIAL_STANCE_WATER]: {
      name: "Primordial Stance (Water)",
      type: "Utility",
      slot: "Utility",
      specialization: "Weaver",
      attunement: "Water",
      categories: ["Stance"],
      quicknessCastTimeMs: 0,
      cooldown: 5,
      ammo: 2,
      ammoRecharge: 20,
      skillFamily: "Stance",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 0,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 1000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 2000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 3000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 4000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 5000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 0,
              condition: "Chilled",
              stacks: 1,
              duration: 1,
            },
            {
              atMs: 1000,
              condition: "Chilled",
              stacks: 1,
              duration: 1,
            },
            {
              atMs: 2000,
              condition: "Chilled",
              stacks: 1,
              duration: 1,
            },
            {
              atMs: 3000,
              condition: "Chilled",
              stacks: 1,
              duration: 1,
            },
            {
              atMs: 4000,
              condition: "Chilled",
              stacks: 1,
              duration: 1,
            },
            {
              atMs: 5000,
              condition: "Chilled",
              stacks: 1,
              duration: 1,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
    },
    [ID.PRIMORDIAL_STANCE_AIR]: {
      name: "Primordial Stance (Air)",
      type: "Utility",
      slot: "Utility",
      specialization: "Weaver",
      attunement: "Air",
      categories: ["Stance"],
      quicknessCastTimeMs: 0,
      cooldown: 5,
      ammo: 2,
      ammoRecharge: 20,
      skillFamily: "Stance",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 0,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 1000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 2000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 3000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 4000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 5000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 0,
              condition: "Vulnerability",
              stacks: 8,
              duration: 3,
            },
            {
              atMs: 1000,
              condition: "Vulnerability",
              stacks: 8,
              duration: 3,
            },
            {
              atMs: 2000,
              condition: "Vulnerability",
              stacks: 8,
              duration: 3,
            },
            {
              atMs: 3000,
              condition: "Vulnerability",
              stacks: 8,
              duration: 3,
            },
            {
              atMs: 4000,
              condition: "Vulnerability",
              stacks: 8,
              duration: 3,
            },
            {
              atMs: 5000,
              condition: "Vulnerability",
              stacks: 8,
              duration: 3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
    },
    [ID.PRIMORDIAL_STANCE_EARTH]: {
      name: "Primordial Stance (Earth)",
      type: "Utility",
      slot: "Utility",
      specialization: "Weaver",
      attunement: "Earth",
      categories: ["Stance"],
      quicknessCastTimeMs: 0,
      cooldown: 5,
      ammo: 2,
      ammoRecharge: 20,
      skillFamily: "Stance",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 0,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 1000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 2000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 3000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 4000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
            {
              atMs: 5000,
              coefficient: 0.33,
              metadata: {
                damageKind: "field-tick",
              },
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 0,
              condition: "Bleeding",
              stacks: 2,
              duration: 6,
            },
            {
              atMs: 1000,
              condition: "Bleeding",
              stacks: 2,
              duration: 6,
            },
            {
              atMs: 2000,
              condition: "Bleeding",
              stacks: 2,
              duration: 6,
            },
            {
              atMs: 3000,
              condition: "Bleeding",
              stacks: 2,
              duration: 6,
            },
            {
              atMs: 4000,
              condition: "Bleeding",
              stacks: 2,
              duration: 6,
            },
            {
              atMs: 5000,
              condition: "Bleeding",
              stacks: 2,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
    },
    [ID.WEAVE_SELF]: {
      name: "Weave Self",
      type: "Elite",
      slot: "Elite",
      specialization: "Weaver",
      categories: ["Stance"],
      quicknessCastTimeMs: 800,
      cooldown: 90,
      nextChainId: ID.TAILORED_VICTORY,
      skillFamily: "Stance",
      implemented: true,
      effects: [],
    },
    [ID.TAILORED_VICTORY]: {
      name: "Tailored Victory",
      type: "Elite",
      slot: "Elite",
      specialization: "Weaver",
      categories: ["Stance"],
      quicknessCastTimeMs: 560,
      cooldown: 0,
      nextChainId: ID.WEAVE_SELF,
      skillFamily: "Stance",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 0,
              coefficient: 0.75,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          canCrit: true,
        },
        {
          type: "control",
          atMs: 0,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "crowd-control",
          },
        },
      ],
    },
    [ID.FROSTFIRE_WARD]: {
      name: "Frostfire Ward",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Spear",
      attunement: "Fire+Water",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 0,
      cooldown: 15,
      aura: "Fire|3",
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 0,
              coefficient: 1,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
      ],
      specialization: "Weaver",
    },
    [ID.GALVANIZE]: {
      name: "Galvanize",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Spear",
      attunement: "Fire+Air",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 0,
      cooldown: 12,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 0,
              coefficient: 2.6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "boon",
          boon: "Superspeed",
          stacks: 1,
          duration: 3,
          durationScale: "boon",
          atMs: 0,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "boon",
          boon: "Might",
          stacks: 3,
          duration: 6,
          durationScale: "boon",
          atMs: 0,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.FIERY_IMPACT]: {
      name: "Fiery Impact",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Spear",
      attunement: "Fire+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 0,
      cooldown: 15,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 0,
              coefficient: 1.75,
              comboFinishers: [
                {
                  ownerId: "elementalist",
                  finisherType: "Blast",
                  ambiguousFieldSelection: "oldest",
                },
              ],
              metadata: {},
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 0,
              condition: "Burning",
              stacks: 1,
              duration: 5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 0,
              condition: "Bleeding",
              stacks: 3,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.ELUTRIATE]: {
      name: "Elutriate",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Spear",
      attunement: "Air+Water",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 0,
      cooldown: 20,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 0,
              coefficient: 1.25,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 0,
              condition: "Vulnerability",
              stacks: 5,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 0,
              condition: "Chilled",
              stacks: 1,
              duration: 4,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.SOOTHING_BURST]: {
      name: "Soothing Burst",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Spear",
      attunement: "Water+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 0,
      cooldown: 20,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 0,
              coefficient: 1,
              comboFinishers: [
                {
                  ownerId: "elementalist",
                  finisherType: "Blast",
                  ambiguousFieldSelection: "oldest",
                },
              ],
              metadata: {},
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
      ],
      specialization: "Weaver",
    },
    [ID.SHALE_STORM]: {
      name: "Shale Storm",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Spear",
      attunement: "Air+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 0,
      cooldown: 18,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 0,
              coefficient: 1.55,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "blind",
          atMs: 0,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "blind",
          },
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 0,
              condition: "Cripple",
              stacks: 1,
              duration: 5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.DUAL_ORBITS_FIRE_AND_WATER]: {
      name: "Dual Orbits: Fire and Water",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Hammer",
      attunement: "Fire+Water",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 0,
      cooldown: 18,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 1000,
              coefficient: 0.001,
              metadata: {
                damageKind: "field-tick",
              },
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1000,
              condition: "Burning",
              stacks: 1,
              duration: 0.75,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1000,
              condition: "Vulnerability",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.DUAL_ORBITS_FIRE_AND_AIR]: {
      name: "Dual Orbits: Fire and Air",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Hammer",
      attunement: "Fire+Air",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 0,
      cooldown: 18,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 1000,
              coefficient: 0.001,
              metadata: {
                damageKind: "field-tick",
              },
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1000,
              condition: "Burning",
              stacks: 1,
              duration: 0.75,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1000,
              condition: "Weakness",
              stacks: 1,
              duration: 1.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.DUAL_ORBITS_FIRE_AND_EARTH]: {
      name: "Dual Orbits: Fire and Earth",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Hammer",
      attunement: "Fire+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 0,
      cooldown: 18,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 1000,
              coefficient: 0.001,
              metadata: {
                damageKind: "field-tick",
              },
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1000,
              condition: "Burning",
              stacks: 1,
              duration: 0.75,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1000,
              condition: "Bleeding",
              stacks: 1,
              duration: 2.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.DUAL_ORBITS_WATER_AND_AIR]: {
      name: "Dual Orbits: Water and Air",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Hammer",
      attunement: "Air+Water",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 0,
      cooldown: 18,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 1000,
              coefficient: 0.001,
              metadata: {
                damageKind: "field-tick",
              },
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1000,
              condition: "Vulnerability",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1000,
              condition: "Weakness",
              stacks: 1,
              duration: 1.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.DUAL_ORBITS_WATER_AND_EARTH]: {
      name: "Dual Orbits: Water and Earth",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Hammer",
      attunement: "Water+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 0,
      cooldown: 18,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 1000,
              coefficient: 0.001,
              metadata: {
                damageKind: "field-tick",
              },
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1000,
              condition: "Bleeding",
              stacks: 1,
              duration: 2.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1000,
              condition: "Vulnerability",
              stacks: 1,
              duration: 6,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.DUAL_ORBITS_AIR_AND_EARTH]: {
      name: "Dual Orbits: Air and Earth",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Hammer",
      attunement: "Air+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 0,
      cooldown: 18,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 1000,
              coefficient: 0.001,
              metadata: {
                damageKind: "field-tick",
              },
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1000,
              condition: "Bleeding",
              stacks: 1,
              duration: 2.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 1000,
              condition: "Weakness",
              stacks: 1,
              duration: 1.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.FROSTFIRE_FLURRY]: {
      name: "Frostfire Flurry",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Pistol",
      attunement: "Fire+Water",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 640,
      cooldown: 15,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 420,
              coefficient: 0.3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 420,
              condition: "Chilled",
              stacks: 1,
              duration: 2.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 660,
              coefficient: 0.3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 660,
              condition: "Burning",
              stacks: 1,
              duration: 5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 960,
              coefficient: 0.3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 960,
              condition: "Burning",
              stacks: 1,
              duration: 5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
      elementalistStateMachine: "pistol-bullets",
    },
    [ID.PURBLINDING_PLASMA]: {
      name: "Purblinding Plasma",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Pistol",
      attunement: "Fire+Air",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 640,
      cooldown: 12,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 720,
              coefficient: 0.8,
              comboFinishers: [
                {
                  ownerId: "elementalist",
                  finisherType: "Projectile",
                  ambiguousFieldSelection: "oldest",
                },
              ],
              metadata: {},
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "blind",
          atMs: 720,
          applications: 1,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {
            controlKind: "blind",
          },
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 720,
              condition: "Vulnerability",
              stacks: 5,
              duration: 5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
      elementalistStateMachine: "pistol-bullets",
    },
    [ID.MOLTEN_METEOR]: {
      name: "Molten Meteor",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Pistol",
      attunement: "Fire+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 480,
      cooldown: 12,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 720,
              coefficient: 0.5,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 720,
              condition: "Burning",
              stacks: 1,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 720,
              condition: "Bleeding",
              stacks: 2,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
      elementalistStateMachine: "pistol-bullets",
    },
    [ID.FLOWING_FINESSE]: {
      name: "Flowing Finesse",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Pistol",
      attunement: "Air+Water",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 880,
      cooldown: 12,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "boon",
          boon: "Regeneration",
          stacks: 1,
          duration: 5,
          durationScale: "boon",
          atMs: 0,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "boon",
          boon: "Stability",
          stacks: 1,
          duration: 5,
          durationScale: "boon",
          atMs: 0,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
      elementalistStateMachine: "pistol-bullets",
    },
    [ID.ECHOING_EROSION]: {
      name: "Echoing Erosion",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Pistol",
      attunement: "Water+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 480,
      cooldown: 15,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 420,
              coefficient: 0.3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 420,
              condition: "Bleeding",
              stacks: 2,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "strike",
          ticks: [
            {
              atMs: 720,
              coefficient: 0.3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 720,
              condition: "Bleeding",
              stacks: 2,
              duration: 8,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
    },
    [ID.ENERVATING_EARTH]: {
      name: "Enervating Earth",
      type: "Weapon",
      slot: "Weapon_3",
      weapon: "Pistol",
      attunement: "Air+Earth",
      categories: ["Weapon skill"],
      quicknessCastTimeMs: 560,
      cooldown: 12,
      skillFamily: "Weapon skill",
      implemented: true,
      effects: [
        {
          type: "strike",
          ticks: [
            {
              atMs: 780,
              coefficient: 0.7,
              comboFinishers: [
                {
                  ownerId: "elementalist",
                  finisherType: "Projectile",
                  ambiguousFieldSelection: "oldest",
                },
              ],
              metadata: {},
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 780,
              condition: "Weakness",
              stacks: 1,
              duration: 3,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "condition",
          ticks: [
            {
              atMs: 780,
              condition: "Cripple",
              stacks: 1,
              duration: 4,
            },
          ],
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
      specialization: "Weaver",
      elementalistStateMachine: "pistol-bullets",
    },
    [ID.UNRAVEL]: {
      name: "Unravel",
      type: "Profession",
      slot: "Profession_5",
      specialization: "Weaver",
      categories: ["Stance"],
      mechanicSlot: 5,
      quicknessCastTimeMs: 0,
      cooldown: 25,
      skillFamily: "Stance",
      implemented: true,
      effects: [],
    },
    [ID.FERVENT_STANCE]: {
      name: "Fervent Stance",
      type: "Utility",
      slot: "Utility",
      specialization: "Weaver",
      categories: ["Stance"],
      quicknessCastTimeMs: 0,
      cooldown: 20,
      skillFamily: "Stance",
      implemented: true,
      effects: [
        {
          type: "boon",
          boon: "Swiftness",
          stacks: 1,
          duration: 6,
          durationScale: "boon",
          atMs: 0,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "boon",
          boon: "Fury",
          stacks: 1,
          duration: 6,
          durationScale: "boon",
          atMs: 0,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
        {
          type: "boon",
          boon: "Quickness",
          stacks: 1,
          duration: 6,
          durationScale: "boon",
          atMs: 0,
          timingAnchor: "castStart",
          timingScale: "cast",
          metadata: {},
        },
      ],
    },
  });
