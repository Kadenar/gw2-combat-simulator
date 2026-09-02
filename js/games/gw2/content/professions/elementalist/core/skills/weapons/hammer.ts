/**
 * Hammer weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers slots 1-5 in all four attunements plus the attunement-independent Grand
 * Finale flipover. The slot-3 skills create the elemental orbs that Grand Finale
 * spends; the orb bookkeeping itself lives in `core/skills/hammer.ts`.
 */

import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import { conditionTimeline, strikeTimeline } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

// Hurricane of Pain uses canonical parallel timelines so every landed strike applies its matching Vulnerability.
const HURRICANE_OF_PAIN_TICKS = [200, 360, 600, 840, 1080, 1320, 1560, 1800, 2040] as const;

/**
 * Skill-id keyed fragments the Core module contributes to the hammer catalog.
 * Each entry declares the packet timeline the scheduler materializes for that skill.
 */
export const ELEMENTALIST_CORE_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SINGEING_STRIKE]: {
    name: 'Singeing Strike',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Hammer',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.69
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
            stacks: 1,
            duration: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.SURGING_FLAMES]: {
    name: 'Surging Flames',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Hammer',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 880,
    cooldown: 8,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 600,
            coefficient: 2.07
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 600,
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
  // Fire orb creator. The near-zero-coefficient packet stands in for the orb's own contact damage; the
  // orb's real payoff is the projectile Grand Finale later fires for it. `hammer-orbs` marks the skill
  // as state-gated (it is unavailable while its own orb is still active).
  [ID.FLAME_WHEEL]: {
    name: 'Flame Wheel',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1000,
            coefficient: 0.001,
            damageKind: 'field-tick'
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
            condition: 'Burning',
            stacks: 1,
            duration: 0.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'hammer-orbs'
  },
  // Three simultaneous strike/Burning pairs at a single packet time.
  [ID.TRIPLE_SEAR]: {
    name: 'Triple Sear',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Hammer',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 560,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
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
            atMs: 520,
            condition: 'Burning',
            stacks: 1,
            duration: 4
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
            atMs: 520,
            condition: 'Burning',
            stacks: 1,
            duration: 4
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
            atMs: 520,
            condition: 'Burning',
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
  // Blast finisher that also self-buffs, so its Fury and Might land on the same packet time as the strike.
  [ID.MOLTEN_END]: {
    name: 'Molten End',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Hammer',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 760,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 720,
            coefficient: 2.8,
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
        type: 'boon',
        boon: 'Fury',
        stacks: 1,
        duration: 10,
        atMs: 720,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Might',
        stacks: 6,
        duration: 10,
        atMs: 720,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
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
    quicknessCastTimeMs: 480,
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
    quicknessCastTimeMs: 640,
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
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: ID.STREAM_STRIKE,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 320,
            coefficient: 1.38
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 320,
            condition: 'Chilled',
            stacks: 1,
            duration: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
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
    quicknessCastTimeMs: 920,
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
      {
        type: 'strike',
        ticks: [
          {
            atMs: 880,
            coefficient: 0.575
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 880,
            condition: 'Chilled',
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
  // Water orb creator; same token-packet shape as Flame Wheel, applying Vulnerability instead of Burning.
  [ID.ICY_COIL]: {
    name: 'Icy Coil',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1000,
            coefficient: 0.001,
            damageKind: 'field-tick'
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
            condition: 'Vulnerability',
            stacks: 1,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'hammer-orbs'
  },
  // Leap finisher; the single impact is its whole payload.
  [ID.CRASHING_FONT]: {
    name: 'Crashing Font',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Hammer',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 960,
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
    quicknessCastTimeMs: 480,
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
    name: 'Wind Slam',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Hammer',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
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
    quicknessCastTimeMs: 2080,
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
    quicknessCastTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1000,
            coefficient: 0.001,
            damageKind: 'field-tick'
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
            condition: 'Weakness',
            stacks: 1,
            duration: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'hammer-orbs'
  },
  // Small strike that mainly exists for its self-Superspeed and crowd-control application.
  [ID.WIND_STORM]: {
    name: 'Wind Storm',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Hammer',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 440,
            coefficient: 0.3
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
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'control',
        atMs: 440,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ]
  },
  // Two-stage skill: a small hit at cast end, then the delayed blast finisher and crowd control together.
  [ID.SHOCK_BLAST]: {
    name: 'Shock Blast',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Hammer',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 280,
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
      {
        type: 'strike',
        ticks: [
          {
            atMs: 800,
            coefficient: 0.925,
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
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 800,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ]
  },
  [ID.STONESTRIKE]: {
    name: 'Stonestrike',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Hammer',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 560,
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
    quicknessCastTimeMs: 1440,
    cooldown: 8,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 0.84
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
            atMs: 760,
            coefficient: 0.84
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 760,
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
            atMs: 960,
            coefficient: 0.84
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 960,
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
            atMs: 1200,
            coefficient: 0.84
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1200,
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
            atMs: 1400,
            coefficient: 0.84
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1400,
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
  // Earth orb creator; same token-packet shape as Flame Wheel, applying Bleeding.
  [ID.ROCKY_LOOP]: {
    name: 'Rocky Loop',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1000,
            coefficient: 0.001,
            damageKind: 'field-tick'
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
            duration: 2.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'hammer-orbs'
  },
  // Defensive channel with no packets; only its long cast time and recharge affect the rotation.
  [ID.IMMUTABLE_STONE]: {
    name: 'Immutable Stone',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Hammer',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1520,
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
    quicknessCastTimeMs: 760,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 720,
            coefficient: 2.8,
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
            atMs: 720,
            condition: 'Bleeding',
            stacks: 5,
            duration: 6
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
            atMs: 720,
            condition: 'Immobilize',
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
    quicknessCastTimeMs: 680,
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
    ],
    elementalistStateMachine: 'hammer-orbs'
  }
});
