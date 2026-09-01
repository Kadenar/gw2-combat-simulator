/**
 * Canonical Core elementalist skill fragments grouped by their GW2 owner.
 *
 * "Misc" here means everything that is not a slot skill, a profession (attunement) skill, or a
 * physical weapon set: the three conjured bundles' weapon skills (Frost Bow, Lightning Hammer,
 * Fiery Greatsword), the synthetic Dodge action, and trait-proc pseudo-skills that exist only so
 * the catalog can name them.
 *
 * These are pure data fragments — no behavior. `index.ts` merges them into the Core skill
 * mechanics table; the cast/scheduler layers read the timing and effect packets from here.
 */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import { conditionTimeline, strikeTimeline } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';
import {
  CAST_SCALED_PACKET_TIMING,
  FIERY_WHIRL_STRIKE_TICKS,
  FIRESTORM_TICK_OFFSETS_MS,
  FROST_STORM_STRIKE_TICKS,
  FROST_VOLLEY_TICK_OFFSETS_MS,
  INVOKE_LIGHTNING_STRIKE_TICKS
} from '#gw2/content/professions/elementalist/core/skills/skill-timelines.js';

/**
 * Skill-id → fragment table for the conjured-bundle weapon skills, Dodge, and trait pseudo-skills.
 * Entries are keyed by GW2 skill id and overlay the catalog entry of the same id.
 */
