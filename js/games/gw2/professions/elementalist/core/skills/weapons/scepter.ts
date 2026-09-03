/**
 * Scepter weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers the main-hand slot 1-3 skills across all four attunements, including the
 * Earth-attunement Rock Barrier/Hurl flip pair. Declarative data only: the named
 * `mechanicTriggers` are implemented by `core/execution/index.ts`, and the table
 * is merged into the Core skill catalog by `core/skills/index.ts`.
 */

import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/**
 * Skill-id keyed fragments the catalog layers over the raw scepter skill records so the
 * simulator knows each skill's cast timeline, emitted packets, and combo participation.
 */
export const ELEMENTALIST_CORE_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  // Two-stage autoattack: each strike packet carries its own Burning application.
  [ID.FLAMESTRIKE]: {
    name: 'Flamestrike',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Scepter',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 600,
    // Flamestrike commits both damage packets only after the second strike launches at 520 ms.
    interruptCommitMs: 520,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 240,
            coefficient: 0.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 240,
            condition: 'Burning',
            stacks: 1,
            duration: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 0.7
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 520,
            condition: 'Burning',
            stacks: 1,
            duration: 2.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Delayed drop: the single blast finisher and its Burning land 2.6s after cast start,
  // long after the 680ms cast has ended.
  [ID.DRAGONS_TOOTH]: {
    name: "Dragon's Tooth",
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Scepter',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 2600,
            coefficient: 2.25,
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
            atMs: 2600,
            condition: 'Burning',
            stacks: 1,
            duration: 10
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Three closely spaced packets; only the middle one is the blast finisher and carries the
  // Burning stacks, and the trailing packet grants Vigor.
  [ID.PHOENIX]: {
    name: 'Phoenix',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Scepter',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 480,
    cooldown: 10,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 320,
            coefficient: 0.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 1.7,
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
            atMs: 360,
            condition: 'Burning',
            stacks: 2,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 380,
            coefficient: 0.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'Vigor',
        stacks: 1,
        duration: 5,
        atMs: 380,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Three separate shard hits that all land on the same 480ms timestamp.
  [ID.ICE_SHARDS]: {
    name: 'Ice Shards',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Scepter',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 560,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 3,
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Impact at 360ms plus a delayed detonation at 1040ms, each chilling separately.
  [ID.SHATTERSTONE]: {
    name: 'Shatterstone',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Scepter',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 400,
    cooldown: 3,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 360,
            condition: 'Chilled',
            stacks: 1,
            duration: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1040,
            coefficient: 0.8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1040,
            condition: 'Chilled',
            stacks: 1,
            duration: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Ammo skill: two charges on a shared 10s recharge behind a 1s per-cast cooldown.
  [ID.WATER_TRIDENT]: {
    name: 'Water Trident',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Scepter',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 1,
    ammo: 2,
    ammoRecharge: 10,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 2.4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.ARC_LIGHTNING]: {
    name: 'Arc Lightning',
    interruptMode: 'per-packet',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Scepter',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 2720,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        // Arc Lightning ramps over ten attacks: three stage-one, three stage-two, then four stage-three packets.
        ticks: [
          [440, 0.35],
          [680, 0.35],
          [960, 0.35],
          [1200, 0.4],
          [1440, 0.4],
          [1720, 0.4],
          [1960, 0.45],
          [2200, 0.45],
          [2480, 0.45],
          [2720, 0.45]
        ].map(([atMs, coefficient]) => ({ atMs, coefficient })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.LIGHTNING_STRIKE]: {
    name: 'Lightning Strike',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Scepter',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 5,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1.2
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
            condition: 'Vulnerability',
            stacks: 5,
            duration: 10
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Instant ammo skill: two charges on a 10s recharge, applying blind plus Weakness.
  [ID.BLINDING_FLASH]: {
    name: 'Blinding Flash',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Scepter',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 0.5,
    ammo: 2,
    ammoRecharge: 10,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'blind',
        atMs: 0,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'blind'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Weakness',
            stacks: 1,
            duration: 4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Three-shard autoattack; each shard is an independent 20%-chance projectile finisher and
  // applies its own Bleeding stack.
  [ID.STONE_SHARDS]: {
    name: 'Stone Shards',
    interruptMode: 'per-packet',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Scepter',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1400,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 720,
            coefficient: 0.5,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Projectile',
                chance: 0.2,
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
            atMs: 720,
            condition: 'Bleeding',
            stacks: 1,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1000,
            coefficient: 0.5,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Projectile',
                chance: 0.2,
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
            atMs: 1000,
            condition: 'Bleeding',
            stacks: 1,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1240,
            coefficient: 0.5,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Projectile',
                chance: 0.2,
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
            atMs: 1240,
            condition: 'Bleeding',
            stacks: 1,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Rock Barrier and Hurl are a two-state flip pair sharing the Weapon_2 slot: availability
  // gates each on whether a barrier is currently stored (see core/mechanics/availability.ts).
  [ID.ROCK_BARRIER]: {
    name: 'Rock Barrier',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Scepter',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 760,
    cooldown: 8,
    nextChainId: ID.HURL,
    skillFamily: 'Weapon skill',
    // Rock Barrier opens Hurl's stored-barrier window after completion.
    mechanicTriggers: [
      {
        type: 'elementalist.core.open-rock-barrier',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'boon',
        boon: 'Resistance',
        stacks: 1,
        duration: 4,
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'rock-barrier'
  },
  // Throws the stored barrier as five projectile-finisher packets 200ms apart, each bleeding.
  [ID.HURL]: {
    name: 'Hurl',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Scepter',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    nextChainId: ID.ROCK_BARRIER,
    skillFamily: 'Weapon skill',
    // Hurl consumes the stored barrier and starts Rock Barrier's real recharge.
    mechanicTriggers: [
      {
        type: 'elementalist.core.release-rock-barrier',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 300,
            coefficient: 0.44,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Projectile',
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
            atMs: 300,
            condition: 'Bleeding',
            stacks: 1,
            duration: 8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 500,
            coefficient: 0.44,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Projectile',
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
            atMs: 500,
            condition: 'Bleeding',
            stacks: 1,
            duration: 8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 700,
            coefficient: 0.44,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Projectile',
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
            atMs: 700,
            condition: 'Bleeding',
            stacks: 1,
            duration: 8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 900,
            coefficient: 0.44,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Projectile',
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
            atMs: 900,
            condition: 'Bleeding',
            stacks: 1,
            duration: 8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1100,
            coefficient: 0.44,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Projectile',
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
            atMs: 1100,
            condition: 'Bleeding',
            stacks: 1,
            duration: 8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'rock-barrier'
  },
  // The travelling projectile outlives the cast, so its pulses use fixed (cast-speed
  // independent) offsets and persist after an interrupt past the 160ms commit point.
  [ID.DUST_DEVIL]: {
    name: 'Dust Devil',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Scepter',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 320,
    cooldown: 15,
    // EVTC shows the dust projectile committing at 160 ms and striking again at one-second intervals.
    interruptCommitMs: 160,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 160,
            coefficient: 0.4
          },
          {
            atMs: 1160,
            coefficient: 0.4
          },
          {
            atMs: 2160,
            coefficient: 0.4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'blind',
        atMs: 160,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        controlKind: 'blind'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 160,
            condition: 'Cripple',
            stacks: 1,
            duration: 1.5
          },
          {
            atMs: 1160,
            condition: 'Cripple',
            stacks: 1,
            duration: 1.5
          },
          {
            atMs: 2160,
            condition: 'Cripple',
            stacks: 1,
            duration: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {}
      }
    ]
  }
});
