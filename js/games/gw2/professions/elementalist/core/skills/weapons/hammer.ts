/**
 * Hammer weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers slots 1-5 in all four attunements plus the attunement-independent Grand
 * Finale flipover. The slot-3 skills create the elemental orbs that Grand Finale
 * spends; the orb bookkeeping itself lives in `core/mechanics/hammer-orbs.ts`.
 */
import { BOON, COMBO_FINISHER, CONDITION, CONTROL, STATUS, WEAPON } from '#gw2/platform/constants.js';
import { conditionTimeline, impactEffects, strikeTimeline } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

// Hurricane of Pain uses canonical parallel timelines so every landed strike applies its matching Vulnerability.
const HURRICANE_OF_PAIN_TICKS = [200, 360, 600, 840, 1080, 1320, 1560, 1800, 2040] as const;

// Each active hammer orb contacts the target once per second for its fifteen-second lifetime.
const HAMMER_ORB_PACKET_OFFSETS_MS = Array.from({ length: 15 }, (_, index) => (index + 1) * 1000);

/**
 * Skill-id keyed definitions the Core module contributes to the hammer catalog.
 * Each entry declares the packet timeline the scheduler materializes for that skill.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ElementalistSkill>>> = {
  [ID.SINGEING_STRIKE]: {
    name: 'Singeing Strike',
    icon: 'https://render.guildwars2.com/file/00BEB69094655BD530E92C5805D22E954EA82934/2491574.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.HAMMER,
    attunement: 'Fire',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.69 },
      { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 1.5 }
    ])
  },
  [ID.SURGING_FLAMES]: {
    name: 'Surging Flames',
    icon: 'https://render.guildwars2.com/file/D81EC0403633577CF616284B16E8607F9DCFAF01/2491577.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.HAMMER,
    attunement: 'Fire',

    cooldown: 8,
    skillFamily: 'Weapon skill',
    castTimeMs: 880,
    effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2.07 },
      { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 3 }
    ])
  },
  // Fire orb creator. The near-zero-coefficient packets represent the orb's repeated contact damage; the
  // orb's real payoff is the projectile Grand Finale later fires for it. `hammer-orbs` marks the skill
  // as state-gated (it is unavailable while its own orb is still active).
  [ID.FLAME_WHEEL]: {
    name: 'Flame Wheel',
    icon: 'https://render.guildwars2.com/file/0EEEDE3EC37F7A6E1BC9BE20B69E3B2C09F5072F/2491582.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.HAMMER,
    attunement: 'Fire',

    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
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
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 0.75
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // Create this element's orb and refresh existing orb lifetimes without duplicating their buffs.
    orbDuration: 15,
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.create-hammer-orbs' } }]
  },
  // Three simultaneous strike/Burning pairs at a single packet time.
  [ID.TRIPLE_SEAR]: {
    name: 'Triple Sear',
    icon: 'https://render.guildwars2.com/file/16CA6B0D615A0B439EA3F85DFCAF1C2BC63D6FD9/2491586.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.HAMMER,
    attunement: 'Fire',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 560,
    effects: [
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 4 }
      ]),
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 4 }
      ]),
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 4 }
      ])
    ]
  },
  // Blast finisher that also self-buffs, so its Fury and Might land on the same packet time as the strike.
  [ID.MOLTEN_END]: {
    name: 'Molten End',
    icon: 'https://render.guildwars2.com/file/B4EB30B7559BAEB905DC2E45979A9F46EF9F6167/2491590.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.HAMMER,
    attunement: 'Fire',

    cooldown: 25,
    skillFamily: 'Weapon skill',
    castTimeMs: 760,
    effects: impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2.8,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      { type: 'boon', boon: BOON.FURY, stacks: 1, duration: 10 },
      { type: 'boon', boon: BOON.MIGHT, stacks: 6, duration: 10 }
    ])
  },
  // First link of the Water auto-attack chain: Stream Strike -> Water Rush -> Chilling Crack -> back to
  // Stream Strike, declared in autoattack-chains.ts.
  [ID.STREAM_STRIKE]: {
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Stream Strike',
    icon: 'https://render.guildwars2.com/file/D8231F47FCFDD867032FFC79F5C21C0B750A99C0/2491570.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.HAMMER,
    attunement: 'Water',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 480,
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
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Water Rush',
    icon: 'https://render.guildwars2.com/file/664C1C80D2C31756C4F2CA333A317E71CAC6C37B/2491571.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.HAMMER,
    attunement: 'Water',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 640,
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
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Chilling Crack',
    icon: 'https://render.guildwars2.com/file/4DC67D26F6130171F50398B50009AA321D9E1830/2491572.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.HAMMER,
    attunement: 'Water',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.38 },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 1.5 }
    ])
  },
  // Four-hit channel where only the final blow applies Chilled; `per-packet` interruption keeps just the
  // hits that landed before the cancel.
  [ID.RAIN_OF_BLOWS]: {
    name: 'Rain of Blows',
    icon: 'https://render.guildwars2.com/file/D99067FBF027EE43B2DC727E54C0B4716CFB59A1/2491578.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.HAMMER,
    attunement: 'Water',

    cooldown: 6,
    skillFamily: 'Weapon skill',
    castTimeMs: 920,
    interruptMode: 'per-packet',
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
        { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 3 }
      ])
    ]
  },
  // Water orb creator; same token-packet shape as Flame Wheel, applying Vulnerability instead of Burning.
  [ID.ICY_COIL]: {
    name: 'Icy Coil',
    icon: 'https://render.guildwars2.com/file/4CEE16E97EF99A6C4DEF356CE8650DB73B062A04/2491583.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.HAMMER,
    attunement: 'Water',

    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
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
          condition: CONDITION.VULNERABILITY,
          stacks: 1,
          duration: 6
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // Create this element's orb and refresh existing orb lifetimes without duplicating their buffs.
    orbDuration: 15,
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.create-hammer-orbs' } }]
  },
  // Leap finisher; the single impact is its whole payload.
  [ID.CRASHING_FONT]: {
    name: 'Crashing Font',
    icon: 'https://render.guildwars2.com/file/696F0A9FE6A47427615949AE383D5AC3EA45F1F3/2491587.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.HAMMER,
    attunement: 'Water',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 960,
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
                finisherType: COMBO_FINISHER.LEAP
              }
            ]
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
    icon: 'https://render.guildwars2.com/file/14B9C705D8A901E0425663521CCE6B78DF1D410F/2491591.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.HAMMER,
    attunement: 'Water',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 480,
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
                finisherType: COMBO_FINISHER.WHIRL
              }
            ]
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.WIND_SLAM]: {
    name: 'Wind Slam',
    icon: 'https://render.guildwars2.com/file/F6B968A25DCB611A00580215DF0E276B04CEFFE7/2491569.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.HAMMER,
    attunement: 'Air',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
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
    icon: 'https://render.guildwars2.com/file/E8D673F59599BCF155D4FE4503476C666B935075/2491575.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.HAMMER,
    attunement: 'Air',

    cooldown: 10,
    skillFamily: 'Weapon skill',
    castTimeMs: 2080,
    interruptMode: 'per-packet',
    effects: [
      strikeTimeline(
        HURRICANE_OF_PAIN_TICKS.map((atMs) => ({ atMs, coefficient: 0.55 })),
        { timingAnchor: 'castStart', timingScale: 'cast' }
      ),
      conditionTimeline(
        HURRICANE_OF_PAIN_TICKS.map((atMs) => ({
          atMs,
          condition: CONDITION.VULNERABILITY,
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
    icon: 'https://render.guildwars2.com/file/A1154443E7FB75409FC77711E50D186D449670CF/2491579.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.HAMMER,
    attunement: 'Air',

    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
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
          condition: CONDITION.WEAKNESS,
          stacks: 1,
          duration: 1.5
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // Create this element's orb and refresh existing orb lifetimes without duplicating their buffs.
    orbDuration: 15,
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.create-hammer-orbs' } }]
  },
  // Small strike that mainly exists for its self-Superspeed and crowd-control application.
  [ID.WIND_STORM]: {
    name: 'Wind Storm',
    icon: 'https://render.guildwars2.com/file/386F6D7F9E7ECBCBD1C7ED80CCDCCD9BE99690EC/2491584.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.HAMMER,
    attunement: 'Air',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.3, canCrit: true },
      { type: 'buff', kind: STATUS.SUPERSPEED, stacks: 1, duration: 3 },
      { type: 'control', applications: 1, controlKind: CONTROL.KNOCKDOWN }
    ])
  },
  // Two-stage skill: a small hit at cast end, then the delayed blast finisher and crowd control together.
  [ID.SHOCK_BLAST]: {
    name: 'Shock Blast',
    icon: 'https://render.guildwars2.com/file/BA43003E3BB4F469C25F407FAC9A04AC1D589E46/2491588.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.HAMMER,
    attunement: 'Air',

    cooldown: 25,
    skillFamily: 'Weapon skill',
    castTimeMs: 280,
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
              finisherType: COMBO_FINISHER.BLAST
            }
          ],

          canCrit: true
        },
        { type: 'control', applications: 1, controlKind: CONTROL.STUN }
      ])
    ]
  },
  [ID.STONESTRIKE]: {
    name: 'Stonestrike',
    icon: 'https://render.guildwars2.com/file/934D05DE73D0ECFF931C394B7CFA67686B0F639D/2491573.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.HAMMER,
    attunement: 'Earth',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 560,
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
    icon: 'https://render.guildwars2.com/file/AC997D78FFB009EF66423A2D0591FB6E604357E8/2491576.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.HAMMER,
    attunement: 'Earth',

    cooldown: 8,
    skillFamily: 'Weapon skill',
    castTimeMs: 1440,
    interruptMode: 'per-packet',
    effects: [
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.84 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 }
      ]),
      ...impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.84 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 }
      ]),
      ...impactEffects({ atMs: 960, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.84 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 }
      ]),
      ...impactEffects({ atMs: 1200, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.84 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 }
      ]),
      ...impactEffects({ atMs: 1400, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.84 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 }
      ])
    ]
  },
  // Earth orb creator; same token-packet shape as Flame Wheel, applying Bleeding.
  [ID.ROCKY_LOOP]: {
    name: 'Rocky Loop',
    icon: 'https://render.guildwars2.com/file/CF074C005D9E2B231B9260140C05201EDAFCB66D/2491581.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.HAMMER,
    attunement: 'Earth',

    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
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
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 2.5
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // Create this element's orb and refresh existing orb lifetimes without duplicating their buffs.
    orbDuration: 15,
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.create-hammer-orbs' } }]
  },
  // Defensive channel with no packets; only its long cast time and recharge affect the rotation.
  [ID.IMMUTABLE_STONE]: {
    name: 'Immutable Stone',
    icon: 'https://render.guildwars2.com/file/F560A6D6F1E70426210029040B5B735A3E3D5195/2491585.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.HAMMER,
    attunement: 'Earth',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 1520,
    effects: []
  },
  [ID.GROUND_POUND]: {
    name: 'Ground Pound',
    icon: 'https://render.guildwars2.com/file/4DFDAF76F9FAADE9E47F93A497B7E62953EC2E47/2491589.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.HAMMER,
    attunement: 'Earth',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 760,
    effects: impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2.8,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 5, duration: 6 },
      { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 3 }
    ])
  },
  // Snapshot each active orb at acceptance so consuming it at completion does not erase its delayed projectile.
  // Each active orb owns its condition total and projectile finisher; resolution splits condition stacks.
  [ID.GRAND_FINALE]: {
    name: 'Grand Finale',
    icon: 'https://render.guildwars2.com/file/41D40EDB66D0CC0A73F405630803D2D600CABCCE/2491580.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.HAMMER,

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    effects: (
      [
        ['Fire', CONDITION.BURNING, 2, 5],
        ['Water', CONDITION.VULNERABILITY, 6, 10],
        ['Air', CONDITION.WEAKNESS, 1, 5],
        ['Earth', CONDITION.BLEEDING, 4, 5]
      ] as const
    ).flatMap(([element, condition, stacks, duration]) =>
      impactEffects({ atMs: 680, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1.4,
          comboFinishers: [
            {
              ownerId: 'elementalist',
              finisherType: COMBO_FINISHER.PROJECTILE
            }
          ]
        },
        { type: 'condition', condition, stacks, duration }
      ]).map<SkillEffect>((effect) => ({
        ...effect,
        name: element,
        when: (runtime: MechanicQueriesOf<ElementalistRuntime>, cast) => {
          const expiresAt = runtime.profession.core.hammerOrbs[element];
          return expiresAt != null && expiresAt >= cast.start;
        }
      }))
    ),
    // Retire old orbit contacts before packet selection; consume the captured orbs only on commitment.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelledBeforeCommit,
        do: { type: 'elementalist.cancel-hammer-orbits' }
      },
      { on: 'castCommit', do: { type: 'elementalist.consume-hammer-orbs' } }
    ]
  }
};
