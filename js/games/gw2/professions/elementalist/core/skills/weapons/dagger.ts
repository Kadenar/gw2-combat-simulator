import {
  WEAPON,
  COMBO_FIELD,
  COMBO_FINISHER,
  AURA,
  RECIPIENT,
  BOON,
  CONDITION,
  CONTROL
} from '#gw2/platform/constants.js';
/**
 * Dagger weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers slots 1-5 in all four attunements, including the Frost/Shocking aura
 * flipover pairs that swap between granting an aura and transmuting it.
 */

import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Cast-scaled packet data is authored on the Quickness timeline and expands only for slower casts.
const DRAKES_BREATH_TICK_OFFSETS_MS = [520, 760, 1000, 1240] as const;

/**
 * Skill-id keyed fragments the Core module contributes to the dagger catalog.
 * Each entry declares the packet timeline the scheduler materializes for that skill.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_DAGGER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Three claws are thrown together, so one packet time carries three independent strikes.
  [ID.DRAGONS_CLAW]: {
    name: "Dragon's Claw",
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.DAGGER,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 720,
    // The three projectiles commit together by 440 ms; cancelling the aftercast keeps their damage and lockout.
    interruptCommitMs: 440,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.35,
        hits: 3,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  // Channelled flame cone: four evenly spaced strike/Burning pairs. `per-packet` interruption keeps
  // only the ticks that already landed when the channel is cut short.
  [ID.DRAKES_BREATH]: {
    name: "Drake's Breath",
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.DAGGER,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    cooldown: 5,
    skillFamily: 'Weapon skill',
    castTimeMs: 1360,
    interruptMode: 'per-packet',
    // Share the channel timing while retaining each timeline's packet indices and interruption behavior.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: DRAKES_BREATH_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 1.05
        }))
      },
      {
        type: 'condition',
        ticks: DRAKES_BREATH_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 4
        }))
      }
    ])
  },
  // Leap impact plus a lingering fire field: the trailing packets are tagged `field-tick` so Persisting
  // Flames can recognize and extend them along with the field itself.
  [ID.BURNING_SPEED]: {
    name: 'Burning Speed',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.DAGGER,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    cooldown: 12,
    skillFamily: 'Weapon skill',
    castTimeMs: 800,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.FIRE,
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      ...impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 3 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ]),
      // The fire trail Burning Speed leaves behind pulses its strike and Burning once per second.
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'strike',
          coefficient: 0.2,
          damageKind: 'field-tick',
          atMs: 160,
          applications: 5,
          intervalMs: 1000
        },
        {
          type: 'condition',
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 2,
          atMs: 160,
          applications: 5,
          intervalMs: 1000
        }
      ])
    ]
  },
  // Single hit that also lays a five-second fire field for other skills to finish in.
  [ID.RING_OF_FIRE]: {
    name: 'Ring of Fire',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.DAGGER,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 480,
    // The field is committed before the final 40 ms of aftercast.
    interruptCommitMs: 440,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.FIRE,
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2 },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 2,
        duration: 4
      }
    ])
  },
  [ID.FIRE_GRAB]: {
    name: 'Fire Grab',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.DAGGER,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 560,
    interruptCommitMs: 480,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 480,
            coefficient: 3.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  // The blade strikes outbound and again on its return a second later, each pass applying Vulnerability.
  [ID.VAPOR_BLADE]: {
    name: 'Vapor Blade',
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.DAGGER,
    attunement: 'Water',
    categories: ['Weapon skill'],
    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 360,
    effects: [
      ...impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 6 }
      ]),
      ...impactEffects({ atMs: 1360, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 6 }
      ])
    ]
  },
  // Four-tick channel, each tick declared as its own strike packet.
  [ID.CONE_OF_COLD]: {
    name: 'Cone of Cold',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.DAGGER,
    attunement: 'Water',
    categories: ['Weapon skill'],
    cooldown: 10,
    skillFamily: 'Weapon skill',
    castTimeMs: 1360,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 0.6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 760,
            coefficient: 0.6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1000,
            coefficient: 0.6
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
            coefficient: 0.6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Blast finisher that lands before its own ice field opens at cast end, so it can only finish an earlier field.
  [ID.FROZEN_BURST]: {
    name: 'Frozen Burst',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.DAGGER,
    attunement: 'Water',
    categories: ['Weapon skill'],
    cooldown: 12,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.ICE,
        duration: 2,
        startAnchor: 'castEnd'
      }
    ],
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.4,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 3 }
    ])
  },
  // Instant aura grant that flips the slot to Transmute Frost; the declared effect grants the aura.
  [ID.FROST_AURA]: {
    name: AURA.FROST,
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.DAGGER,
    attunement: 'Water',
    categories: ['Weapon skill'],
    cooldown: 10,
    nextChainId: ID.TRANSMUTE_FROST,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: [{ type: 'aura', aura: AURA.FROST, duration: 10 }]
  },
  // Consumes the Frost Aura and flips the slot back to Frost Aura.
  [ID.TRANSMUTE_FROST]: {
    name: 'Transmute Frost',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.DAGGER,
    attunement: 'Water',
    categories: ['Weapon skill'],
    cooldown: 10,
    nextChainId: ID.FROST_AURA,
    skillFamily: 'Weapon skill',
    castTimeMs: 360,
    effects: impactEffects({ atMs: 840, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.5 },
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        // Share this support boon with affected allies within its recipient cap.
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        stacks: 1,
        duration: 4
      }
    ]),
    // Consume all live matching auras on commitment, regardless of which skill or trait granted them.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.transmute-aura' } }]
  },
  // Heal/cleanse only: no offensive packets, so the fragment exists to occupy cast time and recharge.
  [ID.CLEANSING_WAVE]: {
    name: 'Cleansing Wave',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.DAGGER,
    attunement: 'Water',
    categories: ['Weapon skill'],
    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 960,
    effects: []
  },
  // Two-hit auto-attack landing inside a single cast.
  [ID.LIGHTNING_WHIP]: {
    name: 'Lightning Whip',
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.DAGGER,
    attunement: 'Air',
    categories: ['Weapon skill'],
    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 640,
    // Cutting the two-hit attack short keeps only strikes that have already landed.
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
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
            atMs: 560,
            coefficient: 0.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Delayed payload: the blast plus Weakness and Fury resolve roughly a second after the short cast ends.
  [ID.CONVERGENCE]: {
    name: 'Convergence',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.DAGGER,
    attunement: 'Air',
    categories: ['Weapon skill'],
    cooldown: 8,
    skillFamily: 'Weapon skill',
    castTimeMs: 360,
    effects: impactEffects({ atMs: 1320, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2.4,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 3 },
      { type: 'boon', boon: BOON.FURY, stacks: 1, duration: 2.5 }
    ])
  },
  // Air-attunement counterpart of the Frost Aura pair: grants the aura and flips to Transmute Lightning.
  [ID.SHOCKING_AURA]: {
    name: AURA.SHOCKING,
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.DAGGER,
    attunement: 'Air',
    categories: ['Weapon skill'],
    cooldown: 10,
    nextChainId: ID.TRANSMUTE_LIGHTNING,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: [{ type: 'aura', aura: AURA.SHOCKING, duration: 10 }]
  },
  // Consumes the Shocking Aura for a crit-capable strike plus a crowd-control application, then flips back.
  [ID.TRANSMUTE_LIGHTNING]: {
    name: 'Transmute Lightning',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.DAGGER,
    attunement: 'Air',
    categories: ['Weapon skill'],
    cooldown: 10,
    nextChainId: ID.SHOCKING_AURA,
    skillFamily: 'Weapon skill',
    castTimeMs: 360,
    interruptCommitMs: 280,
    effects: impactEffects(
      { atMs: 840, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 1.5, canCrit: true },
        { type: 'control', applications: 1, controlKind: CONTROL.STUN }
      ]
    ),
    // Consume all live matching auras on commitment, regardless of which skill or trait granted them.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.transmute-aura' } }]
  },
  [ID.RIDE_THE_LIGHTNING]: {
    name: 'Ride the Lightning',
    // Recharge policy applies this intrinsic on-hit reduction; the simulated target is always hit.
    rechargeMultiplier: 0.5,
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.DAGGER,
    attunement: 'Air',
    categories: ['Weapon skill'],
    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 120,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 80,
            coefficient: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.UPDRAFT]: {
    name: 'Updraft',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.DAGGER,
    attunement: 'Air',
    categories: ['Weapon skill'],
    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 880,
    effects: impactEffects({ atMs: 880, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        // Updraft's launch registers a 0-damage strike, which is what lets it
        // trigger on-hit effects such as Relic of Fireworks despite dealing no
        // damage.
        type: 'strike',
        coefficient: 0
      },
      { type: 'boon', boon: BOON.SWIFTNESS, stacks: 1, duration: 10 },
      { type: 'control', applications: 1, controlKind: CONTROL.LAUNCH }
    ])
  },
  [ID.IMPALE]: {
    name: 'Impale',
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.DAGGER,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
    effects: impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.77 },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 10 }
    ])
  },
  // Two impacts within one cast — the small initial hit and the larger delayed one — each carrying its
  // own Bleeding and Cripple application.
  [ID.RING_OF_EARTH]: {
    name: 'Ring of Earth',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.DAGGER,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    cooldown: 6,
    skillFamily: 'Weapon skill',
    castTimeMs: 880,
    effects: [
      ...impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 3, duration: 6 },
        { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 2 }
      ]),
      ...impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1.9 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 3, duration: 6 },
        { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 2 }
      ])
    ]
  },
  [ID.EARTHEN_RUSH]: {
    name: 'Earthen Rush',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.DAGGER,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    cooldown: 12,
    skillFamily: 'Weapon skill',
    castTimeMs: 640,
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2.3,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.LEAP
          }
        ]
      },
      { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 2 }
    ])
  },
  [ID.EARTHQUAKE]: {
    name: 'Earthquake',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.DAGGER,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    cooldown: 16,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    interruptCommitMs: 640,
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 3,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST
          }
        ],

        canCrit: true
      },
      { type: 'control', applications: 1, controlKind: CONTROL.KNOCKDOWN }
    ])
  },
  // The zero-coefficient packet at cast start exists only to fire the blast finisher at channel start;
  // the damage and conditions land with the eruption near cast end.
  [ID.CHURNING_EARTH]: {
    name: 'Churning Earth',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.DAGGER,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 960,
    // The eruption commits at 800 ms; cancelling the remaining aftercast keeps its damage and conditions.
    interruptCommitMs: 800,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: COMBO_FINISHER.BLAST
              }
            ]
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 3 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 10, duration: 8 },
        { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 4 }
      ])
    ]
  }
});
