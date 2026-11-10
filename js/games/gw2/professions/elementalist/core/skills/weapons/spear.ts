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
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, STATUS, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/**
 * Complete spear declarations own presentation, cast timelines, emitted packets, and combo participation.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ElementalistSkill>>> = {
  [ID.FLAME_SPEAR]: {
    name: 'Flame Spear',
    icon: 'https://render.guildwars2.com/file/74B333AD21E95C9D63AE0128F2DDA7CBEE75A841/3379079.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 640,
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
    icon: 'https://render.guildwars2.com/file/FA97DE180DF595E721D064D7472DC7694D6F78B1/3379083.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire',

    cooldown: 6,
    skillFamily: 'Weapon skill',
    castTimeMs: 560,
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
    icon: 'https://render.guildwars2.com/file/409EE1CC3F41C1FC20B71D0944063179BB94C471/3379087.png',
    nextSkillDamageMultiplier: 1.2,
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    // Seethe empowers the next qualifying spear hit after completion.
    tasks: [
      {
        type: 'elementalist.core.arm-spear-damage',
        timingAnchor: 'castCommit'
      }
    ],
    castTimeMs: 360,
    // A captured entitlement follows the next spear activation, including its delayed packets after cast cleanup.
    modifiers: [
      {
        id: 'elementalist.seethe',
        scope: 'profession',
        target: 'strikeDamage',
        operation: 'multiply',
        factor: (context) => Number(context.event?.metadata?.elementalistSeetheDamageFactor),
        when: (context) =>
          isGw2PlayerModifierOwnedEvent(context.event) &&
          context.event?.metadata?.elementalistSeetheDamageFactor != null
      }
    ],
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'boon', boon: BOON.FURY, stacks: 1, duration: 4 },
      { type: 'boon', boon: BOON.MIGHT, stacks: 5, duration: 10 }
    ])
  },
  [ID.METEOR]: {
    name: 'Meteor',
    icon: 'https://render.guildwars2.com/file/FAE0AFE5623F58965BFC327F99105ED605E6B2F5/3379091.png',
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
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    interruptCommitMs: 640,
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
    name: 'Etching: Volcano',
    icon: 'https://render.guildwars2.com/file/037DCBFCCD3BA4C3ACC7B73DF4965D3A170F0F3E/3379099.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire',

    cooldown: 25,
    skillFamily: 'Weapon skill',
    castTimeMs: 240,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.FIRE,
        duration: 7,
        startAnchor: 'castEnd'
      }
    ],
    etchingReleases: { lesser: ID.LESSER_VOLCANO, full: ID.VOLCANO },
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
    ],
    // Open a field-length etching; the completion observer excludes this root from its own credits.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.open-etching' } }]
  },
  // Early payoff: six eruption packets whose coefficients decay from 0.63 down to 0.315.
  [ID.LESSER_VOLCANO]: {
    name: 'Lesser Volcano',
    icon: 'https://render.guildwars2.com/file/F17A92D0331607C7C59D0213ECE1C5F1C3770680/3379100.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
    etchingRootId: ID.ETCHING_VOLCANO,
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
    ],
    // A committed release consumes only its own etching and never advances another etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.consume-etching' } }]
  },
  // Full payoff: twelve eruption packets decaying from 1.21 to a 0.05 floor.
  [ID.VOLCANO]: {
    name: 'Volcano',
    // The etching release owns its distinct follow-up art.
    icon: 'https://render.guildwars2.com/file/334EA928E56F38C176A22415DE3ECE144C5FD5BB/3379101.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
    etchingRootId: ID.ETCHING_VOLCANO,
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
    ],
    // A committed release consumes only its own etching and never advances another etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.consume-etching' } }]
  },
  [ID.RESTORATIVE_SPEAR]: {
    name: 'Restorative Spear',
    icon: 'https://render.guildwars2.com/file/B756C80D01D7EAB61B7EBA231B029C7E9DBCAF54/3379080.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SPEAR,
    attunement: 'Water',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 640,
    // Preserve the released projectile when the remaining autoattack animation is cancelled.
    interruptCommitMs: 520,
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
    icon: 'https://render.guildwars2.com/file/076572AF05EF210B9CCA6422641A0AA52A6B9156/3379084.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SPEAR,
    attunement: 'Water',

    cooldown: 6,
    skillFamily: 'Weapon skill',
    castTimeMs: 840,
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
    icon: 'https://render.guildwars2.com/file/D246C6CE0468F2484643935675010B0A963EC9D8/3379088.png',
    nextSkillRechargeMultiplier: 0.67,
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SPEAR,
    attunement: 'Water',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    // Ripple empowers the next qualifying spear recharge after completion.
    tasks: [
      {
        type: 'elementalist.core.arm-spear-recharge',
        timingAnchor: 'castCommit'
      }
    ],
    castTimeMs: 800,
    effects: []
  },
  [ID.UNDERTOW]: {
    name: 'Undertow',
    icon: 'https://render.guildwars2.com/file/01E36A1DDA2D1709E109210A71041812F65C496B/3379092.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.SPEAR,
    attunement: 'Water',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.7, canCrit: true },
      { type: 'control', applications: 1, controlKind: CONTROL.PULL }
    ])
  },
  [ID.ETCHING_JO_KULHLAUP]: {
    name: 'Etching: Jökulhlaup',
    icon: 'https://render.guildwars2.com/file/7B61A40CFC6F2A9DE5A5414C50E87BD9D9711E43/3379102.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Water',

    cooldown: 25,
    skillFamily: 'Weapon skill',
    castTimeMs: 240,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.WATER,
        duration: 7,
        startAnchor: 'castEnd'
      }
    ],
    etchingReleases: { lesser: ID.LESSER_JO_KULHLAUP, full: ID.JO_KULHLAUP },
    effects: [],
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.open-etching' } }]
  },
  [ID.LESSER_JO_KULHLAUP]: {
    name: 'Lesser Jökulhlaup',
    icon: 'https://render.guildwars2.com/file/3333FBE3CB1331A40AC51903580FCFB09BC80335/3379103.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Water',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
    etchingRootId: ID.ETCHING_JO_KULHLAUP,
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
    ],
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.consume-etching' } }]
  },
  [ID.JO_KULHLAUP]: {
    name: 'Jökulhlaup',
    icon: 'https://render.guildwars2.com/file/48EB1A03297EE4DFA0FE2CA41F0B02B77302060B/3379104.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Water',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
    etchingRootId: ID.ETCHING_JO_KULHLAUP,
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
    ],
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.consume-etching' } }]
  },
  [ID.LIGHTNING_JAVELIN]: {
    name: 'Lightning Javelin',
    icon: 'https://render.guildwars2.com/file/0F2F5806E0C2424234562CF27B06606031B32DFE/3379077.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SPEAR,
    attunement: 'Air',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 640,
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
    name: 'Fulgor',
    icon: 'https://render.guildwars2.com/file/ECE34CA514D057F0166EC50EF9AB19751C53BE96/3379081.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SPEAR,
    attunement: 'Air',

    cooldown: 6,
    skillFamily: 'Weapon skill',
    castTimeMs: 560,
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
    ],
    // Replace the previous noncritical pulse stream while retaining the ordinary strike and Vulnerability.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.replace-fulgor',
          id: 'pulses',
          // The replaceable sequence owns this timeline independently of the ordinary attacks below.
          effects: [
            {
              type: 'strike',
              name: 'Fulgor',
              ticks: Array.from({ length: 6 }, (_, index) => ({
                atMs: 320 + index * 1000,
                coefficient: 0,
                flatStrikeBase: 200,
                flatStrikePowerCoeff: 0.4
              }))
            }
          ]
        }
      }
    ]
  },
  [ID.ENERGIZE]: {
    name: 'Energize',
    icon: 'https://render.guildwars2.com/file/0BA3490023A82B4B5FCA597C3CB965E21D3CE504/3379085.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SPEAR,
    attunement: 'Air',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    // Energize guarantees the next qualifying spear critical hit after completion.
    tasks: [
      {
        type: 'elementalist.core.arm-spear-critical',
        timingAnchor: 'castCommit'
      }
    ],
    castTimeMs: 0,
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
    icon: 'https://render.guildwars2.com/file/BAD1E32FA0F93A560B60DB703D716B70C6ED0F63/3379089.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.SPEAR,
    attunement: 'Air',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
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
    name: 'Etching: Derecho',
    icon: 'https://render.guildwars2.com/file/F1B3331AB23F37964BE8D6A91F43FF066BE970AA/3379093.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Air',

    cooldown: 25,
    skillFamily: 'Weapon skill',
    castTimeMs: 240,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.LIGHTNING,
        duration: 7,
        startAnchor: 'castEnd'
      }
    ],
    etchingReleases: { lesser: ID.LESSER_DERECHO, full: ID.DERECHO },
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
    ],
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.open-etching' } }]
  },
  [ID.LESSER_DERECHO]: {
    name: 'Lesser Derecho',
    icon: 'https://render.guildwars2.com/file/93950D05BFE50508031DA59BA0381252F60FEDBC/3379094.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Air',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
    etchingRootId: ID.ETCHING_DERECHO,
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2, canCrit: true },
      { type: 'control', applications: 1, controlKind: CONTROL.DAZE }
    ]),
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.consume-etching' } }]
  },
  [ID.DERECHO]: {
    name: 'Derecho',
    icon: 'https://render.guildwars2.com/file/94F1A894667CA4F3407C57B055F8236804264B1F/3379095.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Air',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
    etchingRootId: ID.ETCHING_DERECHO,
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 4, canCrit: true },
      { type: 'control', applications: 1, controlKind: CONTROL.DAZE }
    ]),
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.consume-etching' } }]
  },
  [ID.STONE_STRIKE]: {
    name: 'Stone Strike',
    icon: 'https://render.guildwars2.com/file/19C7C57CCB3B22A11D29684F35C967A5A66D5BE0/3379078.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SPEAR,
    attunement: 'Earth',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 640,
    interruptCommitMs: 560,
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.2 },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 5 }
    ])
  },
  [ID.EARTHEN_SPEAR]: {
    name: 'Earthen Spear',
    icon: 'https://render.guildwars2.com/file/98B2192A9DB346C7E2C90F0071A880737416F32E/3379082.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SPEAR,
    attunement: 'Earth',

    cooldown: 6,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
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
    icon: 'https://render.guildwars2.com/file/08F199900A0613B465DF63D1DA4D6647A954DE0B/3379086.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SPEAR,
    attunement: 'Earth',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    // Harden adds control to the next qualifying spear hit after completion.
    tasks: [
      {
        type: 'elementalist.core.arm-spear-control',
        timingAnchor: 'castCommit'
      }
    ],
    castTimeMs: 200,
    effects: []
  },
  [ID.FISSURE]: {
    name: 'Fissure',
    icon: 'https://render.guildwars2.com/file/51A85B4EC564F24A10EF7D982DDA73BF1940CA01/3379090.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.SPEAR,
    attunement: 'Earth',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    interruptCommitMs: 640,
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
    name: 'Etching: Haboob',
    icon: 'https://render.guildwars2.com/file/7C7339E9EA33F7CD05806CE20066DF0EC4673767/3379096.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Earth',

    cooldown: 25,
    skillFamily: 'Weapon skill',
    castTimeMs: 240,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.DARK,
        duration: 7,
        startAnchor: 'castEnd'
      }
    ],
    etchingReleases: { lesser: ID.LESSER_HABOOB, full: ID.HABOOB },
    effects: [],
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.open-etching' } }]
  },
  [ID.LESSER_HABOOB]: {
    name: 'Lesser Haboob',
    icon: 'https://render.guildwars2.com/file/E5FDD5E622E3DF73496BB35C0E33B429B8C5EB52/3379097.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Earth',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
    etchingRootId: ID.ETCHING_HABOOB,
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
    ]),
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.consume-etching' } }]
  },
  // Full payoff retains five-second Cripple and adds Vulnerability and Weakness to the Lesser version's effects.
  [ID.HABOOB]: {
    name: 'Haboob',
    icon: 'https://render.guildwars2.com/file/562F2D0ED67AD8453F9CA60F27DB154F2E7543FC/3379098.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.SPEAR,
    attunement: 'Earth',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
    etchingRootId: ID.ETCHING_HABOOB,
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
    ]),
    // Roots open their field-length window; releases consume only their own etching.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.consume-etching' } }]
  }
};