export const ELEMENTALIST_MISC_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  // --- Frost Bow (conjure) ---------------------------------------------------
  // `skillWeapon` is the bundle gate: availability blocks these unless the matching conjure is
  // equipped, and blocks normal weapon skills while it is (see core/mechanics/availability.ts).
  [ID.WATER_ARROW]: {
    name: 'Water Arrow',
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Frost Bow',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 600,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 560,
            coefficient: 0.3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.FROST_VOLLEY]: {
    name: 'Frost Volley',
    type: 'Weapon',
    slot: 'Weapon_2',
    skillWeapon: 'Frost Bow',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1600,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: FROST_VOLLEY_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.5,
          comboFinishers: [
            {
              ownerId: 'elementalist',
              finisherType: 'Projectile',
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {}
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: FROST_VOLLEY_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 1,
          duration: 15
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Fan fires all seven packets (and their Chilled applications) at the same 240ms offset.
  [ID.FROST_FAN]: {
    name: 'Frost Fan',
    type: 'Weapon',
    slot: 'Weapon_3',
    skillWeapon: 'Frost Bow',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 560,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 7,
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 240,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 240,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 240,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 240,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 240,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 240,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 240,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Channelled field: strikes reuse the shared tick timeline, and Bleeding rides every tick
  // except the opening one.
  [ID.FROST_STORM]: {
    name: 'Frost Storm',
    type: 'Weapon',
    slot: 'Weapon_4',
    skillWeapon: 'Frost Bow',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 2360,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      strikeTimeline(FROST_STORM_STRIKE_TICKS, CAST_SCALED_PACKET_TIMING),
      conditionTimeline(
        FROST_STORM_STRIKE_TICKS.slice(1).map(({ atMs }) => ({
          atMs,
          condition: 'Bleeding',
          stacks: 1,
          duration: 3
        })),
        CAST_SCALED_PACKET_TIMING
      )
    ]
  },
  [ID.DEEP_FREEZE]: {
    name: 'Deep Freeze',
    type: 'Weapon',
    slot: 'Weapon_5',
    skillWeapon: 'Frost Bow',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1120,
    cooldown: 30,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1120,
            coefficient: 0.8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1120,
            condition: 'Chilled',
            stacks: 1,
            duration: 5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'control',
        atMs: 1120,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ]
  },
  // --- Lightning Hammer (conjure) --------------------------------------------
  // Weapon_1 is a three-step chain wired through `nextChainId`:
  // Lightning Swing → Static Swing → Thunderclap → back to Lightning Swing.
  [ID.LIGHTNING_SWING]: {
    name: 'Lightning Swing',
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 480,
    cooldown: 0,
    nextChainId: ID.STATIC_SWING,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.STATIC_SWING]: {
    name: 'Static Swing',
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 640,
    cooldown: 0,
    nextChainId: ID.THUNDERCLAP,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 320,
            coefficient: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.THUNDERCLAP]: {
    name: 'Thunderclap',
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: ID.LIGHTNING_SWING,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 320,
            coefficient: 1.5,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'blind',
        atMs: 320,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'blind'
      }
    ]
  },
  [ID.LIGHTNING_LEAP]: {
    name: 'Lightning Leap',
    type: 'Weapon',
    slot: 'Weapon_2',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 960,
    cooldown: 8,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 800,
            coefficient: 1,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Leap',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'Quickness',
        stacks: 1,
        duration: 3,
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.WIND_BLAST]: {
    name: 'Wind Blast',
    type: 'Weapon',
    slot: 'Weapon_3',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 960,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 680,
            coefficient: 0.33
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'buff',
        kind: 'superspeed',
        stacks: 1,
        duration: 3,
        atMs: 680,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'control',
        atMs: 680,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ]
  },
  [ID.INVOKE_LIGHTNING]: {
    name: 'Invoke Lightning',
    type: 'Weapon',
    slot: 'Weapon_4',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 920,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [strikeTimeline(INVOKE_LIGHTNING_STRIKE_TICKS, CAST_SCALED_PACKET_TIMING)]
  },
  // Lays a 4s Lightning combo field that opens at cast end (not cast start), and lands two
  // separate strike + crowd-control pulses of its own.
  [ID.STATIC_FIELD_LIGHTNING_HAMMER]: {
    name: 'Static Field',
    type: 'Weapon',
    slot: 'Weapon_5',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 760,
    cooldown: 25,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Lightning',
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 180,
            coefficient: 0.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 180,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 680,
            coefficient: 0.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 680,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ]
  },
  // --- Fiery Greatsword (conjure elite) ---------------------------------------
  // Weapon_1 is a single skill that fires four evenly spaced waves rather than a chain.
  [ID.FLAME_WAVE]: {
    name: 'Flame Wave',
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Fiery Greatsword',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 2160,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.65
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 800,
            coefficient: 0.65
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1240,
            coefficient: 0.65
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1680,
            coefficient: 0.65
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Condition-only: no strike packet. Six Burning pulses one second apart continue for ~5s past
  // the end of the cast, so the fragment's effect timeline outlives its cast lane.
  [ID.FIERY_ERUPTION]: {
    name: 'Fiery Eruption',
    type: 'Weapon',
    slot: 'Weapon_2',
    skillWeapon: 'Fiery Greatsword',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 720,
    cooldown: 5,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'condition',
        ticks: [
          {
            atMs: 720,
            condition: 'Burning',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 1720,
            condition: 'Burning',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 2720,
            condition: 'Burning',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 3720,
            condition: 'Burning',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 4720,
            condition: 'Burning',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 5720,
            condition: 'Burning',
            stacks: 1,
            duration: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.FIERY_WHIRL]: {
    name: 'Fiery Whirl',
    type: 'Weapon',
    slot: 'Weapon_3',
    skillWeapon: 'Fiery Greatsword',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1320,
    cooldown: 5,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      strikeTimeline(FIERY_WHIRL_STRIKE_TICKS, {
        ...CAST_SCALED_PACKET_TIMING,
        comboFinishers: [
          {
            ownerId: 'elementalist',
            finisherType: 'Whirl',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }),
      conditionTimeline(
        FIERY_WHIRL_STRIKE_TICKS.map(({ atMs }) => ({
          atMs,
          condition: 'Cripple',
          stacks: 1,
          duration: 3
        })),
        CAST_SCALED_PACKET_TIMING
      )
    ]
  },
  [ID.FIERY_RUSH]: {
    name: 'Fiery Rush',
    type: 'Weapon',
    slot: 'Weapon_4',
    skillWeapon: 'Fiery Greatsword',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1280,
    cooldown: 10,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1080,
            coefficient: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Ground field: nine one-second pulses that keep ticking long after the short cast ends.
  [ID.FIRESTORM]: {
    name: 'Firestorm',
    type: 'Weapon',
    slot: 'Weapon_5',
    skillWeapon: 'Fiery Greatsword',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 760,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: FIRESTORM_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.65
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // --- Synthetic actions -------------------------------------------------------
  // Dodge is a rotation-only action with no effects; it exists to occupy a cast lane, and its
  // duration is fixed because evade frames do not scale with Quickness.
  [ID.DODGE]: {
    name: 'Dodge',
    type: 'Action',
    slot: 'Action',
    categories: ['Dodge'],
    castTimeMs: 800,
    unaffectedByQuickness: true,
    cooldown: 0,
    skillFamily: 'Dodge',
    implemented: true,
    effects: []
  },
  // --- Trait pseudo-skills -----------------------------------------------------
  // Catalog placeholders for the trait-proc versions of these skills. All are
  // `implemented: false` / `simulatorExcluded` / not slot-selectable, so they stay out of skill
  // selection and the rotation palette; their packets are recorded for reference only.
  [ID.FLAME_BURST_TRAIT]: {
    name: 'Flame Burst (trait)',
    type: 'Action',
    slot: 'Action',
    categories: ['Trait'],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: 'Trait',
    implemented: false,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Burning',
            stacks: 3,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.CLEANSING_WAVE_TRAIT]: {
    name: 'Cleansing Wave (trait)',
    type: 'Action',
    slot: 'Action',
    categories: ['Trait'],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: 'Trait',
    implemented: false,
    effects: []
  },
  [ID.BLINDING_FLASH_TRAIT]: {
    name: 'Blinding Flash (trait)',
    type: 'Action',
    slot: 'Action',
    categories: ['Trait'],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: 'Trait',
    implemented: false,
    effects: [
      {
        type: 'blind',
        atMs: 0,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'blind'
      }
    ]
  },
  [ID.SHOCK_WAVE_TRAIT]: {
    name: 'Shock Wave (trait)',
    type: 'Action',
    slot: 'Action',
    categories: ['Trait'],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: 'Trait',
    implemented: false,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0.5,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Bleeding',
            stacks: 1,
            duration: 20
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Cripple',
            stacks: 1,
            duration: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  }
});
