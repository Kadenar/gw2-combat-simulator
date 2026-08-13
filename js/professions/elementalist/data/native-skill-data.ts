// Native Elementalist skill declarations.
// Cast timing, coefficients, effects, and profession metadata are maintained here.
import type { Skill } from "../../../platform/engine/types.js";

export const ELEMENTALIST_GENERATED_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: 1100001,
    name: "Fire Attunement",
    type: "Profession",
    slot: "Profession_1",
    mechanicSlot: 1,
    categories: ["Attunement"],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    canCastConcurrently: true,
    skillFamily: "Attunement",
    implemented: true,
    effects: [],
  },
  {
    id: 1100002,
    name: "Water Attunement",
    type: "Profession",
    slot: "Profession_2",
    mechanicSlot: 2,
    categories: ["Attunement"],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    canCastConcurrently: true,
    skillFamily: "Attunement",
    implemented: true,
    effects: [],
  },
  {
    id: 1100003,
    name: "Air Attunement",
    type: "Profession",
    slot: "Profession_3",
    mechanicSlot: 3,
    categories: ["Attunement"],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    canCastConcurrently: true,
    skillFamily: "Attunement",
    implemented: true,
    effects: [],
  },
  {
    id: 1100004,
    name: "Earth Attunement",
    type: "Profession",
    slot: "Profession_4",
    mechanicSlot: 4,
    categories: ["Attunement"],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    canCastConcurrently: true,
    skillFamily: "Attunement",
    implemented: true,
    effects: [],
  },
  {
    id: 1100005,
    name: "Fireball",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Staff",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 960,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1080,
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
            atMs: 1080,
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
  },
  {
    id: 1100006,
    name: "Lava Font",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Staff",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 280,
    cooldown: 6,
    comboField: "Fire",
    fieldDuration: 4,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1740,
            coefficient: 0.525,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 3240,
            coefficient: 0.525,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 4740,
            coefficient: 0.525,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 6240,
            coefficient: 0.525,
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
            atMs: 1740,
            condition: "Burning",
            stacks: 1,
            duration: 1,
          },
          {
            atMs: 3240,
            condition: "Burning",
            stacks: 1,
            duration: 1,
          },
          {
            atMs: 4740,
            condition: "Burning",
            stacks: 1,
            duration: 1,
          },
          {
            atMs: 6240,
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
  },
  {
    id: 1100007,
    name: "Flame Burst",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Staff",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 360,
    cooldown: 10,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 480,
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
            atMs: 480,
            condition: "Burning",
            stacks: 3,
            duration: 6,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "blind",
        atMs: 480,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "blind",
        },
      },
    ],
  },
  {
    id: 1100008,
    name: "Burning Retreat",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Staff",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 1000,
    cooldown: 18,
    comboField: "Fire",
    fieldDuration: 6,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 120,
            coefficient: 0.2,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 120,
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
            atMs: 1620,
            coefficient: 0.2,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 3120,
            coefficient: 0.2,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 4620,
            coefficient: 0.2,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 6120,
            coefficient: 0.2,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 7620,
            coefficient: 0.2,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 9120,
            coefficient: 0.2,
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
            atMs: 1620,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 3120,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 4620,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 6120,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 7620,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 9120,
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
  {
    id: 1100009,
    name: "Meteor Shower",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Staff",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 2640,
    cooldown: 30,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 3480,
            coefficient: 1.6,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 3900,
            coefficient: 1.44,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 4380,
            coefficient: 1.28,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 4860,
            coefficient: 1.12,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 5100,
            coefficient: 0.96,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 5820,
            coefficient: 0.8,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 6720,
            coefficient: 0.64,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 7140,
            coefficient: 0.48,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 7620,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 8100,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 8340,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 9060,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 9960,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 10380,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 10860,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 11340,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 11580,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 12300,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 13200,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 13620,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 14100,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 14580,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 14820,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 15540,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100010,
    name: "Water Blast",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Staff",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 840,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 900,
            coefficient: 0.3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100011,
    name: "Ice Spike",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Staff",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 520,
    cooldown: 6,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 2640,
            coefficient: 1.5,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
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
            atMs: 2640,
            condition: "Vulnerability",
            stacks: 5,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100012,
    name: "Geyser",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Staff",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 560,
    cooldown: 20,
    comboField: "Water",
    fieldDuration: 4,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [],
  },
  {
    id: 1100013,
    name: "Frozen Grounds",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Staff",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 280,
    cooldown: 30,
    comboField: "Ice",
    fieldDuration: 5,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "condition",
        ticks: [
          {
            atMs: 240,
            condition: "Chilled",
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
  {
    id: 1100014,
    name: "Healing Rain",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Staff",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 840,
    cooldown: 35,
    comboField: "Water",
    fieldDuration: 6,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "Regeneration",
        stacks: 1,
        duration: 13,
        durationScale: "boon",
        atMs: 1080,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100015,
    name: "Chain Lightning",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Staff",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 840,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 900,
            coefficient: 0.8,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100016,
    name: "Lightning Surge",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Staff",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 1000,
    cooldown: 10,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1200,
            coefficient: 1.8,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "blind",
        atMs: 1200,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "blind",
        },
      },
    ],
  },
  {
    id: 1100017,
    name: "Gust",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Staff",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 480,
    cooldown: 25,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "control",
        atMs: 270,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
        },
      },
    ],
  },
  {
    id: 1100018,
    name: "Windborne Speed",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Staff",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 480,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "Swiftness",
        stacks: 1,
        duration: 10,
        durationScale: "boon",
        atMs: 300,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Superspeed",
        stacks: 1,
        duration: 3,
        durationScale: "boon",
        atMs: 300,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100019,
    name: "Static Field",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Staff",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 30,
    comboField: "Lightning",
    fieldDuration: 4,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 270,
            coefficient: 0.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "control",
        atMs: 270,
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
            atMs: 1020,
            coefficient: 0.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "control",
        atMs: 1020,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
        },
      },
    ],
  },
  {
    id: 1100020,
    name: "Stoning",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Staff",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 880,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 900,
            coefficient: 1.2,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
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
            atMs: 900,
            condition: "Weakness",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100021,
    name: "Eruption",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Staff",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 840,
    cooldown: 6,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 6000,
            coefficient: 1.5,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
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
            atMs: 6000,
            condition: "Bleeding",
            stacks: 6,
            duration: 12,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 6000,
            condition: "Cripple",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100022,
    name: "Magnetic Aura",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Staff",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 0,
    cooldown: 30,
    nextChainId: 1100023,
    aura: "Magnetic|4",
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [],
  },
  {
    id: 1100023,
    name: "Transmute Earth",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Staff",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 360,
    cooldown: 10,
    nextChainId: 1100022,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1260,
            coefficient: 1,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100024,
    name: "Unsteady Ground",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Staff",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 720,
    cooldown: 30,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "control",
        atMs: 600,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
        },
      },
    ],
  },
  {
    id: 1100025,
    name: "Shock Wave",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Staff",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 25,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 900,
            coefficient: 2.5,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
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
            atMs: 900,
            condition: "Bleeding",
            stacks: 1,
            duration: 20,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 900,
            condition: "Immobilize",
            stacks: 1,
            duration: 2,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100026,
    name: "Flamestrike",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Scepter",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 600,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 360,
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
            atMs: 360,
            condition: "Burning",
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
            atMs: 780,
            coefficient: 0.7,
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
            condition: "Burning",
            stacks: 1,
            duration: 2.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100027,
    name: "Dragon's Tooth",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Scepter",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 6,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 3900,
            coefficient: 2.25,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
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
            atMs: 3900,
            condition: "Burning",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100028,
    name: "Phoenix",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Scepter",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 480,
    cooldown: 10,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 480,
            coefficient: 0.75,
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
            coefficient: 1.7,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
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
            atMs: 540,
            condition: "Burning",
            stacks: 2,
            duration: 6,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 570,
            coefficient: 0.75,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "boon",
        boon: "Vigor",
        stacks: 1,
        duration: 5,
        durationScale: "boon",
        atMs: 570,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100029,
    name: "Ice Shards",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Scepter",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 560,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 720,
            coefficient: 0.39999999999999997,
          },
          {
            atMs: 720,
            coefficient: 0.39999999999999997,
          },
          {
            atMs: 720,
            coefficient: 0.39999999999999997,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100030,
    name: "Shatterstone",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Scepter",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 400,
    cooldown: 3,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
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
            atMs: 540,
            condition: "Chilled",
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
            atMs: 1560,
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
            atMs: 1560,
            condition: "Chilled",
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
  {
    id: 1100031,
    name: "Water Trident",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Scepter",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 1,
    ammo: 2,
    ammoRecharge: 10,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 780,
            coefficient: 2.4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100032,
    name: "Arc Lightning",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Scepter",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 2720,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 660,
            coefficient: 0.35,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1020,
            coefficient: 0.35,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1440,
            coefficient: 0.35,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1800,
            coefficient: 0.4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 2160,
            coefficient: 0.4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 2580,
            coefficient: 0.4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 2940,
            coefficient: 0.3375,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 3300,
            coefficient: 0.3375,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 3720,
            coefficient: 0.3375,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 4080,
            coefficient: 0.3375,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100033,
    name: "Lightning Strike",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Scepter",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 0,
    cooldown: 5,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 0,
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
            atMs: 0,
            condition: "Vulnerability",
            stacks: 5,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100034,
    name: "Blinding Flash",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Scepter",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 0,
    cooldown: 0.5,
    ammo: 2,
    ammoRecharge: 10,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
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
            condition: "Weakness",
            stacks: 1,
            duration: 4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100035,
    name: "Stone Shards",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Scepter",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 1400,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1080,
            coefficient: 0.5,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 0.2,
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
            atMs: 1080,
            condition: "Bleeding",
            stacks: 1,
            duration: 6,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 0.2,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1500,
            coefficient: 0.5,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 0.2,
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
            atMs: 1500,
            condition: "Bleeding",
            stacks: 1,
            duration: 6,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 0.2,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1860,
            coefficient: 0.5,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 0.2,
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
            condition: "Bleeding",
            stacks: 1,
            duration: 6,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 0.2,
        },
      },
    ],
  },
  {
    id: 1100036,
    name: "Rock Barrier",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Scepter",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 760,
    cooldown: 8,
    nextChainId: 1100037,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "Resistance",
        stacks: 1,
        duration: 4,
        durationScale: "boon",
        atMs: 1140,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100037,
    name: "Hurl",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Scepter",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    nextChainId: 1100036,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 300,
            coefficient: 0.44,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
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
            atMs: 300,
            condition: "Bleeding",
            stacks: 1,
            duration: 8,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 500,
            coefficient: 0.44,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
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
            atMs: 500,
            condition: "Bleeding",
            stacks: 1,
            duration: 8,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 700,
            coefficient: 0.44,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
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
            atMs: 700,
            condition: "Bleeding",
            stacks: 1,
            duration: 8,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 900,
            coefficient: 0.44,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
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
            atMs: 900,
            condition: "Bleeding",
            stacks: 1,
            duration: 8,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1100,
            coefficient: 0.44,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
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
            atMs: 1100,
            condition: "Bleeding",
            stacks: 1,
            duration: 8,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100038,
    name: "Dust Devil",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Scepter",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 320,
    cooldown: 15,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 240,
            coefficient: 0.4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "blind",
        atMs: 240,
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
            atMs: 240,
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
            coefficient: 0.4,
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
            atMs: 3240,
            coefficient: 0.4,
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
  },
  {
    id: 1100039,
    name: "Fire Strike",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Sword",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: 1100040,
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
    ],
  },
  {
    id: 1100040,
    name: "Fire Swipe",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Sword",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: 1100041,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
            coefficient: 1.1,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100041,
    name: "Searing Slash",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Sword",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 0,
    nextChainId: 1100039,
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
            condition: "Burning",
            stacks: 1,
            duration: 4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100042,
    name: "Flame Uprising",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Sword",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 720,
    cooldown: 8,
    comboField: "Fire",
    fieldDuration: 2,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 900,
            coefficient: 2,
            metadata: {
              finisherType: "Leap",
              finisherValue: 1,
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
            atMs: 900,
            condition: "Burning",
            stacks: 1,
            duration: 4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Leap",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 2400,
            coefficient: 0.5,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 3900,
            coefficient: 0.5,
            metadata: {
              damageKind: "field-tick",
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100043,
    name: "Cauterizing Strike",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Sword",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 15,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 660,
            coefficient: 2.91,
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
            duration: 8,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100044,
    name: "Seiche",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Sword",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: 1100045,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 420,
            coefficient: 0.8,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100045,
    name: "Clapotis",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Sword",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: 1100046,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
            coefficient: 0.9,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100046,
    name: "Breaking Wave",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Sword",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 0,
    nextChainId: 1100044,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 720,
            coefficient: 1.1,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100047,
    name: "Riptide",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Sword",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 1080,
    cooldown: 12,
    comboField: "Water",
    fieldDuration: 4,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 60,
            coefficient: 0.33,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "boon",
        boon: "Regeneration",
        stacks: 1,
        duration: 5,
        durationScale: "boon",
        atMs: 60,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100048,
    name: "Aqua Siphon",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Sword",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 15,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 900,
            coefficient: 0.75,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "boon",
        boon: "Regeneration",
        stacks: 1,
        duration: 5,
        durationScale: "boon",
        atMs: 900,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100049,
    name: "Charged Strike",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Sword",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: 1100050,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 420,
            coefficient: 0.9,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100050,
    name: "Polaric Slash",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Sword",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: 1100051,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
            coefficient: 1,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "boon",
        boon: "Swiftness",
        stacks: 1,
        duration: 2,
        durationScale: "boon",
        atMs: 540,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100051,
    name: "Call Lightning",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Sword",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 760,
    cooldown: 0,
    nextChainId: 1100049,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 840,
            coefficient: 1.2,
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
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1440,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1740,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100052,
    name: "Polaric Leap",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Sword",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 15,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 420,
            coefficient: 0.66,
            metadata: {
              finisherType: "Leap",
              finisherValue: 1,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "boon",
        boon: "Superspeed",
        stacks: 1,
        duration: 3,
        durationScale: "boon",
        atMs: 420,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Leap",
          finisherValue: 1,
        },
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 420,
            condition: "Weakness",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Leap",
          finisherValue: 1,
        },
      },
      {
        type: "control",
        atMs: 420,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
          finisherType: "Leap",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100053,
    name: "Quantum Strike",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Sword",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 16,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 900,
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
            atMs: 900,
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
            atMs: 1200,
            coefficient: 0.425,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 1200,
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
            atMs: 1500,
            coefficient: 0.425,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 1500,
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
            atMs: 1800,
            coefficient: 0.425,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 1800,
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
            atMs: 2100,
            coefficient: 0.425,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2100,
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
            coefficient: 0.425,
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
            atMs: 2700,
            coefficient: 0.425,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2700,
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
            atMs: 3000,
            coefficient: 0.425,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 3000,
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
            atMs: 3300,
            coefficient: 0.425,
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
  },
  {
    id: 1100054,
    name: "Crystal Slash",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Sword",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: 1100055,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 420,
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
            atMs: 420,
            condition: "Bleeding",
            stacks: 1,
            duration: 4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100055,
    name: "Crystalline Strike",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Sword",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: 1100056,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
            coefficient: 0.9,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 540,
            condition: "Bleeding",
            stacks: 1,
            duration: 4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100056,
    name: "Crystalline Sunder",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Sword",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 0,
    nextChainId: 1100054,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 720,
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
            atMs: 720,
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
            atMs: 720,
            condition: "Cripple",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100057,
    name: "Earthen Vortex",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Sword",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 1000,
    cooldown: 10,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1080,
            coefficient: 1.8,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
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
            atMs: 1080,
            condition: "Bleeding",
            stacks: 2,
            duration: 8,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 1080,
            condition: "Cripple",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100058,
    name: "Rust Frenzy",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Sword",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 1400,
    cooldown: 15,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
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
            atMs: 540,
            condition: "Bleeding",
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
            atMs: 540,
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
            atMs: 540,
            condition: "Bleeding",
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
            atMs: 900,
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
            atMs: 900,
            condition: "Bleeding",
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
            atMs: 960,
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
            atMs: 960,
            condition: "Bleeding",
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
            atMs: 1260,
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
            atMs: 1260,
            condition: "Bleeding",
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
            atMs: 1260,
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
            atMs: 1260,
            condition: "Bleeding",
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
            atMs: 1620,
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
            atMs: 1620,
            condition: "Bleeding",
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
            condition: "Bleeding",
            stacks: 1,
            duration: 4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100059,
    name: "Dragon's Claw",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Dagger",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 720,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 660,
            coefficient: 0.45,
          },
          {
            atMs: 660,
            coefficient: 0.45,
          },
          {
            atMs: 660,
            coefficient: 0.45,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100060,
    name: "Drake's Breath",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Dagger",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 1360,
    cooldown: 5,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 780,
            coefficient: 1.05,
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
        type: "strike",
        ticks: [
          {
            atMs: 1140,
            coefficient: 1.05,
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
            atMs: 1500,
            coefficient: 1.05,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 1500,
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
        type: "strike",
        ticks: [
          {
            atMs: 1860,
            coefficient: 1.05,
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
            duration: 4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100061,
    name: "Burning Speed",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Dagger",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 800,
    cooldown: 12,
    comboField: "Fire",
    fieldDuration: 4,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1200,
            coefficient: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 1200,
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
            atMs: 240,
            coefficient: 0.2,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 1740,
            coefficient: 0.2,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 3240,
            coefficient: 0.2,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 4740,
            coefficient: 0.2,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 6240,
            coefficient: 0.2,
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
            atMs: 240,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 1740,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 3240,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 4740,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 6240,
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
  {
    id: 1100062,
    name: "Ring of Fire",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Dagger",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 480,
    cooldown: 15,
    comboField: "Fire",
    fieldDuration: 5,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 420,
            coefficient: 2,
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
            condition: "Burning",
            stacks: 2,
            duration: 4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100063,
    name: "Fire Grab",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Dagger",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 560,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 720,
            coefficient: 3.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100064,
    name: "Vapor Blade",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Dagger",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 360,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
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
            atMs: 540,
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
        type: "strike",
        ticks: [
          {
            atMs: 2040,
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
            atMs: 2040,
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
  },
  {
    id: 1100065,
    name: "Cone of Cold",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Dagger",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 1360,
    cooldown: 10,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 780,
            coefficient: 0.6,
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
            coefficient: 0.6,
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
            coefficient: 0.6,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1860,
            coefficient: 0.6,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100066,
    name: "Frozen Burst",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Dagger",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 600,
    cooldown: 12,
    comboField: "Ice",
    fieldDuration: 2,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 300,
            coefficient: 0.4,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
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
            atMs: 300,
            condition: "Chilled",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100067,
    name: "Frost Aura",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Dagger",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    nextChainId: 1100068,
    aura: "Frost|10",
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [],
  },
  {
    id: 1100068,
    name: "Transmute Frost",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Dagger",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 360,
    cooldown: 10,
    nextChainId: 1100067,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1260,
            coefficient: 0.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "boon",
        boon: "Regeneration",
        stacks: 1,
        duration: 4,
        durationScale: "boon",
        atMs: 1260,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100069,
    name: "Cleansing Wave",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Dagger",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 960,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [],
  },
  {
    id: 1100070,
    name: "Lightning Whip",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Dagger",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 640,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
            coefficient: 0.75,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 840,
            coefficient: 0.75,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100071,
    name: "Convergence",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Dagger",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 360,
    cooldown: 8,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1980,
            coefficient: 2.4,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
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
            atMs: 1980,
            condition: "Weakness",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 2.5,
        durationScale: "boon",
        atMs: 1980,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100072,
    name: "Shocking Aura",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Dagger",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    nextChainId: 1100073,
    aura: "Shocking|10",
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [],
  },
  {
    id: 1100073,
    name: "Transmute Lightning",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Dagger",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 360,
    cooldown: 10,
    nextChainId: 1100072,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1260,
            coefficient: 1.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "control",
        atMs: 1260,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
        },
      },
    ],
  },
  {
    id: 1100074,
    name: "Ride the Lightning",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Dagger",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 120,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 120,
            coefficient: 1.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100075,
    name: "Updraft",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Dagger",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 880,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "Swiftness",
        stacks: 1,
        duration: 10,
        durationScale: "boon",
        atMs: 1320,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "control",
        atMs: 1320,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
        },
      },
    ],
  },
  {
    id: 1100076,
    name: "Impale",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Dagger",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 600,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 960,
            coefficient: 0.77,
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
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100077,
    name: "Ring of Earth",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Dagger",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 880,
    cooldown: 6,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 300,
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
            atMs: 300,
            condition: "Bleeding",
            stacks: 3,
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
            atMs: 300,
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
        type: "strike",
        ticks: [
          {
            atMs: 1140,
            coefficient: 1.9,
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
            stacks: 3,
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
            atMs: 1140,
            condition: "Cripple",
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
  {
    id: 1100078,
    name: "Earthen Rush",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Dagger",
    attunement: "Earth",
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
            atMs: 420,
            coefficient: 2.3,
            metadata: {
              finisherType: "Leap",
              finisherValue: 1,
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
            atMs: 420,
            condition: "Immobilize",
            stacks: 1,
            duration: 2,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Leap",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100079,
    name: "Earthquake",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Dagger",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 16,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 720,
            coefficient: 3,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "control",
        atMs: 720,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100080,
    name: "Churning Earth",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Dagger",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 960,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1200,
            coefficient: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 1200,
            condition: "Bleeding",
            stacks: 10,
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
            atMs: 1200,
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
  },
  {
    id: 1100081,
    name: "Flamewall",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Focus",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 560,
    cooldown: 20,
    comboField: "Fire",
    fieldDuration: 9,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 840,
            coefficient: 0.1,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 2340,
            coefficient: 0.1,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 3840,
            coefficient: 0.1,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 5340,
            coefficient: 0.1,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 6840,
            coefficient: 0.1,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 8340,
            coefficient: 0.1,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 9840,
            coefficient: 0.1,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 11340,
            coefficient: 0.1,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 12840,
            coefficient: 0.1,
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
            atMs: 840,
            condition: "Burning",
            stacks: 1,
            duration: 2.5,
          },
          {
            atMs: 2340,
            condition: "Burning",
            stacks: 1,
            duration: 2.5,
          },
          {
            atMs: 3840,
            condition: "Burning",
            stacks: 1,
            duration: 2.5,
          },
          {
            atMs: 5340,
            condition: "Burning",
            stacks: 1,
            duration: 2.5,
          },
          {
            atMs: 6840,
            condition: "Burning",
            stacks: 1,
            duration: 2.5,
          },
          {
            atMs: 8340,
            condition: "Burning",
            stacks: 1,
            duration: 2.5,
          },
          {
            atMs: 9840,
            condition: "Burning",
            stacks: 1,
            duration: 2.5,
          },
          {
            atMs: 11340,
            condition: "Burning",
            stacks: 1,
            duration: 2.5,
          },
          {
            atMs: 12840,
            condition: "Burning",
            stacks: 1,
            duration: 2.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100082,
    name: "Fire Shield",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Focus",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 0,
    cooldown: 25,
    nextChainId: 1100083,
    aura: "Fire|4",
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [],
  },
  {
    id: 1100083,
    name: "Transmute Fire",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Focus",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 360,
    cooldown: 10,
    nextChainId: 1100082,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1260,
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
            atMs: 1260,
            condition: "Burning",
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
        boon: "Might",
        stacks: 5,
        duration: 6,
        durationScale: "boon",
        atMs: 1260,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100084,
    name: "Freezing Gust",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Focus",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 25,
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
    ],
  },
  {
    id: 1100085,
    name: "Comet",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Focus",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 25,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1140,
            coefficient: 0.75,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "control",
        atMs: 1140,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100086,
    name: "Swirling Winds",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Focus",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 30,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [],
  },
  {
    id: 1100087,
    name: "Gale",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Focus",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 560,
    cooldown: 40,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "control",
        atMs: 840,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
        },
      },
    ],
  },
  {
    id: 1100088,
    name: "Magnetic Wave",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Focus",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 0,
    cooldown: 25,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 0,
            coefficient: 1,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
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
            condition: "Cripple",
            stacks: 1,
            duration: 5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100089,
    name: "Obsidian Flesh",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Focus",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 3800,
    cooldown: 50,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [],
  },
  {
    id: 1100090,
    name: "Heat Sync",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Warhorn",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 840,
    cooldown: 30,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 10,
        durationScale: "boon",
        atMs: 840,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Might",
        stacks: 3,
        duration: 10,
        durationScale: "boon",
        atMs: 840,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100091,
    name: "Wildfire",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Warhorn",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 660,
    cooldown: 30,
    comboField: "Fire",
    fieldDuration: 8,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 2340,
            coefficient: 0.44,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 3840,
            coefficient: 0.44,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 5340,
            coefficient: 0.44,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 6840,
            coefficient: 0.44,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 8340,
            coefficient: 0.44,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 9840,
            coefficient: 0.44,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 11340,
            coefficient: 0.44,
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
            atMs: 2340,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 3840,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 5340,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 6840,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 8340,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 9840,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 11340,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100092,
    name: "Tidal Surge",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Warhorn",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 30,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1380,
            coefficient: 1,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "control",
        atMs: 1380,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100093,
    name: "Water Globe",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Warhorn",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 840,
    cooldown: 30,
    comboField: "Water",
    fieldDuration: 4,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [],
  },
  {
    id: 1100094,
    name: "Cyclone",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Warhorn",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 800,
    cooldown: 25,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 840,
            coefficient: 0.9,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "boon",
        boon: "Swiftness",
        stacks: 1,
        duration: 10,
        durationScale: "boon",
        atMs: 840,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Superspeed",
        stacks: 1,
        duration: 2.5,
        durationScale: "boon",
        atMs: 840,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "control",
        atMs: 840,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
        },
      },
    ],
  },
  {
    id: 1100095,
    name: "Lightning Orb",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Warhorn",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 25,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 600,
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
            atMs: 600,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            coefficient: 0.72,
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
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 1440,
            coefficient: 0.64,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 1440,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 1860,
            coefficient: 0.56,
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
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 2280,
            coefficient: 0.48,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2280,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 2700,
            coefficient: 0.4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2700,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 3120,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 3120,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 3540,
            coefficient: 0.24,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 3540,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 4140,
            coefficient: 0.16,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 4140,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 4740,
            coefficient: 0.08,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 4740,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 5400,
            coefficient: 0.05,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 5400,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 6000,
            coefficient: 0.05,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 6000,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 6600,
            coefficient: 0.05,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 6600,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 7200,
            coefficient: 0.05,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 7200,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 7200,
            coefficient: 0.05,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 7200,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 7590,
            coefficient: 0.05,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 7590,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 8085,
            coefficient: 0.05,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 8085,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 8685,
            coefficient: 0.05,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 8685,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 9330,
            coefficient: 0.05,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 9330,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 9930,
            coefficient: 0.05,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 9930,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100096,
    name: "Sand Squall",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Warhorn",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 840,
    cooldown: 30,
    aura: "Magnetic|4",
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "Protection",
        stacks: 1,
        duration: 2,
        durationScale: "boon",
        atMs: 840,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100097,
    name: "Dust Storm",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Warhorn",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 840,
    cooldown: 30,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 2340,
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
            atMs: 2340,
            condition: "Bleeding",
            stacks: 2,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "blind",
        atMs: 2340,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "blind",
        },
      },
      {
        type: "boon",
        boon: "Resistance",
        stacks: 1,
        duration: 4,
        durationScale: "boon",
        atMs: 2340,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 3960,
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
            atMs: 3960,
            condition: "Bleeding",
            stacks: 2,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "blind",
        atMs: 3960,
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
            atMs: 5340,
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
            atMs: 5340,
            condition: "Bleeding",
            stacks: 2,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "blind",
        atMs: 5340,
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
            atMs: 6960,
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
            atMs: 6960,
            condition: "Bleeding",
            stacks: 2,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "blind",
        atMs: 6960,
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
            atMs: 8340,
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
            atMs: 8340,
            condition: "Bleeding",
            stacks: 2,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "blind",
        atMs: 8340,
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
            atMs: 9960,
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
            atMs: 9960,
            condition: "Bleeding",
            stacks: 2,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "blind",
        atMs: 9960,
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
            atMs: 11340,
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
            atMs: 11340,
            condition: "Bleeding",
            stacks: 2,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "blind",
        atMs: 11340,
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
            atMs: 12960,
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
            atMs: 12960,
            condition: "Bleeding",
            stacks: 2,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "blind",
        atMs: 12960,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "blind",
        },
      },
    ],
  },
  {
    id: 1100098,
    name: "Arcane Brilliance",
    type: "Heal",
    slot: "Heal",
    categories: ["Arcane"],
    quicknessCastTimeMs: 640,
    cooldown: 20,
    skillFamily: "Arcane",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 780,
            coefficient: 0.5,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100099,
    name: "Signet of Restoration",
    type: "Heal",
    slot: "Heal",
    categories: ["Signet"],
    quicknessCastTimeMs: 440,
    cooldown: 20,
    skillFamily: "Signet",
    implemented: true,
    effects: [],
  },
  {
    id: 1100100,
    name: "Glyph of Elemental Harmony",
    type: "Heal",
    slot: "Heal",
    categories: ["Glyph"],
    quicknessCastTimeMs: 800,
    cooldown: 20,
    skillFamily: "Glyph",
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "Might",
        stacks: 3,
        duration: 20,
        durationScale: "boon",
        atMs: 1020,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100101,
    name: "Arcane Blast",
    type: "Utility",
    slot: "Utility",
    categories: ["Arcane"],
    quicknessCastTimeMs: 0,
    cooldown: 1,
    ammo: 3,
    ammoRecharge: 20,
    skillFamily: "Arcane",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 0,
            coefficient: 1.4,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100102,
    name: "Arcane Echo",
    type: "Utility",
    slot: "Utility",
    categories: ["Arcane"],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    skillFamily: "Arcane",
    implemented: true,
    effects: [],
  },
  {
    id: 1100103,
    name: "Arcane Wave",
    type: "Utility",
    slot: "Utility",
    categories: ["Arcane"],
    quicknessCastTimeMs: 760,
    cooldown: 2,
    ammo: 2,
    ammoRecharge: 25,
    skillFamily: "Arcane",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1200,
            coefficient: 1.4,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "control",
        atMs: 1200,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100104,
    name: "Conjure Frost Bow",
    type: "Utility",
    slot: "Utility",
    categories: ["Conjure"],
    quicknessCastTimeMs: 480,
    cooldown: 60,
    skillFamily: "Conjure",
    implemented: true,
    effects: [],
  },
  {
    id: 1100105,
    name: "Conjure Lightning Hammer",
    type: "Utility",
    slot: "Utility",
    categories: ["Conjure"],
    quicknessCastTimeMs: 880,
    cooldown: 60,
    skillFamily: "Conjure",
    implemented: true,
    effects: [],
  },
  {
    id: 1100106,
    name: "Water Arrow",
    type: "Weapon",
    slot: "Weapon_1",
    skillWeapon: "Frost Bow",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 600,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 840,
            coefficient: 0.3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100107,
    name: "Frost Volley",
    type: "Weapon",
    slot: "Weapon_2",
    skillWeapon: "Frost Bow",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 1600,
    cooldown: 6,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
            coefficient: 0.5,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
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
            atMs: 540,
            condition: "Vulnerability",
            stacks: 1,
            duration: 15,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1020,
            coefficient: 0.5,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
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
            atMs: 1020,
            condition: "Vulnerability",
            stacks: 1,
            duration: 15,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1500,
            coefficient: 0.5,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
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
            atMs: 1500,
            condition: "Vulnerability",
            stacks: 1,
            duration: 15,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1980,
            coefficient: 0.5,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
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
            atMs: 1980,
            condition: "Vulnerability",
            stacks: 1,
            duration: 15,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 2460,
            coefficient: 0.5,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
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
            atMs: 2460,
            condition: "Vulnerability",
            stacks: 1,
            duration: 15,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100108,
    name: "Frost Fan",
    type: "Weapon",
    slot: "Weapon_3",
    skillWeapon: "Frost Bow",
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
            atMs: 360,
            coefficient: 0.25,
          },
          {
            atMs: 360,
            coefficient: 0.25,
          },
          {
            atMs: 360,
            coefficient: 0.25,
          },
          {
            atMs: 360,
            coefficient: 0.25,
          },
          {
            atMs: 360,
            coefficient: 0.25,
          },
          {
            atMs: 360,
            coefficient: 0.25,
          },
          {
            atMs: 360,
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
            atMs: 360,
            condition: "Chilled",
            stacks: 1,
            duration: 1,
          },
          {
            atMs: 360,
            condition: "Chilled",
            stacks: 1,
            duration: 1,
          },
          {
            atMs: 360,
            condition: "Chilled",
            stacks: 1,
            duration: 1,
          },
          {
            atMs: 360,
            condition: "Chilled",
            stacks: 1,
            duration: 1,
          },
          {
            atMs: 360,
            condition: "Chilled",
            stacks: 1,
            duration: 1,
          },
          {
            atMs: 360,
            condition: "Chilled",
            stacks: 1,
            duration: 1,
          },
          {
            atMs: 360,
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
  {
    id: 1100109,
    name: "Frost Storm",
    type: "Weapon",
    slot: "Weapon_4",
    skillWeapon: "Frost Bow",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 2360,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1560,
            coefficient: 0.7,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1980,
            coefficient: 0.63,
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
            atMs: 2280,
            coefficient: 0.56,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2280,
            condition: "Bleeding",
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
            atMs: 2340,
            coefficient: 0.49,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2340,
            condition: "Bleeding",
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
            atMs: 2700,
            coefficient: 0.42,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2700,
            condition: "Bleeding",
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
            atMs: 2700,
            coefficient: 0.35,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2700,
            condition: "Bleeding",
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
            atMs: 3000,
            coefficient: 0.28,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 3000,
            condition: "Bleeding",
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
            atMs: 3060,
            coefficient: 0.21,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 3060,
            condition: "Bleeding",
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
            atMs: 3420,
            coefficient: 0.14,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 3420,
            condition: "Bleeding",
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
            atMs: 3420,
            coefficient: 0.14,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 3420,
            condition: "Bleeding",
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
            atMs: 3720,
            coefficient: 0.14,
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
            atMs: 3780,
            coefficient: 0.14,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 3780,
            condition: "Bleeding",
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
            atMs: 4140,
            coefficient: 0.14,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 4140,
            condition: "Bleeding",
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
            atMs: 4140,
            coefficient: 0.14,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 4140,
            condition: "Bleeding",
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
            atMs: 4440,
            coefficient: 0.14,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 4440,
            condition: "Bleeding",
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
            atMs: 4500,
            coefficient: 0.14,
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
            atMs: 4860,
            coefficient: 0.14,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 4860,
            condition: "Bleeding",
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
            atMs: 4860,
            coefficient: 0.14,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 4860,
            condition: "Bleeding",
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
            atMs: 5220,
            coefficient: 0.14,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 5220,
            condition: "Bleeding",
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
            atMs: 5580,
            coefficient: 0.14,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 5580,
            condition: "Bleeding",
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
            atMs: 5940,
            coefficient: 0.14,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 5940,
            condition: "Bleeding",
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
            atMs: 6360,
            coefficient: 0.14,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 6360,
            condition: "Bleeding",
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
            atMs: 6720,
            coefficient: 0.14,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 6720,
            condition: "Bleeding",
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
            atMs: 7080,
            coefficient: 0.14,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 7080,
            condition: "Bleeding",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100110,
    name: "Deep Freeze",
    type: "Weapon",
    slot: "Weapon_5",
    skillWeapon: "Frost Bow",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 1120,
    cooldown: 30,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1680,
            coefficient: 0.8,
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
            atMs: 1680,
            condition: "Chilled",
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
        atMs: 1680,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
        },
      },
    ],
  },
  {
    id: 1100111,
    name: "Lightning Swing",
    type: "Weapon",
    slot: "Weapon_1",
    skillWeapon: "Lightning Hammer",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 480,
    cooldown: 0,
    nextChainId: 1100112,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
            coefficient: 1,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100112,
    name: "Static Swing",
    type: "Weapon",
    slot: "Weapon_1",
    skillWeapon: "Lightning Hammer",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 640,
    cooldown: 0,
    nextChainId: 1100113,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 480,
            coefficient: 1,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100113,
    name: "Thunderclap",
    type: "Weapon",
    slot: "Weapon_1",
    skillWeapon: "Lightning Hammer",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: 1100111,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 480,
            coefficient: 1.5,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "blind",
        atMs: 480,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "blind",
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100114,
    name: "Lightning Leap",
    type: "Weapon",
    slot: "Weapon_2",
    skillWeapon: "Lightning Hammer",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 960,
    cooldown: 8,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1200,
            coefficient: 1,
            metadata: {
              finisherType: "Leap",
              finisherValue: 1,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "boon",
        boon: "Quickness",
        stacks: 1,
        duration: 3,
        durationScale: "boon",
        atMs: 1200,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Leap",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100115,
    name: "Wind Blast",
    type: "Weapon",
    slot: "Weapon_3",
    skillWeapon: "Lightning Hammer",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 960,
    cooldown: 18,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1020,
            coefficient: 0.33,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "boon",
        boon: "Superspeed",
        stacks: 1,
        duration: 3,
        durationScale: "boon",
        atMs: 1020,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "control",
        atMs: 1020,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
        },
      },
    ],
  },
  {
    id: 1100116,
    name: "Invoke Lightning",
    type: "Weapon",
    slot: "Weapon_4",
    skillWeapon: "Lightning Hammer",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 920,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
            coefficient: 0.825,
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
            coefficient: 0.7425,
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
            coefficient: 0.66,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 720,
            coefficient: 0.5775,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 720,
            coefficient: 0.495,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 720,
            coefficient: 0.4125,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 900,
            coefficient: 0.33,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 900,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 900,
            coefficient: 0.24,
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
            coefficient: 0.24,
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
            coefficient: 0.24,
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
            coefficient: 0.24,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1320,
            coefficient: 0.24,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1320,
            coefficient: 0.24,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1320,
            coefficient: 0.24,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1320,
            coefficient: 0.24,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1320,
            coefficient: 0.24,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1320,
            coefficient: 0.24,
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
            coefficient: 0.24,
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
            coefficient: 0.24,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100117,
    name: "Static Field",
    type: "Weapon",
    slot: "Weapon_5",
    skillWeapon: "Lightning Hammer",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 760,
    cooldown: 25,
    comboField: "Lightning",
    fieldDuration: 4,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 270,
            coefficient: 0.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "control",
        atMs: 270,
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
            atMs: 1020,
            coefficient: 0.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "control",
        atMs: 1020,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
        },
      },
    ],
  },
  {
    id: 1100118,
    name: "Glyph of Elemental Power (Fire)",
    type: "Utility",
    slot: "Utility",
    attunement: "Fire",
    categories: ["Glyph"],
    quicknessCastTimeMs: 480,
    cooldown: 25,
    skillFamily: "Glyph",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 600,
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
            atMs: 600,
            condition: "Burning",
            stacks: 3,
            duration: 6,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100119,
    name: "Glyph of Elemental Power (Water)",
    type: "Utility",
    slot: "Utility",
    attunement: "Water",
    categories: ["Glyph"],
    quicknessCastTimeMs: 480,
    cooldown: 25,
    skillFamily: "Glyph",
    implemented: true,
    effects: [],
  },
  {
    id: 1100120,
    name: "Glyph of Elemental Power (Air)",
    type: "Utility",
    slot: "Utility",
    attunement: "Air",
    categories: ["Glyph"],
    quicknessCastTimeMs: 480,
    cooldown: 25,
    skillFamily: "Glyph",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 600,
            coefficient: 0.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "control",
        atMs: 600,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
        },
      },
    ],
  },
  {
    id: 1100121,
    name: "Glyph of Elemental Power (Earth)",
    type: "Utility",
    slot: "Utility",
    attunement: "Earth",
    categories: ["Glyph"],
    quicknessCastTimeMs: 480,
    cooldown: 25,
    skillFamily: "Glyph",
    implemented: true,
    effects: [],
  },
  {
    id: 1100122,
    name: "Glyph of Storms (Fire)",
    type: "Utility",
    slot: "Utility",
    attunement: "Fire",
    categories: ["Glyph"],
    quicknessCastTimeMs: 1120,
    cooldown: 25,
    skillFamily: "Glyph",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1320,
            coefficient: 0.5,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 2820,
            coefficient: 0.5,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 4320,
            coefficient: 0.5,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 5820,
            coefficient: 0.5,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 7320,
            coefficient: 0.5,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 8820,
            coefficient: 0.5,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 10320,
            coefficient: 0.5,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 11820,
            coefficient: 0.5,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 13320,
            coefficient: 0.5,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 14820,
            coefficient: 0.5,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 16320,
            coefficient: 0.5,
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
            atMs: 1320,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 2820,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 4320,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 5820,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 7320,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 8820,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 10320,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 11820,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 13320,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 14820,
            condition: "Burning",
            stacks: 1,
            duration: 2,
          },
          {
            atMs: 16320,
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
  {
    id: 1100123,
    name: "Glyph of Storms (Water)",
    type: "Utility",
    slot: "Utility",
    attunement: "Water",
    categories: ["Glyph"],
    quicknessCastTimeMs: 1120,
    cooldown: 30,
    skillFamily: "Glyph",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 2400,
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
            atMs: 2400,
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
            atMs: 2880,
            coefficient: 0.72,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2880,
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
            atMs: 3360,
            coefficient: 0.64,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 3360,
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
            atMs: 3840,
            coefficient: 0.56,
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
            atMs: 4320,
            coefficient: 0.48,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 4320,
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
            atMs: 4800,
            coefficient: 0.4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 4800,
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
            atMs: 5280,
            coefficient: 0.32,
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
            atMs: 5760,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 5760,
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
            atMs: 6240,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 6240,
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
            atMs: 6720,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 6720,
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
            atMs: 7200,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 7200,
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
            atMs: 7680,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 7680,
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
            atMs: 8160,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 8160,
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
            atMs: 8640,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 8640,
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
            atMs: 9120,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 9120,
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
            atMs: 9600,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 9600,
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
            atMs: 10080,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 10080,
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
            atMs: 10560,
            coefficient: 0.32,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 10560,
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
  },
  {
    id: 1100124,
    name: "Glyph of Storms (Air)",
    type: "Utility",
    slot: "Utility",
    attunement: "Air",
    categories: ["Glyph"],
    quicknessCastTimeMs: 1120,
    cooldown: 60,
    skillFamily: "Glyph",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1320,
            coefficient: 0.825,
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
            condition: "Vulnerability",
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
            atMs: 1320,
            coefficient: 0.78375,
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
            condition: "Vulnerability",
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
            atMs: 1320,
            coefficient: 0.7425,
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
            condition: "Vulnerability",
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
            atMs: 2100,
            coefficient: 0.70125,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2100,
            condition: "Vulnerability",
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
            atMs: 2340,
            coefficient: 0.66,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2340,
            condition: "Vulnerability",
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
            atMs: 2520,
            coefficient: 0.61875,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2520,
            condition: "Vulnerability",
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
            atMs: 2835,
            coefficient: 0.5775,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2835,
            condition: "Vulnerability",
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
            atMs: 3300,
            coefficient: 0.53625,
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
            condition: "Vulnerability",
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
            atMs: 3600,
            coefficient: 0.495,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 3600,
            condition: "Vulnerability",
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
            atMs: 3720,
            coefficient: 0.45375,
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
            condition: "Vulnerability",
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
            atMs: 4260,
            coefficient: 0.4125,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 4260,
            condition: "Vulnerability",
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
            atMs: 4320,
            coefficient: 0.37125,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 4320,
            condition: "Vulnerability",
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
            condition: "Vulnerability",
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
            atMs: 5100,
            coefficient: 0.28875,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 5100,
            condition: "Vulnerability",
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
            atMs: 5220,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 5220,
            condition: "Vulnerability",
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
            atMs: 5820,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 5820,
            condition: "Vulnerability",
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
            atMs: 6120,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 6120,
            condition: "Vulnerability",
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
            atMs: 6240,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 6240,
            condition: "Vulnerability",
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
            atMs: 6600,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 6600,
            condition: "Vulnerability",
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
            atMs: 7200,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 7200,
            condition: "Vulnerability",
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
            atMs: 7320,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 7320,
            condition: "Vulnerability",
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
            atMs: 7320,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 7320,
            condition: "Vulnerability",
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
            atMs: 8100,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 8100,
            condition: "Vulnerability",
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
            atMs: 8160,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 8160,
            condition: "Vulnerability",
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
            atMs: 8520,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 8520,
            condition: "Vulnerability",
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
            atMs: 8820,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 8820,
            condition: "Vulnerability",
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
            atMs: 9120,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 9120,
            condition: "Vulnerability",
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
            atMs: 9600,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 9600,
            condition: "Vulnerability",
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
            atMs: 9720,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 9720,
            condition: "Vulnerability",
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
            atMs: 10140,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 10140,
            condition: "Vulnerability",
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
            atMs: 10935,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 10935,
            condition: "Vulnerability",
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
            atMs: 11100,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 11100,
            condition: "Vulnerability",
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
            atMs: 12060,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 12060,
            condition: "Vulnerability",
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
            atMs: 12120,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 12120,
            condition: "Vulnerability",
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
            atMs: 13320,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 13320,
            condition: "Vulnerability",
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
            atMs: 14520,
            coefficient: 0.2475,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 14520,
            condition: "Vulnerability",
            stacks: 2,
            duration: 8,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100125,
    name: "Glyph of Storms (Earth)",
    type: "Utility",
    slot: "Utility",
    attunement: "Earth",
    categories: ["Glyph"],
    quicknessCastTimeMs: 1120,
    cooldown: 40,
    skillFamily: "Glyph",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1320,
            coefficient: 0.045454545454545456,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 2820,
            coefficient: 0.045454545454545456,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 4320,
            coefficient: 0.045454545454545456,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 5820,
            coefficient: 0.045454545454545456,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 7320,
            coefficient: 0.045454545454545456,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 8820,
            coefficient: 0.045454545454545456,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 10320,
            coefficient: 0.045454545454545456,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 11820,
            coefficient: 0.045454545454545456,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 13320,
            coefficient: 0.045454545454545456,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 14820,
            coefficient: 0.045454545454545456,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 16320,
            coefficient: 0.045454545454545456,
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
            atMs: 1320,
            condition: "Bleeding",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 2820,
            condition: "Bleeding",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 4320,
            condition: "Bleeding",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 5820,
            condition: "Bleeding",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 7320,
            condition: "Bleeding",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 8820,
            condition: "Bleeding",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 10320,
            condition: "Bleeding",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 11820,
            condition: "Bleeding",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 13320,
            condition: "Bleeding",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 14820,
            condition: "Bleeding",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 16320,
            condition: "Bleeding",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "blind",
        atMs: 1320,
        applications: 11,
        intervalMs: 1500,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "blind",
        },
      },
    ],
  },
  {
    id: 1100126,
    name: "Signet of Fire",
    type: "Utility",
    slot: "Utility",
    categories: ["Signet"],
    quicknessCastTimeMs: 520,
    cooldown: 12,
    skillFamily: "Signet",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 660,
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
            atMs: 660,
            condition: "Burning",
            stacks: 2,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100127,
    name: "Signet of Earth",
    type: "Utility",
    slot: "Utility",
    categories: ["Signet"],
    quicknessCastTimeMs: 520,
    cooldown: 15,
    skillFamily: "Signet",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 660,
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
            atMs: 660,
            condition: "Bleeding",
            stacks: 4,
            duration: 9,
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
            atMs: 660,
            condition: "Immobilize",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100128,
    name: "Conjure Fiery Greatsword",
    type: "Elite",
    slot: "Elite",
    categories: ["Conjure"],
    quicknessCastTimeMs: 1160,
    cooldown: 180,
    skillFamily: "Conjure",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 2160,
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
            atMs: 2160,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100129,
    name: "Flame Wave",
    type: "Weapon",
    slot: "Weapon_1",
    skillWeapon: "Fiery Greatsword",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 2160,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
            coefficient: 0.65,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1200,
            coefficient: 0.65,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1860,
            coefficient: 0.65,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 2520,
            coefficient: 0.65,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100130,
    name: "Fiery Eruption",
    type: "Weapon",
    slot: "Weapon_2",
    skillWeapon: "Fiery Greatsword",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 720,
    cooldown: 5,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "condition",
        ticks: [
          {
            atMs: 1080,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 2580,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 4080,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 5580,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 7080,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 8580,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100131,
    name: "Fiery Whirl",
    type: "Weapon",
    slot: "Weapon_3",
    skillWeapon: "Fiery Greatsword",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 1320,
    cooldown: 5,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 420,
            coefficient: 0.688,
            metadata: {
              finisherType: "Whirl",
              finisherValue: 1,
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
            atMs: 420,
            condition: "Cripple",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Whirl",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 600,
            coefficient: 0.688,
            metadata: {
              finisherType: "Whirl",
              finisherValue: 1,
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
            atMs: 600,
            condition: "Cripple",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Whirl",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 795,
            coefficient: 0.688,
            metadata: {
              finisherType: "Whirl",
              finisherValue: 1,
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
            atMs: 795,
            condition: "Cripple",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Whirl",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 960,
            coefficient: 0.688,
            metadata: {
              finisherType: "Whirl",
              finisherValue: 1,
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
            atMs: 960,
            condition: "Cripple",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Whirl",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1140,
            coefficient: 0.688,
            metadata: {
              finisherType: "Whirl",
              finisherValue: 1,
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
            atMs: 1140,
            condition: "Cripple",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Whirl",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1320,
            coefficient: 0.688,
            metadata: {
              finisherType: "Whirl",
              finisherValue: 1,
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
            atMs: 1320,
            condition: "Cripple",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Whirl",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1485,
            coefficient: 0.688,
            metadata: {
              finisherType: "Whirl",
              finisherValue: 1,
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
            atMs: 1485,
            condition: "Cripple",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Whirl",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1695,
            coefficient: 0.688,
            metadata: {
              finisherType: "Whirl",
              finisherValue: 1,
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
            atMs: 1695,
            condition: "Cripple",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Whirl",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100132,
    name: "Fiery Rush",
    type: "Weapon",
    slot: "Weapon_4",
    skillWeapon: "Fiery Greatsword",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 1280,
    cooldown: 10,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1620,
            coefficient: 2,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100133,
    name: "Firestorm",
    type: "Weapon",
    slot: "Weapon_5",
    skillWeapon: "Fiery Greatsword",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 760,
    cooldown: 15,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 780,
            coefficient: 0.65,
          },
          {
            atMs: 2280,
            coefficient: 0.65,
          },
          {
            atMs: 3780,
            coefficient: 0.65,
          },
          {
            atMs: 5280,
            coefficient: 0.65,
          },
          {
            atMs: 6780,
            coefficient: 0.65,
          },
          {
            atMs: 8280,
            coefficient: 0.65,
          },
          {
            atMs: 9780,
            coefficient: 0.65,
          },
          {
            atMs: 11280,
            coefficient: 0.65,
          },
          {
            atMs: 12780,
            coefficient: 0.65,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100134,
    name: "Overload Fire",
    type: "Profession",
    slot: "Profession_1",
    specialization: "Tempest",
    attunement: "Fire",
    mechanicSlot: 1,
    categories: ["Attunement"],
    quicknessCastTimeMs: 3320,
    cooldown: 20,
    comboField: "Fire",
    fieldDuration: 9,
    rechargeAnchor: "castEnd",
    overload: true,
    skillFamily: "Attunement",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 420,
            coefficient: 0.9,
            metadata: {
              finisherType: "Whirl",
              finisherValue: 2,
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
            atMs: 420,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Whirl",
          finisherValue: 2,
        },
      },
      {
        type: "boon",
        boon: "Might",
        stacks: 2,
        duration: 16,
        durationScale: "boon",
        atMs: 420,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Whirl",
          finisherValue: 2,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1140,
            coefficient: 0.9,
            metadata: {
              finisherType: "Whirl",
              finisherValue: 2,
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
            atMs: 1140,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Whirl",
          finisherValue: 2,
        },
      },
      {
        type: "boon",
        boon: "Might",
        stacks: 2,
        duration: 16,
        durationScale: "boon",
        atMs: 1140,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Whirl",
          finisherValue: 2,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1875,
            coefficient: 0.9,
            metadata: {
              finisherType: "Whirl",
              finisherValue: 2,
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
            atMs: 1875,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Whirl",
          finisherValue: 2,
        },
      },
      {
        type: "boon",
        boon: "Might",
        stacks: 2,
        duration: 16,
        durationScale: "boon",
        atMs: 1875,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Whirl",
          finisherValue: 2,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 2595,
            coefficient: 0.9,
            metadata: {
              finisherType: "Whirl",
              finisherValue: 1,
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
            atMs: 2595,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Whirl",
          finisherValue: 1,
        },
      },
      {
        type: "boon",
        boon: "Might",
        stacks: 2,
        duration: 16,
        durationScale: "boon",
        atMs: 2595,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Whirl",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 4800,
            coefficient: 0.9,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 4800,
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
        type: "boon",
        boon: "Might",
        stacks: 2,
        duration: 16,
        durationScale: "boon",
        atMs: 4800,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 6300,
            coefficient: 0.9,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 6300,
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
        type: "boon",
        boon: "Might",
        stacks: 2,
        duration: 16,
        durationScale: "boon",
        atMs: 6300,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 7800,
            coefficient: 0.9,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 7800,
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
        type: "boon",
        boon: "Might",
        stacks: 2,
        duration: 16,
        durationScale: "boon",
        atMs: 7800,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 9300,
            coefficient: 0.9,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 9300,
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
        type: "boon",
        boon: "Might",
        stacks: 2,
        duration: 16,
        durationScale: "boon",
        atMs: 9300,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 10800,
            coefficient: 0.9,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 10800,
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
        type: "boon",
        boon: "Might",
        stacks: 2,
        duration: 16,
        durationScale: "boon",
        atMs: 10800,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 12300,
            coefficient: 0.9,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 12300,
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
        type: "boon",
        boon: "Might",
        stacks: 2,
        duration: 16,
        durationScale: "boon",
        atMs: 12300,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100135,
    name: "Overload Water",
    type: "Profession",
    slot: "Profession_2",
    specialization: "Tempest",
    attunement: "Water",
    mechanicSlot: 2,
    categories: ["Attunement"],
    quicknessCastTimeMs: 2920,
    cooldown: 20,
    rechargeAnchor: "castEnd",
    overload: true,
    skillFamily: "Attunement",
    implemented: true,
    effects: [],
  },
  {
    id: 1100136,
    name: "Overload Air",
    type: "Profession",
    slot: "Profession_3",
    specialization: "Tempest",
    attunement: "Air",
    mechanicSlot: 3,
    categories: ["Attunement"],
    quicknessCastTimeMs: 3200,
    cooldown: 20,
    comboField: "Lightning",
    fieldDuration: 4,
    rechargeAnchor: "castEnd",
    overload: true,
    skillFamily: "Attunement",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1080,
            coefficient: 0.85,
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
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 1080,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1680,
            coefficient: 0.85,
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
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 1680,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 2280,
            coefficient: 0.85,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2280,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 2280,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 2880,
            coefficient: 0.85,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2880,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 2880,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 3480,
            coefficient: 0.85,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 3480,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 3480,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 4080,
            coefficient: 0.85,
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
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 4080,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 4680,
            coefficient: 0.85,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 4680,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 4680,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 5460,
            coefficient: 0.85,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 5460,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 5460,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 6240,
            coefficient: 0.85,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 6240,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 6240,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 7020,
            coefficient: 0.85,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 7020,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 7020,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 7815,
            coefficient: 0.85,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 7815,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 7815,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 8580,
            coefficient: 0.85,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 8580,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 8580,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 9360,
            coefficient: 0.85,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 9360,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 9360,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 10140,
            coefficient: 0.85,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 10140,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 10140,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100137,
    name: "Overload Earth",
    type: "Profession",
    slot: "Profession_4",
    specialization: "Tempest",
    attunement: "Earth",
    mechanicSlot: 4,
    categories: ["Attunement"],
    quicknessCastTimeMs: 2760,
    cooldown: 20,
    rechargeAnchor: "castEnd",
    overload: true,
    skillFamily: "Attunement",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 120,
            coefficient: 0.75,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 120,
            condition: "Bleeding",
            stacks: 1,
            duration: 9,
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
            atMs: 120,
            condition: "Cripple",
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
        boon: "Stability",
        stacks: 3,
        duration: 4,
        durationScale: "boon",
        atMs: 120,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Protection",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 120,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1200,
            coefficient: 0.75,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 1200,
            condition: "Bleeding",
            stacks: 1,
            duration: 9,
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
            atMs: 1200,
            condition: "Cripple",
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
        boon: "Protection",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 1200,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 2280,
            coefficient: 0.75,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2280,
            condition: "Bleeding",
            stacks: 1,
            duration: 9,
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
            atMs: 2280,
            condition: "Cripple",
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
        boon: "Protection",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 2280,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 3360,
            coefficient: 0.75,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 3360,
            condition: "Bleeding",
            stacks: 1,
            duration: 9,
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
            atMs: 3360,
            condition: "Cripple",
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
        boon: "Protection",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 3360,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 4140,
            coefficient: 0.75,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
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
            atMs: 4140,
            condition: "Bleeding",
            stacks: 1,
            duration: 9,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 4140,
            condition: "Cripple",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 4140,
            condition: "Immobilize",
            stacks: 1,
            duration: 4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
      {
        type: "boon",
        boon: "Protection",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 4140,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 5640,
            coefficient: 0.75,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 5640,
            condition: "Bleeding",
            stacks: 1,
            duration: 9,
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
            atMs: 5640,
            condition: "Cripple",
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
        boon: "Protection",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 5640,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 7140,
            coefficient: 0.75,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 7140,
            condition: "Bleeding",
            stacks: 1,
            duration: 9,
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
            atMs: 7140,
            condition: "Cripple",
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
        boon: "Protection",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 7140,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 8640,
            coefficient: 0.75,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 8640,
            condition: "Bleeding",
            stacks: 1,
            duration: 9,
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
            atMs: 8640,
            condition: "Cripple",
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
        boon: "Protection",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 8640,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 10140,
            coefficient: 0.75,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 10140,
            condition: "Bleeding",
            stacks: 1,
            duration: 9,
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
            atMs: 10140,
            condition: "Cripple",
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
        boon: "Protection",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 10140,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100138,
    name: "Wash the Pain Away!",
    type: "Heal",
    slot: "Heal",
    specialization: "Tempest",
    categories: ["Shout"],
    quicknessCastTimeMs: 1040,
    cooldown: 20,
    skillFamily: "Shout",
    implemented: true,
    effects: [],
  },
  {
    id: 1100139,
    name: "Feel the Burn!",
    type: "Utility",
    slot: "Utility",
    specialization: "Tempest",
    categories: ["Shout"],
    quicknessCastTimeMs: 0,
    cooldown: 25,
    aura: "Fire|4",
    skillFamily: "Shout",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 0,
            coefficient: 2.5,
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
            stacks: 2,
            duration: 4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 10,
        durationScale: "boon",
        atMs: 0,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Might",
        stacks: 8,
        duration: 15,
        durationScale: "boon",
        atMs: 0,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100140,
    name: "Aftershock!",
    type: "Utility",
    slot: "Utility",
    specialization: "Tempest",
    categories: ["Shout"],
    quicknessCastTimeMs: 0,
    cooldown: 30,
    aura: "Magnetic|4",
    skillFamily: "Shout",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 200,
            coefficient: 0.75,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 200,
            condition: "Cripple",
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
        boon: "Protection",
        stacks: 1,
        duration: 5,
        durationScale: "boon",
        atMs: 200,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Aegis",
        stacks: 1,
        duration: 5,
        durationScale: "boon",
        atMs: 200,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1200,
            coefficient: 0.75,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
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
            atMs: 1200,
            condition: "Immobilize",
            stacks: 1,
            duration: 2,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100141,
    name: "Steam Surge",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Dagger",
    attunement: "Fire+Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 560,
    cooldown: 18,
    comboField: "Water",
    fieldDuration: 4,
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
  },
  {
    id: 1100142,
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
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
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
            atMs: 720,
            condition: "Burning",
            stacks: 1,
            duration: 6,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100143,
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
  },
  {
    id: 1100144,
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
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
            },
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
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
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
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
      {
        type: "control",
        atMs: 351,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
          finisherType: "Blast",
          finisherValue: 1,
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
  },
  {
    id: 1100145,
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
  },
  {
    id: 1100146,
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
  },
  {
    id: 1100147,
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
  },
  {
    id: 1100148,
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
  },
  {
    id: 1100149,
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
  },
  {
    id: 1100150,
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
  },
  {
    id: 1100151,
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
  },
  {
    id: 1100152,
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
  },
  {
    id: 1100153,
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
  },
  {
    id: 1100154,
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
  },
  {
    id: 1100155,
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
  },
  {
    id: 1100156,
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
  },
  {
    id: 1100157,
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
  },
  {
    id: 1100158,
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
  },
  {
    id: 1100159,
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
  },
  {
    id: 1100160,
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
  },
  {
    id: 1100161,
    name: "Pyroclastic Blast",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Staff",
    attunement: "Fire+Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 15,
    comboField: "Fire",
    fieldDuration: 4,
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
  },
  {
    id: 1100162,
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
  },
  {
    id: 1100163,
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
  },
  {
    id: 1100164,
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
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
            },
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
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100165,
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
  {
    id: 1100166,
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
  {
    id: 1100167,
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
  {
    id: 1100168,
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
  {
    id: 1100169,
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
  {
    id: 1100170,
    name: "Weave Self",
    type: "Elite",
    slot: "Elite",
    specialization: "Weaver",
    categories: ["Stance"],
    quicknessCastTimeMs: 800,
    cooldown: 90,
    nextChainId: 1100171,
    skillFamily: "Stance",
    implemented: true,
    effects: [],
  },
  {
    id: 1100171,
    name: "Tailored Victory",
    type: "Elite",
    slot: "Elite",
    specialization: "Weaver",
    categories: ["Stance"],
    quicknessCastTimeMs: 560,
    cooldown: 0,
    nextChainId: 1100170,
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
  {
    id: 1100172,
    name: "Deploy Jade Sphere (Fire)",
    type: "Profession",
    slot: "Profession_5",
    specialization: "Catalyst",
    attunement: "Fire",
    mechanicSlot: 5,
    categories: ["Jade Sphere"],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    comboField: "Fire",
    fieldDuration: 5,
    skillFamily: "Jade Sphere",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 0,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 1000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 2000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 3000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 4000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 5000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "boon",
        boon: "Might",
        stacks: 1,
        duration: 10,
        durationScale: "boon",
        atMs: 0,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Might",
        stacks: 1,
        duration: 10,
        durationScale: "boon",
        atMs: 1000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Might",
        stacks: 1,
        duration: 10,
        durationScale: "boon",
        atMs: 2000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Might",
        stacks: 1,
        duration: 10,
        durationScale: "boon",
        atMs: 3000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Might",
        stacks: 1,
        duration: 10,
        durationScale: "boon",
        atMs: 4000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Might",
        stacks: 1,
        duration: 10,
        durationScale: "boon",
        atMs: 5000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100173,
    name: "Deploy Jade Sphere (Water)",
    type: "Profession",
    slot: "Profession_5",
    specialization: "Catalyst",
    attunement: "Water",
    mechanicSlot: 5,
    categories: ["Jade Sphere"],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    comboField: "Water",
    fieldDuration: 5,
    skillFamily: "Jade Sphere",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 0,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 1000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 2000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 3000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 4000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 5000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "boon",
        boon: "Resolution",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 0,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Resolution",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 1000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Resolution",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 2000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Resolution",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 3000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Resolution",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 4000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Resolution",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 5000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100174,
    name: "Deploy Jade Sphere (Air)",
    type: "Profession",
    slot: "Profession_5",
    specialization: "Catalyst",
    attunement: "Air",
    mechanicSlot: 5,
    categories: ["Jade Sphere"],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    comboField: "Lightning",
    fieldDuration: 5,
    skillFamily: "Jade Sphere",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 0,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 1000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 2000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 3000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 4000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 5000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
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
        duration: 1,
        durationScale: "boon",
        atMs: 1000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 2000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 3000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 4000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 5000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100175,
    name: "Deploy Jade Sphere (Earth)",
    type: "Profession",
    slot: "Profession_5",
    specialization: "Catalyst",
    attunement: "Earth",
    mechanicSlot: 5,
    categories: ["Jade Sphere"],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    comboField: "Poison",
    fieldDuration: 5,
    skillFamily: "Jade Sphere",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 0,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 1000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 2000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 3000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 4000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
          {
            atMs: 5000,
            coefficient: 0.25,
            metadata: {
              damageKind: "field-tick",
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "boon",
        boon: "Protection",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 0,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Protection",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 1000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Protection",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 2000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Protection",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 3000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Protection",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 4000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Protection",
        stacks: 1,
        duration: 1,
        durationScale: "boon",
        atMs: 5000,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100176,
    name: "Relentless Fire",
    type: "Utility",
    slot: "Utility",
    specialization: "Catalyst",
    categories: ["Augment"],
    quicknessCastTimeMs: 240,
    cooldown: 20,
    skillFamily: "Augment",
    implemented: true,
    effects: [],
  },
  {
    id: 1100177,
    name: "Shattering Ice",
    type: "Utility",
    slot: "Utility",
    specialization: "Catalyst",
    categories: ["Augment"],
    quicknessCastTimeMs: 240,
    cooldown: 20,
    skillFamily: "Augment",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 300,
            coefficient: 0.6,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 300,
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
  {
    id: 1100178,
    name: "Elemental Celerity",
    type: "Elite",
    slot: "Elite",
    specialization: "Catalyst",
    categories: ["Augment"],
    quicknessCastTimeMs: 240,
    cooldown: 90,
    skillFamily: "Augment",
    implemented: true,
    effects: [],
  },
  {
    id: 1100179,
    name: "Ignite",
    type: "Profession",
    slot: "Profession_5",
    specialization: "Evoker",
    attunement: "Fire",
    mechanicSlot: 5,
    categories: ["Familiar"],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    nextChainId: 1100180,
    skillFamily: "Familiar",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 880,
            coefficient: 0.63,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 880,
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
  {
    id: 1100180,
    name: "Conflagration",
    type: "Profession",
    slot: "Profession_5",
    specialization: "Evoker",
    attunement: "Fire",
    mechanicSlot: 5,
    categories: ["Familiar"],
    quicknessCastTimeMs: 360,
    cooldown: 0,
    nextChainId: 1100179,
    skillFamily: "Familiar",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1560,
            coefficient: 1.56,
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
            condition: "Burning",
            stacks: 2,
            duration: 4.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100181,
    name: "Splash",
    type: "Profession",
    slot: "Profession_5",
    specialization: "Evoker",
    attunement: "Water",
    mechanicSlot: 5,
    categories: ["Familiar"],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    nextChainId: 1100182,
    skillFamily: "Familiar",
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "Regeneration",
        stacks: 1,
        duration: 4,
        durationScale: "boon",
        atMs: 0,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100182,
    name: "Buoyant Deluge",
    type: "Profession",
    slot: "Profession_5",
    specialization: "Evoker",
    attunement: "Water",
    mechanicSlot: 5,
    categories: ["Familiar"],
    quicknessCastTimeMs: 360,
    cooldown: 0,
    nextChainId: 1100181,
    comboField: "Water",
    fieldDuration: 4,
    skillFamily: "Familiar",
    implemented: true,
    effects: [
      {
        type: "control",
        atMs: 3300,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
        },
      },
    ],
  },
  {
    id: 1100183,
    name: "Zap",
    type: "Profession",
    slot: "Profession_5",
    specialization: "Evoker",
    attunement: "Air",
    mechanicSlot: 5,
    categories: ["Familiar"],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    nextChainId: 1100184,
    skillFamily: "Familiar",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 520,
            coefficient: 0.6,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100184,
    name: "Lightning Blitz",
    type: "Profession",
    slot: "Profession_5",
    specialization: "Evoker",
    attunement: "Air",
    mechanicSlot: 5,
    categories: ["Familiar"],
    quicknessCastTimeMs: 360,
    cooldown: 0,
    nextChainId: 1100183,
    skillFamily: "Familiar",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1680,
            coefficient: 0.27999999999999997,
          },
          {
            atMs: 2040,
            coefficient: 0.27999999999999997,
          },
          {
            atMs: 2400,
            coefficient: 0.27999999999999997,
          },
          {
            atMs: 2760,
            coefficient: 0.27999999999999997,
          },
          {
            atMs: 3120,
            coefficient: 0.27999999999999997,
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
            condition: "Weakness",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 2040,
            condition: "Weakness",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 2400,
            condition: "Weakness",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 2760,
            condition: "Weakness",
            stacks: 1,
            duration: 3,
          },
          {
            atMs: 3120,
            condition: "Weakness",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100185,
    name: "Calcify",
    type: "Profession",
    slot: "Profession_5",
    specialization: "Evoker",
    attunement: "Earth",
    mechanicSlot: 5,
    categories: ["Familiar"],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    nextChainId: 1100186,
    skillFamily: "Familiar",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 200,
            coefficient: 0.65,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "control",
        atMs: 200,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
        },
      },
    ],
  },
  {
    id: 1100186,
    name: "Seismic Impact",
    type: "Profession",
    slot: "Profession_5",
    specialization: "Evoker",
    attunement: "Earth",
    mechanicSlot: 5,
    categories: ["Familiar"],
    quicknessCastTimeMs: 360,
    cooldown: 0,
    nextChainId: 1100185,
    skillFamily: "Familiar",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 3180,
            coefficient: 1.15,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
            },
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
            stacks: 6,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
      {
        type: "control",
        atMs: 3180,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100187,
    name: "Fox's Fury",
    type: "Utility",
    slot: "Utility",
    specialization: "Evoker",
    categories: ["Meditation"],
    quicknessCastTimeMs: 600,
    cooldown: 18,
    skillFamily: "Meditation",
    implemented: true,
    effects: [],
  },
  {
    id: 1100188,
    name: "Hare's Agility",
    type: "Utility",
    slot: "Utility",
    specialization: "Evoker",
    categories: ["Meditation"],
    quicknessCastTimeMs: 0,
    cooldown: 20,
    enduranceCost: 50,
    skillFamily: "Meditation",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 0,
            coefficient: 0.4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "boon",
        boon: "Swiftness",
        stacks: 1,
        duration: 10,
        durationScale: "boon",
        atMs: 0,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100189,
    name: "Toad's Fortitude",
    type: "Utility",
    slot: "Utility",
    specialization: "Evoker",
    categories: ["Meditation"],
    quicknessCastTimeMs: 640,
    cooldown: 15,
    skillFamily: "Meditation",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 960,
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
            atMs: 960,
            condition: "Bleeding",
            stacks: 4,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100190,
    name: "Elemental Procession",
    type: "Elite",
    slot: "Elite",
    specialization: "Evoker",
    categories: ["Meditation"],
    quicknessCastTimeMs: 600,
    cooldown: 60,
    skillFamily: "Meditation",
    implemented: true,
    effects: [],
  },
  {
    id: 1100191,
    name: "Rejuvenate",
    type: "Heal",
    slot: "Heal",
    specialization: "Evoker",
    categories: ["Meditation"],
    quicknessCastTimeMs: 600,
    cooldown: 18,
    skillFamily: "Meditation",
    implemented: true,
    effects: [],
  },
  {
    id: 1100192,
    name: "Flame Spear",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Spear",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 640,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 780,
            coefficient: 1.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100193,
    name: "Blazing Barrage",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Spear",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 560,
    cooldown: 6,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 660,
            coefficient: 2.6,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
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
            atMs: 660,
            condition: "Burning",
            stacks: 1,
            duration: 5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100194,
    name: "Seethe",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Spear",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 360,
    cooldown: 15,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 4,
        durationScale: "boon",
        atMs: 0,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Might",
        stacks: 5,
        duration: 10,
        durationScale: "boon",
        atMs: 0,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100195,
    name: "Meteor",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Spear",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 840,
            coefficient: 3.375,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100196,
    name: "Etching: Volcano",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Spear",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 240,
    cooldown: 25,
    comboField: "Fire",
    fieldDuration: 7,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "Might",
        stacks: 1,
        duration: 8,
        durationScale: "boon",
        atMs: 360,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100197,
    name: "Lesser Volcano",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Spear",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 600,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 2280,
            coefficient: 0.63,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 2700,
            coefficient: 0.567,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 3090,
            coefficient: 0.504,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 3540,
            coefficient: 0.441,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 3960,
            coefficient: 0.378,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 4380,
            coefficient: 0.315,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100198,
    name: "Volcano",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Spear",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 600,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 2340,
            coefficient: 1.21,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 2700,
            coefficient: 1.089,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 3180,
            coefficient: 0.968,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 3600,
            coefficient: 0.847,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 3960,
            coefficient: 0.726,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 4380,
            coefficient: 0.605,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 4860,
            coefficient: 0.484,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 5220,
            coefficient: 0.363,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 5640,
            coefficient: 0.242,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 6060,
            coefficient: 0.121,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 6480,
            coefficient: 0.05,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 6960,
            coefficient: 0.05,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100199,
    name: "Restorative Spear",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Spear",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 640,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 780,
            coefficient: 1,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100200,
    name: "Ice Beam",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Spear",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 840,
    cooldown: 6,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
            coefficient: 0.7,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 540,
            condition: "Chilled",
            stacks: 1,
            duration: 1,
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
            atMs: 780,
            coefficient: 0.7,
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
            condition: "Chilled",
            stacks: 1,
            duration: 1,
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
            atMs: 1080,
            coefficient: 0.7,
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
  {
    id: 1100201,
    name: "Ripple",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Spear",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 800,
    cooldown: 15,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [],
  },
  {
    id: 1100202,
    name: "Undertow",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Spear",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 600,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 720,
            coefficient: 1.7,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
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
  },
  {
    id: 1100203,
    name: "Etching: Jökulhlaup",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Spear",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 240,
    cooldown: 25,
    comboField: "Water",
    fieldDuration: 7,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [],
  },
  {
    id: 1100204,
    name: "Lesser Jökulhlaup",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Spear",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 600,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
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
    ],
  },
  {
    id: 1100205,
    name: "Jökulhlaup",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Spear",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 600,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 840,
            coefficient: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100206,
    name: "Lightning Javelin",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Spear",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 640,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 780,
            coefficient: 1.35,
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
  },
  {
    id: 1100207,
    name: "Fulgor",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Spear",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 560,
    cooldown: 6,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 720,
            coefficient: 0.4,
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
        type: "strike",
        ticks: [
          {
            atMs: 2220,
            coefficient: 0.4,
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
        type: "strike",
        ticks: [
          {
            atMs: 3720,
            coefficient: 0.4,
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
        type: "strike",
        ticks: [
          {
            atMs: 5220,
            coefficient: 0.4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 5220,
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
        type: "strike",
        ticks: [
          {
            atMs: 6720,
            coefficient: 0.4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 6720,
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
  },
  {
    id: 1100208,
    name: "Energize",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Spear",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "Superspeed",
        stacks: 1,
        duration: 4,
        durationScale: "boon",
        atMs: 0,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100209,
    name: "Twister",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Spear",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 600,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 780,
            coefficient: 1.84,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
            },
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
            condition: "Vulnerability",
            stacks: 10,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
      {
        type: "control",
        atMs: 780,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100210,
    name: "Etching: Derecho",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Spear",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 240,
    cooldown: 25,
    comboField: "Lightning",
    fieldDuration: 7,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 7,
        durationScale: "boon",
        atMs: 360,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100211,
    name: "Lesser Derecho",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Spear",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 600,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 840,
            coefficient: 2,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "control",
        atMs: 840,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
        },
      },
    ],
  },
  {
    id: 1100212,
    name: "Derecho",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Spear",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 600,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 840,
            coefficient: 4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "control",
        atMs: 840,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
        },
      },
    ],
  },
  {
    id: 1100213,
    name: "Stone Strike",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Spear",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 640,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 780,
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
    ],
  },
  {
    id: 1100214,
    name: "Earthen Spear",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Spear",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 6,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 900,
            coefficient: 3,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
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
            atMs: 900,
            condition: "Cripple",
            stacks: 1,
            duration: 5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100215,
    name: "Harden",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Spear",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 200,
    cooldown: 15,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [],
  },
  {
    id: 1100216,
    name: "Fissure",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Spear",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 840,
            coefficient: 3.375,
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
            condition: "Weakness",
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
            atMs: 840,
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
  },
  {
    id: 1100217,
    name: "Etching: Haboob",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Spear",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 240,
    cooldown: 25,
    comboField: "Dark",
    fieldDuration: 7,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [],
  },
  {
    id: 1100218,
    name: "Lesser Haboob",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Spear",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 600,
    cooldown: 0,
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
      {
        type: "blind",
        atMs: 840,
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
            atMs: 840,
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
  },
  {
    id: 1100219,
    name: "Haboob",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Spear",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 600,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 840,
            coefficient: 4.25,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "blind",
        atMs: 840,
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
            atMs: 840,
            condition: "Vulnerability",
            stacks: 5,
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
            atMs: 840,
            condition: "Weakness",
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
            atMs: 840,
            condition: "Cripple",
            stacks: 1,
            duration: 55,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100220,
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
  },
  {
    id: 1100221,
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
  },
  {
    id: 1100222,
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
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
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
            duration: 5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
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
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100223,
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
  },
  {
    id: 1100224,
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
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100225,
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
  },
  {
    id: 1100226,
    name: "Singeing Strike",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Hammer",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
            coefficient: 0.69,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 540,
            condition: "Burning",
            stacks: 1,
            duration: 1.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100227,
    name: "Surging Flames",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Hammer",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 880,
    cooldown: 8,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 900,
            coefficient: 2.07,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 900,
            condition: "Burning",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100228,
    name: "Flame Wheel",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Hammer",
    attunement: "Fire",
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
    ],
  },
  {
    id: 1100229,
    name: "Triple Sear",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Hammer",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 560,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 780,
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
            atMs: 780,
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
        type: "strike",
        ticks: [
          {
            atMs: 780,
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
            atMs: 780,
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
        type: "strike",
        ticks: [
          {
            atMs: 780,
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
            atMs: 780,
            condition: "Burning",
            stacks: 1,
            duration: 4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100230,
    name: "Molten End",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Hammer",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 760,
    cooldown: 25,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1080,
            coefficient: 2.8,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "boon",
        boon: "Fury",
        stacks: 1,
        duration: 10,
        durationScale: "boon",
        atMs: 1080,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
      {
        type: "boon",
        boon: "Might",
        stacks: 6,
        duration: 10,
        durationScale: "boon",
        atMs: 1080,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100231,
    name: "Stream Strike",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Hammer",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 480,
    cooldown: 0,
    nextChainId: 1100232,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
            coefficient: 0.575,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100232,
    name: "Water Rush",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Hammer",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 640,
    cooldown: 0,
    nextChainId: 1100233,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 480,
            coefficient: 0.575,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100233,
    name: "Chilling Crack",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Hammer",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: 1100231,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 480,
            coefficient: 1.38,
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
            condition: "Chilled",
            stacks: 1,
            duration: 1.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100234,
    name: "Rain of Blows",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Hammer",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 920,
    cooldown: 6,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 480,
            coefficient: 0.575,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 720,
            coefficient: 0.575,
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
            coefficient: 0.575,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1320,
            coefficient: 0.575,
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
  },
  {
    id: 1100235,
    name: "Icy Coil",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Hammer",
    attunement: "Water",
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
    ],
  },
  {
    id: 1100236,
    name: "Crashing Font",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Hammer",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 960,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1200,
            coefficient: 1.438,
            metadata: {
              finisherType: "Leap",
              finisherValue: 1,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100237,
    name: "Cleansing Typhoon",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Hammer",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 480,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 600,
            coefficient: 1.725,
            metadata: {
              finisherType: "Whirl",
              finisherValue: 1,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100238,
    name: "Wind Slam",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Hammer",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 840,
            coefficient: 1.036,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100239,
    name: "Hurricane of Pain",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Hammer",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 2080,
    cooldown: 10,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 300,
            coefficient: 0.55,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 300,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 540,
            coefficient: 0.55,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 540,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 900,
            coefficient: 0.55,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 900,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            coefficient: 0.55,
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
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 1620,
            coefficient: 0.55,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 1620,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            coefficient: 0.55,
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
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 2340,
            coefficient: 0.55,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2340,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 2700,
            coefficient: 0.55,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2700,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
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
            atMs: 3060,
            coefficient: 0.55,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 3060,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100240,
    name: "Crescent Wind",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Hammer",
    attunement: "Air",
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
  },
  {
    id: 1100241,
    name: "Wind Storm",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Hammer",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
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
        canCrit: true,
      },
      {
        type: "boon",
        boon: "Superspeed",
        stacks: 1,
        duration: 3,
        durationScale: "boon",
        atMs: 660,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "control",
        atMs: 660,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
        },
      },
    ],
  },
  {
    id: 1100242,
    name: "Shock Blast",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Hammer",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 280,
    cooldown: 25,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 420,
            coefficient: 0.575,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 1200,
            coefficient: 0.925,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        canCrit: true,
      },
      {
        type: "control",
        atMs: 1200,
        applications: 1,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          controlKind: "crowd-control",
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100243,
    name: "Stonestrike",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Hammer",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 560,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 660,
            coefficient: 1.035,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100244,
    name: "Whirling Stones",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Hammer",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 1440,
    cooldown: 8,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 780,
            coefficient: 0.84,
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
            atMs: 1140,
            coefficient: 0.84,
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
            atMs: 1440,
            coefficient: 0.84,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 1440,
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
            atMs: 1800,
            coefficient: 0.84,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 1800,
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
            atMs: 2100,
            coefficient: 0.84,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 2100,
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
  },
  {
    id: 1100245,
    name: "Rocky Loop",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Hammer",
    attunement: "Earth",
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
    ],
  },
  {
    id: 1100246,
    name: "Immutable Stone",
    type: "Weapon",
    slot: "Weapon_4",
    weapon: "Hammer",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 1520,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [],
  },
  {
    id: 1100247,
    name: "Ground Pound",
    type: "Weapon",
    slot: "Weapon_5",
    weapon: "Hammer",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 760,
    cooldown: 20,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1080,
            coefficient: 2.8,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
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
            atMs: 1080,
            condition: "Bleeding",
            stacks: 5,
            duration: 6,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 1080,
            condition: "Immobilize",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100248,
    name: "Grand Finale",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Hammer",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1020,
            coefficient: 1.4,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100249,
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
  },
  {
    id: 1100250,
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
  },
  {
    id: 1100251,
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
  },
  {
    id: 1100252,
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
  },
  {
    id: 1100253,
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
  },
  {
    id: 1100254,
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
  },
  {
    id: 1100255,
    name: "Scorching Shot",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Pistol",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 520,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
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
            atMs: 540,
            condition: "Burning",
            stacks: 1,
            duration: 1.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100256,
    name: "Raging Ricochet",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Pistol",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 520,
    cooldown: 6,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
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
            atMs: 540,
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
        type: "boon",
        boon: "Might",
        stacks: 1,
        duration: 6,
        durationScale: "boon",
        atMs: 540,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100257,
    name: "Searing Salvo",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Pistol",
    attunement: "Fire",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 680,
    cooldown: 12,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 660,
            coefficient: 1,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
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
            atMs: 660,
            condition: "Burning",
            stacks: 1,
            duration: 7,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 2160,
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
            atMs: 2160,
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
            atMs: 2160,
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
            atMs: 2160,
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
            atMs: 2160,
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
            atMs: 2160,
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
            atMs: 2160,
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
            atMs: 2160,
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
  {
    id: 1100258,
    name: "Soothing Splash",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Pistol",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 520,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
            coefficient: 0.4,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100259,
    name: "Frigid Flurry",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Pistol",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 1000,
    cooldown: 5,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 420,
            coefficient: 0.2,
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
            stacks: 1,
            duration: 7,
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
            coefficient: 0.2,
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
            condition: "Bleeding",
            stacks: 1,
            duration: 7,
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
            coefficient: 0.2,
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
            duration: 7,
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
            atMs: 1200,
            coefficient: 0.2,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 1200,
            condition: "Bleeding",
            stacks: 1,
            duration: 7,
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
            atMs: 1440,
            coefficient: 0.2,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 1440,
            condition: "Bleeding",
            stacks: 1,
            duration: 7,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100260,
    name: "Frozen Fusillade",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Pistol",
    attunement: "Water",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 520,
    cooldown: 15,
    comboField: "Ice",
    fieldDuration: 4,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
            coefficient: 0.75,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 540,
            condition: "Chilled",
            stacks: 1,
            duration: 1.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100261,
    name: "Electric Exposure",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Pistol",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 520,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
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
            atMs: 540,
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
  },
  {
    id: 1100262,
    name: "Dazing Discharge",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Pistol",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 8,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 420,
            coefficient: 0.75,
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
            duration: 10,
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
    ],
  },
  {
    id: 1100263,
    name: "Aerial Agility",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Pistol",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 520,
    cooldown: 12,
    nextChainId: 1100264,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [],
  },
  {
    id: 1100264,
    name: "Aerial Agility (chain)",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Pistol",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 480,
    cooldown: 0,
    nextChainId: 1100265,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
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
            atMs: 540,
            condition: "Weakness",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100265,
    name: "Aerial Agility (dash)",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Pistol",
    attunement: "Air",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 520,
    cooldown: 0,
    nextChainId: 1100263,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "Aegis",
        stacks: 1,
        duration: 3,
        durationScale: "boon",
        atMs: 540,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Leap",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100266,
    name: "Piercing Pebble",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Pistol",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 520,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
            coefficient: 0.35,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 540,
            condition: "Bleeding",
            stacks: 1,
            duration: 5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100267,
    name: "Shattering Stone",
    type: "Weapon",
    slot: "Weapon_2",
    weapon: "Pistol",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 520,
    cooldown: 6,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 540,
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
            atMs: 540,
            condition: "Bleeding",
            stacks: 3,
            duration: 10,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100268,
    name: "Boulder Blast",
    type: "Weapon",
    slot: "Weapon_3",
    weapon: "Pistol",
    attunement: "Earth",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 440,
    cooldown: 12,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 600,
            coefficient: 0.44,
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
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
            atMs: 600,
            condition: "Bleeding",
            stacks: 5,
            duration: 8,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 600,
            condition: "Immobilize",
            stacks: 1,
            duration: 1.5,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100269,
    name: "Elemental Explosion",
    type: "Weapon",
    slot: "Weapon_1",
    weapon: "Pistol",
    categories: ["Weapon skill"],
    quicknessCastTimeMs: 520,
    cooldown: 0,
    skillFamily: "Weapon skill",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 780,
            coefficient: 0.2,
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
            condition: "Burning",
            stacks: 2,
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
            atMs: 900,
            coefficient: 0.2,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 900,
            condition: "Bleeding",
            stacks: 4,
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
            atMs: 1020,
            coefficient: 0.2,
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
            condition: "Vulnerability",
            stacks: 4,
            duration: 10,
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
            coefficient: 0.2,
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
  },
  {
    id: 1100270,
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
  },
  {
    id: 1100271,
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
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
            },
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
          finisherType: "Projectile",
          finisherValue: 1,
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
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100272,
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
  },
  {
    id: 1100273,
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
  },
  {
    id: 1100274,
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
  },
  {
    id: 1100275,
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
            metadata: {
              finisherType: "Projectile",
              finisherValue: 1,
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
            atMs: 780,
            condition: "Weakness",
            stacks: 1,
            duration: 3,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
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
        metadata: {
          finisherType: "Projectile",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100276,
    name: "Glyph of Elementals",
    type: "Elite",
    slot: "Elite",
    categories: ["Glyph"],
    quicknessCastTimeMs: 0,
    cooldown: 190,
    skillFamily: "Glyph",
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 1280,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 1280,
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
            atMs: 1480,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 1480,
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
            atMs: 1680,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 1680,
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
            atMs: 1960,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 4800,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 6130,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 1460,
              flatStrikePowerCoeff: 0,
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
            atMs: 6130,
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
        type: "boon",
        boon: "Might",
        stacks: 3,
        duration: 10,
        durationScale: "boon",
        atMs: 6130,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 13520,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 13520,
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
            atMs: 13720,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 13720,
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
            atMs: 13920,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 13920,
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
            atMs: 14120,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 4800,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 16800,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 20200,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 23920,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 26000,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 26000,
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
            atMs: 26200,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 26200,
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
            atMs: 26400,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 26400,
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
            atMs: 26600,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 4800,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 30720,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 1460,
              flatStrikePowerCoeff: 0,
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
            atMs: 30720,
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
        type: "boon",
        boon: "Might",
        stacks: 3,
        duration: 10,
        durationScale: "boon",
        atMs: 30720,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 33880,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 37280,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 38480,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 38480,
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
            atMs: 38680,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 38680,
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
            atMs: 38880,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 38880,
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
            atMs: 39080,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 4800,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 41760,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 45400,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 48760,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 50960,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 50960,
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
            atMs: 51160,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 51160,
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
            atMs: 51360,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 51360,
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
            atMs: 51560,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 4800,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 54240,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 57560,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 60360,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 63440,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 63440,
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
            atMs: 63640,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 63640,
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
            atMs: 63840,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 63840,
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
            atMs: 64040,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 4800,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 68200,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 1460,
              flatStrikePowerCoeff: 0,
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
            atMs: 68200,
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
        type: "boon",
        boon: "Might",
        stacks: 3,
        duration: 10,
        durationScale: "boon",
        atMs: 68200,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 71800,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 74560,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 75920,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 75920,
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
            atMs: 76120,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 76120,
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
            atMs: 76320,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 76320,
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
            atMs: 76520,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 4800,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 79160,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 82320,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 86960,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 1460,
              flatStrikePowerCoeff: 0,
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
            atMs: 86960,
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
        type: "boon",
        boon: "Might",
        stacks: 3,
        duration: 10,
        durationScale: "boon",
        atMs: 86960,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 88400,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 88400,
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
            atMs: 88600,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 88600,
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
            atMs: 88800,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 88800,
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
            atMs: 89000,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 4800,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 91680,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 95120,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 98680,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 100880,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 100880,
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
            atMs: 101080,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 101080,
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
            atMs: 101280,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 101280,
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
            atMs: 101480,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 4800,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 104160,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 106960,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 111840,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 1460,
              flatStrikePowerCoeff: 0,
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
            atMs: 111840,
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
        type: "boon",
        boon: "Might",
        stacks: 3,
        duration: 10,
        durationScale: "boon",
        atMs: 111840,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 113360,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 113360,
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
            atMs: 113560,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 113560,
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
            atMs: 113760,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 400,
              flatStrikePowerCoeff: 0,
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
            atMs: 113760,
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
            atMs: 113960,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 4800,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 116680,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        ticks: [
          {
            atMs: 119680,
            coefficient: 0,
            metadata: {
              flatStrikeBase: 995,
              flatStrikePowerCoeff: 0,
            },
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  {
    id: 1100277,
    name: "Dodge",
    type: "Action",
    slot: "Action",
    categories: ["Dodge"],
    castTimeMs: 800,
    unaffectedByQuickness: true,
    cooldown: 0,
    enduranceCost: -50,
    skillFamily: "Dodge",
    implemented: true,
    effects: [],
  },
  {
    id: 1100278,
    name: "Flame Burst (trait)",
    type: "Action",
    slot: "Action",
    categories: ["Trait"],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: "Trait",
    implemented: false,
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
      {
        type: "condition",
        ticks: [
          {
            atMs: 0,
            condition: "Burning",
            stacks: 3,
            duration: 6,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100279,
    name: "Cleansing Wave (trait)",
    type: "Action",
    slot: "Action",
    categories: ["Trait"],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: "Trait",
    implemented: false,
    effects: [],
  },
  {
    id: 1100280,
    name: "Blinding Flash (trait)",
    type: "Action",
    slot: "Action",
    categories: ["Trait"],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: "Trait",
    implemented: false,
    effects: [
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
    ],
  },
  {
    id: 1100281,
    name: "Shock Wave (trait)",
    type: "Action",
    slot: "Action",
    categories: ["Trait"],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: "Trait",
    implemented: false,
    effects: [
      {
        type: "strike",
        ticks: [
          {
            atMs: 0,
            coefficient: 0.5,
            metadata: {
              finisherType: "Blast",
              finisherValue: 1,
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
            stacks: 1,
            duration: 20,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 0,
            condition: "Cripple",
            stacks: 1,
            duration: 2,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {
          finisherType: "Blast",
          finisherValue: 1,
        },
      },
    ],
  },
  {
    id: 1100282,
    name: "Unravel",
    type: "Utility",
    slot: "Utility",
    specialization: "Weaver",
    categories: ["Stance"],
    quicknessCastTimeMs: 0,
    cooldown: 25,
    skillFamily: "Stance",
    implemented: true,
    effects: [],
  },
  {
    id: 1100283,
    name: "Cleansing Fire",
    type: "Utility",
    slot: "Utility",
    categories: ["Cantrip"],
    quicknessCastTimeMs: 0,
    cooldown: 20,
    skillFamily: "Cantrip",
    implemented: true,
    effects: [
      {
        type: "condition",
        ticks: [
          {
            atMs: 0,
            condition: "Burning",
            stacks: 2,
            duration: 6,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
      {
        type: "boon",
        boon: "Might",
        stacks: 3,
        duration: 9,
        durationScale: "boon",
        atMs: 0,
        timingAnchor: "castStart",
        timingScale: "cast",
        metadata: {},
      },
    ],
  },
  {
    id: 1100284,
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
]);

export const ELEMENTALIST_SKILL_IDS_BY_NAME: Readonly<Record<string, number>> =
  Object.freeze(
    Object.fromEntries(
      ELEMENTALIST_GENERATED_SKILLS.map((skill) => [
        skill.name,
        Number(skill.id),
      ]),
    ),
  );
