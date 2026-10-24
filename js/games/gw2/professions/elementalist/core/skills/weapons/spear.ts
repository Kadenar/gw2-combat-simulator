import { WEAPON, COMBO_FINISHER, COMBO_FIELD, STATUS, BOON, CONDITION, CONTROL } from '#gw2/platform/constants.js';
/**
 * Spear weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers slots 1-5 across all four attunements, including the two spear-specific systems:
 * the slot-3 follow-up empowerments (Seethe/Ripple/Energize/Harden arm a one-shot bonus on
 * the next qualifying spear cast) and the slot-5 Etching chains, where `Etching: X` places a
 * combo field and unlocks `Lesser X`, which three further casts upgrade to the full `X`.
 *
 * Declarative data only: the named `tasks` are implemented by
 * `core/execution/index.ts`, the chain/stage gating lives in
 * `core/mechanics/availability.ts`, and the table is merged in by `core/skills/index.ts`.
 */

import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/**
 * Skill-id keyed fragments the catalog layers over the raw spear skill records so the
 * simulator knows each skill's cast timeline, emitted packets, and combo participation.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.FLAME_SPEAR]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Flame Spear',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 640,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    // EVTC damage lands 520ms after activation; once the projectile reaches that
    // commit point, preserve its impact even if the remaining animation is cancelled.
    interruptCommitMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.BLAZING_BARRAGE]: {
    name: 'Blazing Barrage',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 560,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2.6,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 5 }
    ])
  },
  [ID.SEETHE]: {
    name: 'Seethe',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 360,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    // Seethe empowers the next qualifying spear hit after completion.
    tasks: [
      {
        type: 'elementalist.core.arm-spear-damage',
        timingAnchor: 'castCommit'
      }
    ],
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'boon', boon: BOON.FURY, stacks: 1, duration: 4 },
      { type: 'boon', boon: BOON.MIGHT, stacks: 5, duration: 10 }
    ])
  },
  [ID.METEOR]: {
    // The simulator assumes a center hit; keep its bonus independent of the base coefficient.
    modifiers: [
      {
        id: 'elementalist.meteor-center-impact',
        label: 'Meteor - center impact',
        target: 'strikeDamage',
        operation: 'multiply',
        factor: 1.25
      }
    ],
    name: 'Meteor',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 680,
    interruptCommitMs: 640,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 560,
            coefficient: 2.7
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  // Etching root: lays the fire field and arms the Volcano chain at its `lesser` stage; the
  // payoff skills below occupy the same slot and are gated on that stage.
  [ID.ETCHING_VOLCANO]: {
    // Open a field-length etching; the completion observer excludes this root from its own credits.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.open-etching' } }],
    name: 'Etching: Volcano',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 240,
    cooldown: 25,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.FIRE,
        duration: 7,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 1,
        duration: 8,
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Early payoff: six eruption packets whose coefficients decay from 0.63 down to 0.315.
  [ID.LESSER_VOLCANO]: {
    // A committed release consumes only its own etching and never advances another etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.consume-etching' } }],
    name: 'Lesser Volcano',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 600,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1520,
            coefficient: 0.63
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1800,
            coefficient: 0.567
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 2080,
            coefficient: 0.504
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 2360,
            coefficient: 0.441
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 2640,
            coefficient: 0.378
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 2920,
            coefficient: 0.315
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Full payoff: twelve eruption packets decaying from 1.21 to a 0.05 floor.
  [ID.VOLCANO]: {
    // A committed release consumes only its own etching and never advances another etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.consume-etching' } }],
    name: 'Volcano',
    // Pin release art because API name lookup does not resolve the etching follow-up reliably.
    icon: 'https://render.guildwars2.com/file/334EA928E56F38C176A22415DE3ECE144C5FD5BB/3379101.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 600,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          [1560, 1.21],
          [1800, 1.089],
          [2120, 0.968],
          [2400, 0.847],
          [2640, 0.726],
          [2920, 0.605],
          [3240, 0.484],
          [3480, 0.363],
          [3760, 0.242],
          [4040, 0.121],
          [4320, 0.05],
          [4640, 0.05]
        ].map(([atMs, coefficient]) => ({ atMs, coefficient })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.RESTORATIVE_SPEAR]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Restorative Spear',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SPEAR,
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 640,
    // Preserve the released projectile when the remaining autoattack animation is cancelled.
    interruptCommitMs: 520,
    cooldown: 0,
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
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  // Three beam pulses at 360/520/720ms, each applying its own one-second Chilled stack.
  [ID.ICE_BEAM]: {
    name: 'Ice Beam',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SPEAR,
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 840,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.7 },
        { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 1 }
      ]),
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.7 },
        { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 1 }
      ]),
      ...impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.7 },
        { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 1 }
      ])
    ]
  },
  [ID.RIPPLE]: {
    name: 'Ripple',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SPEAR,
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 800,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    // Ripple empowers the next qualifying spear recharge after completion.
    tasks: [
      {
        type: 'elementalist.core.arm-spear-recharge',
        timingAnchor: 'castCommit'
      }
    ],
    effects: []
  },
  [ID.UNDERTOW]: {
    name: 'Undertow',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.SPEAR,
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 600,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.7, canCrit: true },
      { type: 'control', applications: 1, controlKind: CONTROL.PULL }
    ])
  },
  [ID.ETCHING_JO_KULHLAUP]: {
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.open-etching' } }],
    name: 'Etching: Jökulhlaup',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 240,
    cooldown: 25,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.WATER,
        duration: 7,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    effects: []
  },
  [ID.LESSER_JO_KULHLAUP]: {
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.consume-etching' } }],
    name: 'Lesser Jökulhlaup',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 600,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 560,
            coefficient: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.JO_KULHLAUP]: {
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.consume-etching' } }],
    name: 'Jökulhlaup',
    icon: 'https://render.guildwars2.com/file/48EB1A03297EE4DFA0FE2CA41F0B02B77302060B/3379104.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 600,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 560,
            coefficient: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.LIGHTNING_JAVELIN]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Lightning Javelin',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SPEAR,
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 640,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    // EVTC damage lands 520ms after activation; once the projectile reaches that
    // commit point, preserve its strike and vulnerability if the animation is cancelled.
    interruptCommitMs: 520,
    effects: impactEffects(
      { atMs: 520, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 1.35 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 6 }
      ]
    )
  },
  // Lingering aura: five pulses one second apart, each a strike plus one Vulnerability stack,
  // so most of the damage lands well after the 560ms cast.
  [ID.FULGOR]: {
    // Replace the previous noncritical pulse stream while retaining the ordinary strike and Vulnerability.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.replace-fulgor' } }],
    name: 'Fulgor',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SPEAR,
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 560,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.4 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 6 }
      ]),
      ...impactEffects({ atMs: 1480, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.4 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 6 }
      ]),
      ...impactEffects({ atMs: 2480, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.4 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 6 }
      ]),
      ...impactEffects({ atMs: 3480, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.4 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 6 }
      ]),
      ...impactEffects({ atMs: 4480, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.4 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 6 }
      ])
    ]
  },
  [ID.ENERGIZE]: {
    name: 'Energize',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SPEAR,
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    // Energize guarantees the next qualifying spear critical hit after completion.
    tasks: [
      {
        type: 'elementalist.core.arm-spear-critical',
        timingAnchor: 'castCommit'
      }
    ],
    effects: [
      {
        type: 'buff',
        kind: STATUS.SUPERSPEED,
        stacks: 1,
        duration: 4,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.TWISTER]: {
    name: 'Twister',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.SPEAR,
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 600,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.84,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST
          }
        ],

        canCrit: true
      },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 10, duration: 10 },
      { type: 'control', applications: 1, controlKind: CONTROL.FLOAT }
    ])
  },
  [ID.ETCHING_DERECHO]: {
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.open-etching' } }],
    name: 'Etching: Derecho',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 240,
    cooldown: 25,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.LIGHTNING,
        duration: 7,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'boon',
        boon: BOON.FURY,
        stacks: 1,
        duration: 7,
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.LESSER_DERECHO]: {
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.consume-etching' } }],
    name: 'Lesser Derecho',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 600,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2, canCrit: true },
      { type: 'control', applications: 1, controlKind: CONTROL.DAZE }
    ])
  },
  [ID.DERECHO]: {
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.consume-etching' } }],
    name: 'Derecho',
    icon: 'https://render.guildwars2.com/file/94F1A894667CA4F3407C57B055F8236804264B1F/3379095.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 600,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 4, canCrit: true },
      { type: 'control', applications: 1, controlKind: CONTROL.DAZE }
    ])
  },
  [ID.STONE_STRIKE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Stone Strike',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SPEAR,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 640,
    interruptCommitMs: 560,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.2 },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 5 }
    ])
  },
  [ID.EARTHEN_SPEAR]: {
    name: 'Earthen Spear',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SPEAR,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 680,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 3,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 5 }
    ])
  },
  [ID.HARDEN]: {
    name: 'Harden',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SPEAR,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 200,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    // Harden adds control to the next qualifying spear hit after completion.
    tasks: [
      {
        type: 'elementalist.core.arm-spear-control',
        timingAnchor: 'castCommit'
      }
    ],
    effects: []
  },
  [ID.FISSURE]: {
    name: 'Fissure',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.SPEAR,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 680,
    interruptCommitMs: 640,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: impactEffects(
      { atMs: 560, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 3.375 },
        { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 4 },
        { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 4 }
      ]
    )
  },
  // Earth's etching root is the odd one out: it lays a Dark field rather than an elemental one.
  [ID.ETCHING_HABOOB]: {
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.open-etching' } }],
    name: 'Etching: Haboob',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 240,
    cooldown: 25,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.DARK,
        duration: 7,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    effects: []
  },
  [ID.LESSER_HABOOB]: {
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.consume-etching' } }],
    name: 'Lesser Haboob',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 600,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.75 },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 3,
        applications: 1
      },
      { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 5 }
    ])
  },
  // Full payoff retains five-second Cripple and adds Vulnerability and Weakness to the Lesser version's effects.
  [ID.HABOOB]: {
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.consume-etching' } }],
    name: 'Haboob',
    icon: 'https://render.guildwars2.com/file/562F2D0ED67AD8453F9CA60F27DB154F2E7543FC/3379098.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 600,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 4.25 },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 3,
        applications: 1
      },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 5, duration: 6 },
      { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 4 },
      { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 5 }
    ])
  }
});
