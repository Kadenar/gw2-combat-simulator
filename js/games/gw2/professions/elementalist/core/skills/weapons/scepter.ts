/**
 * Scepter weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers the main-hand slot 1-3 skills across all four attunements, including the
 * Earth-attunement Rock Barrier/Hurl flip pair. Declarative data only: the named
 * `tasks` are implemented by `core/execution/index.ts`, and the table
 * is merged into the Core skill catalog by `core/skills/index.ts`.
 */
import { BOON, COMBO_FINISHER, CONDITION, WEAPON } from '#gw2/platform/constants.js';
import { conditionTimeline, impactEffects, strikeTimeline } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

// One Hurl input releases five rocks at fixed 200ms intervals.
const HURL_PACKET_TIMES = [320, 520, 720, 920, 1120] as const;

/**
 * Complete scepter declarations own presentation, cast timelines, emitted packets, and combo participation.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  // Two-stage autoattack: each strike packet carries its own Burning application.
  [ID.FLAMESTRIKE]: {
    name: 'Flamestrike',
    description: 'Strike your foe with flame.',
    icon: 'https://render.guildwars2.com/file/F3FBE8FF4D405637C7D61CB552A6451BB5F2D33F/103325.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SCEPTER,
    attunement: 'Fire',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
    // Flamestrike commits its first packet on the first 40 ms action tick after 400 ms, then its second at 520 ms.
    interruptCommitMs: 520,
    effects: [
      ...impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.5, interruptCommitMs: 320 },
        {
          type: 'condition',
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 1.5,
          interruptCommitMs: 320
        }
      ]),
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.7 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2.5 }
      ])
    ]
  },
  // The delayed drop commits after 640ms; its blast and Burning then survive the
  // interrupted cast and land 2.6s after cast start.
  [ID.DRAGONS_TOOTH]: {
    name: "Dragon's Tooth",
    description: "Drop an explosive dragon's tooth on your foe.",
    icon: 'https://render.guildwars2.com/file/139899C1026E93EE0EDC44030B11E310E27D9807/103105.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SCEPTER,
    attunement: 'Fire',

    cooldown: 6,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    interruptCommitMs: 640,
    effects: impactEffects(
      { atMs: 2600, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 2.25,
          comboFinishers: [
            {
              attemptGroup: 'effect:1:tick:1',
              ownerId: 'elementalist',
              finisherType: COMBO_FINISHER.BLAST
            }
          ]
        },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 10 }
      ]
    )
  },
  // Three closely spaced packets commit by 440ms; only the middle one is the blast
  // finisher and carries Burning, while the trailing packet grants Vigor.
  [ID.PHOENIX]: {
    name: 'Phoenix',
    description:
      'Release a fiery phoenix that attacks foes in a line before exploding and returning to you, curing a condition and granting you vigor. Inflict additional burning against foes that are already burning.',
    icon: 'https://render.guildwars2.com/file/000E1F53624D2F9B222E17D02A5A5ED40417CAB7/103039.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SCEPTER,
    attunement: 'Fire',

    cooldown: 10,
    skillFamily: 'Weapon skill',
    castTimeMs: 480,
    interruptCommitMs: 440,
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
      ...impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'strike',
          coefficient: 1.7,
          comboFinishers: [
            {
              attemptGroup: 'effect:2:tick:1',
              ownerId: 'elementalist',
              finisherType: COMBO_FINISHER.BLAST
            }
          ]
        },
        {
          type: 'condition',
          condition: CONDITION.BURNING,
          stacks: 2,
          duration: 6
        }
      ]),
      ...impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.75 },
        { type: 'boon', boon: BOON.VIGOR, stacks: 1, duration: 5 }
      ])
    ]
  },
  [ID.ICE_SHARDS]: {
    name: 'Ice Shards',
    description: 'Fire three ice shards at your foe.',
    icon: 'https://render.guildwars2.com/file/5DAC69FFBE4850EE6F9FA2532616C128D7AEF957/103309.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SCEPTER,
    attunement: 'Water',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 560,
    interruptCommitMs: 520,
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
    description: 'Cast a shatterstone that will explode at the target area.',
    icon: 'https://render.guildwars2.com/file/801B94942A7411A4379E58C6BA363CA31D2AFCBB/103289.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SCEPTER,
    attunement: 'Water',

    cooldown: 3,
    skillFamily: 'Weapon skill',
    castTimeMs: 400,
    effects: [
      ...impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.8 },
        { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 2 }
      ]),
      ...impactEffects({ atMs: 1040, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.8 },
        { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 2 }
      ])
    ]
  },
  // Both ammo charges commit at 640ms and share a 10s recharge behind a 1s per-cast cooldown.
  [ID.WATER_TRIDENT]: {
    name: 'Water Trident',
    description:
      'Cast a water trident that damages foes. Deal more damage to chilled foes and heal for each target struck. Heal for a lesser amount for each target struck beyond the first.',
    icon: 'https://render.guildwars2.com/file/43AF784618DAC97FFAB43518A9F7B204A32335FA/103081.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SCEPTER,
    attunement: 'Water',

    cooldown: 10,
    ammo: 2,

    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    interruptCommitMs: 640,
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
    description: 'Cast an arc of electricity at your foe.',
    icon: 'https://render.guildwars2.com/file/0A436FC2FC1CFAB8610ECFF93ACFF31B0FB29733/103128.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SCEPTER,
    attunement: 'Air',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 2720,
    interruptMode: 'per-packet',
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
    description: 'Strike your foes with lightning.',
    icon: 'https://render.guildwars2.com/file/9C090BF7E893030BABD5DC4BA4020262AD91CE2C/103134.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SCEPTER,
    attunement: 'Air',

    cooldown: 5,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.2 },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 5, duration: 10 }
    ])
  },
  // Instant ammo skill: two charges on a 10s recharge, applying blind plus Weakness.
  [ID.BLINDING_FLASH]: {
    name: 'Blinding Flash',
    description: 'Blind your foes with a flash of light. Vulnerable foes are also weakened.',
    icon: 'https://render.guildwars2.com/file/A9B10F55FF0922633B0CCC3C42AB7C093372A8E2/102831.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SCEPTER,
    attunement: 'Air',

    cooldown: 10,
    ammo: 2,

    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 6,
        applications: 1
      },
      { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 4 }
    ])
  },
  // Three-shard autoattack; each shard is an independent 20%-chance projectile finisher and
  // applies its own Bleeding stack.
  [ID.STONE_SHARDS]: {
    name: 'Stone Shards',
    description: 'Fling stone daggers at your foe to bleed them.',
    icon: 'https://render.guildwars2.com/file/66441BE066120A2590B5AF031D56E221189ADC68/103158.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SCEPTER,
    attunement: 'Earth',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 1400,
    interruptMode: 'per-packet',
    effects: [
      ...impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'strike',
          coefficient: 0.5,
          comboFinishers: [
            {
              attemptGroup: 'effect:1:tick:1',
              ownerId: 'elementalist',
              finisherType: COMBO_FINISHER.PROJECTILE,
              chance: 0.2
            }
          ]
        },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 }
      ]),
      ...impactEffects({ atMs: 1000, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'strike',
          coefficient: 0.5,
          comboFinishers: [
            {
              attemptGroup: 'effect:3:tick:1',
              ownerId: 'elementalist',
              finisherType: COMBO_FINISHER.PROJECTILE,
              chance: 0.2
            }
          ]
        },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 }
      ]),
      ...impactEffects({ atMs: 1240, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'strike',
          coefficient: 0.5,
          comboFinishers: [
            {
              attemptGroup: 'effect:5:tick:1',
              ownerId: 'elementalist',
              finisherType: COMBO_FINISHER.PROJECTILE,
              chance: 0.2
            }
          ]
        },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 }
      ])
    ]
  },
  // Rock Barrier and Hurl are a two-state flip pair sharing the Weapon_2 slot: availability
  // gates each on whether a barrier is currently stored (see core/mechanics/availability.ts).
  [ID.ROCK_BARRIER]: {
    name: 'Rock Barrier',
    description: 'Envelop yourself in a stony barrier that improves toughness.',
    icon: 'https://render.guildwars2.com/file/C5CB69247473AE2DEB35DB5F952A0C3832CC14F2/102858.png',
    // The stored barrier's availability and held recharge share this skill-owned window.
    flipDuration: 30,
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SCEPTER,
    attunement: 'Earth',

    cooldown: 8,
    skillFamily: 'Weapon skill',
    // Rock Barrier opens Hurl's stored-barrier window after completion.
    tasks: [
      {
        type: 'elementalist.core.open-rock-barrier',
        timingAnchor: 'castCommit'
      }
    ],
    castTimeMs: 760,
    effects: [
      {
        type: 'boon',
        boon: BOON.RESISTANCE,
        stacks: 1,
        duration: 4,
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Throws the stored barrier as five projectile-finisher packets 200ms apart, each bleeding.
  [ID.HURL]: {
    name: 'Hurl',
    description: 'Hurl the rocks from your barrier at your foe.',
    icon: 'https://render.guildwars2.com/file/BB59A576C805054EB94C66D8190490F273C7BBED/102974.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SCEPTER,
    attunement: 'Earth',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    // Hurl consumes the stored barrier and starts Rock Barrier's real recharge.
    tasks: [
      {
        type: 'elementalist.core.release-rock-barrier',
        timingAnchor: 'castCommit'
      }
    ],
    castTimeMs: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      strikeTimeline(
        HURL_PACKET_TIMES.map((atMs) => ({
          atMs,
          coefficient: 0.44,
          comboFinishers: [
            {
              ownerId: 'elementalist',
              finisherType: COMBO_FINISHER.PROJECTILE
            }
          ]
        }))
      ),
      conditionTimeline(
        HURL_PACKET_TIMES.map((atMs) => ({
          atMs,
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 8
        }))
      )
    ])
  },
  // The travelling projectile outlives the cast, so its pulses use fixed (cast-speed
  // independent) offsets and persist after an interrupt past the 160ms commit point.
  [ID.DUST_DEVIL]: {
    name: 'Dust Devil',
    description:
      'Create a dust storm that inflicts cripple to bleeding foes. The first strike of the storm blinds foes.',
    icon: 'https://render.guildwars2.com/file/EA6A082902800CC552393F24E03240A7A7D9C511/103080.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SCEPTER,
    attunement: 'Earth',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 320,
    // EVTC shows the dust projectile committing at 160 ms and striking again at one-second intervals.
    interruptCommitMs: 160,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [160, 1160, 2160].map((atMs) => ({ atMs, coefficient: 0.4 })),
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 6,
        atMs: 160,
        applications: 1
      },
      {
        type: 'condition',
        ticks: [160, 1160, 2160].map((atMs) => ({ atMs, condition: CONDITION.CRIPPLED, stacks: 1, duration: 1.5 })),
        persistsAfterInterrupt: true
      }
    ])
  }
});
