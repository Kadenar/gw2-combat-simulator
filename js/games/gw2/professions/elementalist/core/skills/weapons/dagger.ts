/**
 * Dagger weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers slots 1-5 in all four attunements, including the Frost/Shocking aura
 * flipover pairs that swap between granting an aura and transmuting it.
 */
import {
  AURA,
  BOON,
  COMBO_FIELD,
  COMBO_FINISHER,
  CONDITION,
  CONTROL,
  RECIPIENT,
  WEAPON
} from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

// Cast-scaled packet data is authored on the Quickness timeline and expands only for slower casts.
const DRAKES_BREATH_TICK_OFFSETS_MS = [520, 760, 1000, 1240] as const;

/**
 * Skill-id keyed definitions the Core module contributes to the dagger catalog.
 * Each entry declares the packet timeline the scheduler materializes for that skill.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_DAGGER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ElementalistSkill>>> = {
  // Three claws are thrown together, so one packet time carries three independent strikes.
  [ID.DRAGONS_CLAW]: {
    name: "Dragon's Claw",
    icon: 'https://render.guildwars2.com/file/1663AA3AC00FA2F31C4DD4040A759EAB0307B92A/103211.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.DAGGER,
    attunement: 'Fire',

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
    icon: 'https://render.guildwars2.com/file/C87956461091440D784C4038510316AAAD7B63E8/103096.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.DAGGER,
    attunement: 'Fire',

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
    icon: 'https://render.guildwars2.com/file/6D6650C13B0DA019E8EEA0C50E5307C567D7405E/103373.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.DAGGER,
    attunement: 'Fire',

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
    icon: 'https://render.guildwars2.com/file/CD08FDC23B56EBB19C90B909C65D9EE4D9FFF8C8/103183.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.DAGGER,
    attunement: 'Fire',

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
    icon: 'https://render.guildwars2.com/file/ED2422E6051855A76214FA9F292525C1359F0B59/103296.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.DAGGER,
    attunement: 'Fire',

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
    icon: 'https://render.guildwars2.com/file/0C2C7C92336BFABD2B0A777358C608A0076B4063/102818.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.DAGGER,
    attunement: 'Water',

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
    icon: 'https://render.guildwars2.com/file/069C46F135A34A5E3F15270E3B086A25FA790D92/102780.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.DAGGER,
    attunement: 'Water',

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
    icon: 'https://render.guildwars2.com/file/C13AA7EC94200C0E7E24C4E47164183991107EA4/103243.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.DAGGER,
    attunement: 'Water',

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
    icon: 'https://render.guildwars2.com/file/0D5599084DE820990E9F6D5A6853900553B205BC/103077.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.DAGGER,
    attunement: 'Water',

    cooldown: 10,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: [{ type: 'aura', aura: AURA.FROST, duration: 10 }]
  },
  // Consumes the Frost Aura and flips the slot back to Frost Aura.
  [ID.TRANSMUTE_FROST]: {
    name: 'Transmute Frost',
    icon: 'https://render.guildwars2.com/file/CDD3E52A062BDACC552BC133EA2EC547610CB3BA/2029301.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.DAGGER,
    attunement: 'Water',

    cooldown: 10,
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
  // Heal/cleanse only: no offensive packets, so the definition exists to occupy cast time and recharge.
  [ID.CLEANSING_WAVE]: {
    name: 'Cleansing Wave',
    icon: 'https://render.guildwars2.com/file/180D2C7CDB69E301401509737CEC35F90D57E358/102819.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.DAGGER,
    attunement: 'Water',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 960,
    effects: []
  },
  // Two-hit auto-attack landing inside a single cast.
  [ID.LIGHTNING_WHIP]: {
    name: 'Lightning Whip',
    icon: 'https://render.guildwars2.com/file/AD9670FD92547F6254DFA9CC6BF3B49845DF0C07/102901.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.DAGGER,
    attunement: 'Air',

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
    icon: 'https://render.guildwars2.com/file/A7F6522CC73138ECBF15A04D62634A2FFFBFD246/103374.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.DAGGER,
    attunement: 'Air',

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
    icon: 'https://render.guildwars2.com/file/9D30A3547A777040C5FE730816A13932FDFDD77F/103104.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.DAGGER,
    attunement: 'Air',

    cooldown: 10,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: [{ type: 'aura', aura: AURA.SHOCKING, duration: 10 }]
  },
  // Consumes the Shocking Aura for a crit-capable strike plus a crowd-control application, then flips back.
  [ID.TRANSMUTE_LIGHTNING]: {
    name: 'Transmute Lightning',
    icon: 'https://render.guildwars2.com/file/469DCE91CAE2697309EE0BE616B70FBF6D03CC67/2029298.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.DAGGER,
    attunement: 'Air',

    cooldown: 10,
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
    icon: 'https://render.guildwars2.com/file/23066340DF3C6E4F06A1B105479809E1647FF5D6/103332.png',
    // Recharge policy applies this intrinsic on-hit reduction; the simulated target is always hit.
    rechargeMultiplier: 0.5,
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.DAGGER,
    attunement: 'Air',

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
    icon: 'https://render.guildwars2.com/file/2E2837AB65D4283DD23673CB21450A9CC5D2F07F/103384.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.DAGGER,
    attunement: 'Air',

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
    icon: 'https://render.guildwars2.com/file/65490660DC4D12927816F9A224CB982227597A35/103106.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.DAGGER,
    attunement: 'Earth',

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
    icon: 'https://render.guildwars2.com/file/0AFCBDA61E7BE315E50FE567B23632C803BF02A3/103107.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.DAGGER,
    attunement: 'Earth',

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
    icon: 'https://render.guildwars2.com/file/DA71280E1C50AB7F0901A2CD2597E3ACCC1D6665/534761.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.DAGGER,
    attunement: 'Earth',

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
    icon: 'https://render.guildwars2.com/file/01F24427AF4C18476A657647C39CB2F2374BDA57/102975.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.DAGGER,
    attunement: 'Earth',

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
    icon: 'https://render.guildwars2.com/file/4B3D497E0F070BEE66642AF6293A77B891CEA95C/102976.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.DAGGER,
    attunement: 'Earth',

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
};
