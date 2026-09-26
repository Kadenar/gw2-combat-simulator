/**
 * Hammer weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers slots 1-5 in all four attunements plus the attunement-independent Grand
 * Finale flipover. The slot-3 skills create the elemental orbs that Grand Finale
 * spends; the orb bookkeeping itself lives in `core/mechanics/hammer-orbs.ts`.
 */

import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { impactEffects, conditionTimeline, strikeTimeline } from '#gw2/platform/engine/effects/authoring.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Hurricane of Pain uses canonical parallel timelines so every landed strike applies its matching Vulnerability.
const HURRICANE_OF_PAIN_TICKS = [200, 360, 600, 840, 1080, 1320, 1560, 1800, 2040] as const;

// Each active hammer orb contacts the target once per second for its fifteen-second lifetime.
const HAMMER_ORB_PACKET_OFFSETS_MS = Array.from({ length: 15 }, (_, index) => (index + 1) * 1000);

/**
 * Skill-id keyed fragments the Core module contributes to the hammer catalog.
 * Each entry declares the packet timeline the scheduler materializes for that skill.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_HAMMER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SINGEING_STRIKE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Singeing Strike',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Hammer',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 440,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.69 },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 1.5, metadata: {} }
    ])
  },
  [ID.SURGING_FLAMES]: {
    name: 'Surging Flames',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Hammer',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 880,
    cooldown: 8,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2.07 },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 3, metadata: {} }
    ])
  },
  // Fire orb creator. The near-zero-coefficient packets represent the orb's repeated contact damage; the
  // orb's real payoff is the projectile Grand Finale later fires for it. `hammer-orbs` marks the skill
  // as state-gated (it is unavailable while its own orb is still active).
  [ID.FLAME_WHEEL]: {
    name: 'Flame Wheel',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: HAMMER_ORB_PACKET_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.001,
          damageKind: 'field-tick'
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: HAMMER_ORB_PACKET_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 0.75
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Three simultaneous strike/Burning pairs at a single packet time.
  [ID.TRIPLE_SEAR]: {
    name: 'Triple Sear',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Hammer',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 560,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 4, metadata: {} }
      ]),
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 4, metadata: {} }
      ]),
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 4, metadata: {} }
      ])
    ]
  },
  // Blast finisher that also self-buffs, so its Fury and Might land on the same packet time as the strike.
  [ID.MOLTEN_END]: {
    name: 'Molten End',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Hammer',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 760,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2.8,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      { type: 'boon', boon: 'Fury', stacks: 1, duration: 10, metadata: {} },
      { type: 'boon', boon: 'Might', stacks: 6, duration: 10, metadata: {} }
    ])
  },
  // First link of the Water auto-attack chain: Stream Strike -> Water Rush -> Chilling Crack -> back to
  // Stream Strike, wired through `nextChainId`.
  [ID.STREAM_STRIKE]: {
    name: 'Stream Strike',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Hammer',
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 480,
    cooldown: 0,
    nextChainId: ID.WATER_RUSH,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.575
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.WATER_RUSH]: {
    name: 'Water Rush',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Hammer',
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 640,
    cooldown: 0,
    nextChainId: ID.CHILLING_CRACK,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 320,
            coefficient: 0.575
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Chain finisher: the heavy hit that also applies the chain's only Chilled stack before looping back.
  [ID.CHILLING_CRACK]: {
    name: 'Chilling Crack',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Hammer',
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 440,
    cooldown: 0,
    nextChainId: ID.STREAM_STRIKE,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.38 },
      { type: 'condition', condition: 'Chilled', stacks: 1, duration: 1.5, metadata: {} }
    ])
  },
  // Four-hit channel where only the final blow applies Chilled; `per-packet` interruption keeps just the
  // hits that landed before the cancel.
  [ID.RAIN_OF_BLOWS]: {
    name: 'Rain of Blows',
    interruptMode: 'per-packet',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Hammer',
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 920,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 320,
            coefficient: 0.575
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 480,
            coefficient: 0.575
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 720,
            coefficient: 0.575
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ atMs: 880, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.575 },
        { type: 'condition', condition: 'Chilled', stacks: 1, duration: 3, metadata: {} }
      ])
    ]
  },
  // Water orb creator; same token-packet shape as Flame Wheel, applying Vulnerability instead of Burning.
  [ID.ICY_COIL]: {
    name: 'Icy Coil',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: HAMMER_ORB_PACKET_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.001,
          damageKind: 'field-tick'
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: HAMMER_ORB_PACKET_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 1,
          duration: 6
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Leap finisher; the single impact is its whole payload.
  [ID.CRASHING_FONT]: {
    name: 'Crashing Font',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Hammer',
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 960,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 800,
            coefficient: 1.438,
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
      }
    ]
  },
  // Whirl finisher: one strike that spawns whirl bolts when it crosses an active combo field.
  [ID.CLEANSING_TYPHOON]: {
    name: 'Cleansing Typhoon',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Hammer',
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 480,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 400,
            coefficient: 1.725,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Whirl',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.WIND_SLAM]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Wind Slam',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Hammer',
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 680,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 560,
            coefficient: 1.036
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Nine-hit channel built from paired strike/condition timelines so every landed hit carries its own
  // Vulnerability stack; `per-packet` interruption truncates both timelines at the same point.
  [ID.HURRICANE_OF_PAIN]: {
    name: 'Hurricane of Pain',
    interruptMode: 'per-packet',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Hammer',
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 2080,
    cooldown: 10,
    skillFamily: 'Weapon skill',
    effects: [
      strikeTimeline(
        HURRICANE_OF_PAIN_TICKS.map((atMs) => ({ atMs, coefficient: 0.55 })),
        { timingAnchor: 'castStart', timingScale: 'cast' }
      ),
      conditionTimeline(
        HURRICANE_OF_PAIN_TICKS.map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 1,
          duration: 10
        })),
        { timingAnchor: 'castStart', timingScale: 'cast' }
      )
    ]
  },
  // Air orb creator; same token-packet shape as Flame Wheel, applying Weakness.
  [ID.CRESCENT_WIND]: {
    name: 'Crescent Wind',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: HAMMER_ORB_PACKET_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.001,
          damageKind: 'field-tick'
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: HAMMER_ORB_PACKET_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Weakness',
          stacks: 1,
          duration: 1.5
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Small strike that mainly exists for its self-Superspeed and crowd-control application.
  [ID.WIND_STORM]: {
    name: 'Wind Storm',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Hammer',
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 440,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.3, canCrit: true },
      { type: 'buff', kind: 'superspeed', stacks: 1, duration: 3, metadata: {} },
      { type: 'control', applications: 1, controlKind: 'crowd-control' }
    ])
  },
  // Two-stage skill: a small hit at cast end, then the delayed blast finisher and crowd control together.
  [ID.SHOCK_BLAST]: {
    name: 'Shock Blast',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Hammer',
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 280,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 280,
            coefficient: 0.575
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'strike',
          coefficient: 0.925,
          comboFinishers: [
            {
              attemptGroup: 'effect:2:tick:1',
              ownerId: 'elementalist',
              finisherType: 'Blast',
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {},
          canCrit: true
        },
        { type: 'control', applications: 1, controlKind: 'crowd-control' }
      ])
    ]
  },
  [ID.STONESTRIKE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Stonestrike',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Hammer',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 560,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 440,
            coefficient: 1.035
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Five-hit channel with a Bleeding stack per hit; `per-packet` interruption keeps only the landed prefix.
  [ID.WHIRLING_STONES]: {
    name: 'Whirling Stones',
    interruptMode: 'per-packet',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Hammer',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 1440,
    cooldown: 8,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.84 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} }
      ]),
      ...impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.84 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} }
      ]),
      ...impactEffects({ atMs: 960, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.84 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1200, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.84 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1400, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.84 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} }
      ])
    ]
  },
  // Earth orb creator; same token-packet shape as Flame Wheel, applying Bleeding.
  [ID.ROCKY_LOOP]: {
    name: 'Rocky Loop',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: HAMMER_ORB_PACKET_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.001,
          damageKind: 'field-tick'
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: HAMMER_ORB_PACKET_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Bleeding',
          stacks: 1,
          duration: 2.5
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Defensive channel with no packets; only its long cast time and recharge affect the rotation.
  [ID.IMMUTABLE_STONE]: {
    name: 'Immutable Stone',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Hammer',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 1520,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: []
  },
  [ID.GROUND_POUND]: {
    name: 'Ground Pound',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Hammer',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 760,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2.8,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      { type: 'condition', condition: 'Bleeding', stacks: 5, duration: 6, metadata: {} },
      { type: 'condition', condition: 'Immobilize', stacks: 1, duration: 3, metadata: {} }
    ])
  },
  // Orb spender, deliberately attunement-agnostic: it is offered in any attunement but availability
  // requires an active orb matching the current one. The declared single projectile only documents the
  // per-orb packet shape — at cast time `scheduleGrandFinaleProfile` claims the skill and emits one
  // projectile finisher plus an element-specific condition for each orb it consumes.
  [ID.GRAND_FINALE]: {
    name: 'Grand Finale',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    categories: ['Weapon skill'],
    castTimeMs: 680,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 680,
            coefficient: 1.4,
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
      }
    ]
  }
});
