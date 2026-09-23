/**
 * Pistol weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers slots 1-3 in all four attunements plus the attunement-independent
 * Elemental Explosion. Most slot-2 and slot-3 skills either stock or spend an
 * elemental bullet; the bullet bookkeeping and the bonus effects a spent bullet
 * unlocks live in `core/mechanics/pistol-bullets.ts`, not in these fragments.
 */

import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Frigid Flurry fires five shots at these offsets, each an independent Bleeding stack and Projectile finisher.
const FRIGID_FLURRY_SHOT_OFFSETS_MS = [280, 440, 640, 800, 960];

/**
 * Skill-id keyed fragments the Core module contributes to the pistol catalog.
 * Each entry declares the packet timeline the scheduler materializes for that skill.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_PISTOL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SCORCHING_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Scorching Shot',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    // The projectile launches before impact, so cancelling its aftercast preserves the hit and Burning.
    interruptCommitMs: 320,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 1.5, metadata: {} }
      ]
    )
  },
  // Stocks a Fire bullet, or spends one for extra Might that the pistol cast handler adds on top of the
  // Might declared here. `pistol-bullets` marks the skill as bullet-state-gated for rotation analysis.
  [ID.RAGING_RICOCHET]: {
    name: 'Raging Ricochet',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Pistol',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    interruptCommitMs: 320,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.8 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 8, metadata: {} },
        { type: 'boon', boon: 'Might', stacks: 1, duration: 6, metadata: {} }
      ]
    )
  },
  // Blast finisher up front, then a four-shot salvo landing together a second later. Spending a Fire
  // bullet additionally grants a Fire Aura through the pistol cast handler.
  [ID.SEARING_SALVO]: {
    name: 'Searing Salvo',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 680,
    // The first projectile launches before the aftercast; its impact and follow-up salvo survive cancellation.
    interruptCommitMs: 320,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        {
          type: 'strike',
          coefficient: 1,
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
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 7, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.25 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.25 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.25 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.25 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ])
    ]
  },
  [ID.SOOTHING_SPLASH]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Soothing Splash',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Five-shot channel with a Bleeding stack per shot; `per-packet` interruption keeps only the shots
  // that already landed.
  [ID.FRIGID_FLURRY]: {
    name: 'Frigid Flurry',
    interruptMode: 'per-packet',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Pistol',
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 1000,
    cooldown: 5,
    skillFamily: 'Weapon skill',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: FRIGID_FLURRY_SHOT_OFFSETS_MS.map((atMs) => ({ atMs, coefficient: 0.2 })),
        comboFinishers: [
          {
            ownerId: 'elementalist',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        ticks: FRIGID_FLURRY_SHOT_OFFSETS_MS.map((atMs) => ({ atMs, condition: 'Bleeding', stacks: 1, duration: 7 })),
        metadata: {}
      }
    ])
  },
  // The released shot starts a four-second ice field. Its enhanced detonation
  // follows that field's expiry, independently of the remaining aftercast.
  [ID.FROZEN_FUSILLADE]: {
    name: 'Frozen Fusillade',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    interruptCommitMs: 320,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 320,
            coefficient: 0
          }
        ],
        comboFields: [{ ownerId: 'elementalist', fieldType: 'Ice', duration: 4 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      ...impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.75 },
        { type: 'condition', condition: 'Chilled', stacks: 1, duration: 1.5, metadata: {} }
      ])
    ]
  },
  [ID.ELECTRIC_EXPOSURE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Electric Exposure',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    // The launched projectile still applies its strike and Vulnerability after an aftercast cancellation.
    interruptCommitMs: 320,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 6, metadata: {} }
      ]
    )
  },
  // Strike plus crowd control; spending an Air bullet opens the Dazing Discharge window tracked in
  // profession state rather than adding packets here.
  [ID.DAZING_DISCHARGE]: {
    name: 'Dazing Discharge',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Pistol',
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 440,
    cooldown: 8,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.75, canCrit: true },
      { type: 'condition', condition: 'Vulnerability', stacks: 8, duration: 10, metadata: {} },
      { type: 'control', applications: 1, controlKind: 'crowd-control' }
    ])
  },
  // First link of the three-step Aerial Agility flipover chain. The zero-coefficient packet exists only
  // to fire the leap finisher. The chain reads the Air bullet without spending it, and the two later
  // links can never stock one.
  [ID.AERIAL_AGILITY]: {
    autoattack: false, // This manually activated flip chain reuses the scheduler's autoattack sequencing index.
    name: 'Aerial Agility',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    cooldown: 12,
    nextChainId: ID.AERIAL_AGILITY_CHAIN,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0,
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
  [ID.AERIAL_AGILITY_CHAIN]: {
    autoattack: false,
    name: 'Aerial Agility (chain)',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 480,
    cooldown: 0,
    nextChainId: ID.AERIAL_AGILITY_DASH,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.8 },
      { type: 'condition', condition: 'Weakness', stacks: 1, duration: 3, metadata: {} }
    ])
  },
  [ID.AERIAL_AGILITY_DASH]: {
    autoattack: false,
    name: 'Aerial Agility (dash)',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    cooldown: 0,
    nextChainId: ID.AERIAL_AGILITY,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: 'Leap',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      { type: 'boon', boon: 'Aegis', stacks: 1, duration: 3, metadata: {} }
    ])
  },
  [ID.PIERCING_PEBBLE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Piercing Pebble',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    // Release commits the projectile one action tick before its hit and Bleeding land.
    interruptCommitMs: 320,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.35 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 5, metadata: {} }
      ]
    )
  },
  [ID.SHATTERING_STONE]: {
    name: 'Shattering Stone',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Pistol',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    interruptCommitMs: 400,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.8 },
      { type: 'condition', condition: 'Bleeding', stacks: 3, duration: 10, metadata: {} }
    ])
  },
  [ID.BOULDER_BLAST]: {
    name: 'Boulder Blast',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 440,
    // Releasing the boulder commits its damage and conditions before the remaining cast animation ends.
    interruptCommitMs: 360,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.44,
          comboFinishers: [
            {
              attemptGroup: 'effect:1:tick:1',
              ownerId: 'elementalist',
              finisherType: 'Projectile',
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {}
        },
        { type: 'condition', condition: 'Bleeding', stacks: 5, duration: 8, metadata: {} },
        { type: 'condition', condition: 'Immobilize', stacks: 1, duration: 1.5, metadata: {} }
      ]
    )
  },
  [ID.ELEMENTAL_EXPLOSION]: {
    name: 'Elemental Explosion',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    // The explosion commits before its projectile packets, which persist after a 480 ms interruption.
    interruptCommitMs: 480,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    // Elemental Explosion consumes every stored bullet and grants the current attunement's aura.
    mechanicTriggers: [
      {
        type: 'elementalist.core.consume-elemental-explosion',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.2 },
        // Apply each Burning stack separately so same-impact relic checks observe every application.
        ...Array.from({ length: 2 }, () => ({
          type: 'condition' as const,
          condition: 'Burning' as const,
          stacks: 1,
          duration: 6,
          metadata: {}
        }))
      ]),
      ...impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.2 },
        { type: 'condition', condition: 'Bleeding', stacks: 4, duration: 6, metadata: {} }
      ]),
      ...impactEffects({ atMs: 680, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.2 },
        { type: 'condition', condition: 'Vulnerability', stacks: 4, duration: 10, metadata: {} }
      ]),
      ...impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.2 },
        { type: 'condition', condition: 'Cripple', stacks: 1, duration: 4, metadata: {} }
      ])
    ]
  }
});
