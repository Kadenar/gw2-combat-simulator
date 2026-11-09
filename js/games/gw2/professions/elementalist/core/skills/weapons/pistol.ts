/** Declares pistol skills and their authored effects; mechanics/pistol.ts owns runtime rewards and lifetimes. */
import { AURA, BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { hasPistolBullet } from '#gw2/professions/elementalist/core/mechanics/pistol-bullets.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

// Frigid Flurry fires five shots at these offsets, each an independent Bleeding stack and Projectile finisher.
const FRIGID_FLURRY_SHOT_OFFSETS_MS = [280, 440, 640, 800, 960];

/**
 * Skill-id keyed definitions the Core module contributes to the pistol catalog.
 * Each entry declares the packet timeline the scheduler materializes for that skill.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_PISTOL_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ElementalistSkill>>> = {
  [ID.SCORCHING_SHOT]: {
    name: 'Scorching Shot',
    icon: 'https://render.guildwars2.com/file/DA6E9962EC9966CDBBC776F23347D16298AF4ADE/3256325.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.PISTOL,
    attunement: 'Fire',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    // The projectile launches before impact, so cancelling its aftercast preserves the hit and Burning.
    interruptCommitMs: 320,
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 1.5 }
      ]
    )
  },
  // Select extra Might from the live bullet before the final action loads or spends that bullet.
  [ID.RAGING_RICOCHET]: {
    name: 'Raging Ricochet',
    icon: 'https://render.guildwars2.com/file/7ED653511F5A3F3E6D705FF706265D3370647644/3256329.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.PISTOL,
    attunement: 'Fire',

    cooldown: 6,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    interruptCommitMs: 320,
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.8 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 8 },
        { type: 'boon', boon: BOON.MIGHT, stacks: 1, duration: 6 }
      ]
    ),
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      {
        on: 'castCommit',
        when: hasPistolBullet,
        do: {
          type: 'elementalist.pistol.raging-ricochet',
          id: 'fire-bullet',
          effects: [{ type: 'boon', name: 'Fire', boon: BOON.MIGHT, stacks: 1, duration: 10 }]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ]
  },
  // Blast finisher up front, then a four-shot salvo landing together a second later. Spending a Fire
  // bullet also grants a Fire Aura through the pistol cast handler.
  [ID.SEARING_SALVO]: {
    name: 'Searing Salvo',
    icon: 'https://render.guildwars2.com/file/7546C0CAE32CD437249FC903BF1AC84122B0EAC4/3256335.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Fire',

    cooldown: 12,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    // The first projectile launches before the aftercast; its impact and follow-up salvo survive cancellation.
    interruptCommitMs: 320,
    effects: [
      ...impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        {
          type: 'strike',
          coefficient: 1,
          comboFinishers: [
            {
              attemptGroup: 'effect:1:tick:1',
              ownerId: 'elementalist',
              finisherType: COMBO_FINISHER.BLAST
            }
          ]
        },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 7 }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.25 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.25 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.25 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.25 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ])
    ],
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      {
        on: 'castCommit',
        when: hasPistolBullet,
        do: {
          type: 'elementalist.pistol.searing-salvo',
          id: 'fire-bullet',
          effects: [{ type: 'aura', name: 'Fire', aura: AURA.FIRE, duration: 4 }]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ]
  },
  [ID.SOOTHING_SPLASH]: {
    name: 'Soothing Splash',
    icon: 'https://render.guildwars2.com/file/D2092BE1DA1F2D1D93F67E07EE010BB113794C44/3256326.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.PISTOL,
    attunement: 'Water',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
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
    icon: 'https://render.guildwars2.com/file/11DB6D78E16F6ACDE1000BF4AEF69ED5A9410BA9/3256330.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.PISTOL,
    attunement: 'Water',

    cooldown: 5,
    skillFamily: 'Weapon skill',
    castTimeMs: 1000,
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Each projectile owns an independent combo attempt; interrupted packets never attempt one.
        ticks: FRIGID_FLURRY_SHOT_OFFSETS_MS.map((atMs, index) => ({
          atMs,
          coefficient: 0.2,
          comboFinishers: [
            {
              ownerId: 'elementalist',
              attemptGroup: `frigid-flurry:${index + 1}`,
              finisherType: COMBO_FINISHER.PROJECTILE,
              chance: 0.2
            }
          ]
        }))
      },
      {
        type: 'condition',
        ticks: FRIGID_FLURRY_SHOT_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 7
        }))
      }
    ]),
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }]
  },
  // The released shot starts a four-second ice field. Its enhanced detonation
  // follows that field's expiry, independently of the remaining aftercast.
  [ID.FROZEN_FUSILLADE]: {
    name: 'Frozen Fusillade',
    icon: 'https://render.guildwars2.com/file/12144A540D981D6AC7010A7A34C1B3EF0A02D7F5/3256336.png',
    // The enhanced detonation waits this long after release, independently of ordinary packets.
    detonationDelay: 4,
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Water',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    interruptCommitMs: 320,
    // Start the four-second ice field at release, independently of the projectile hit.
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.ICE,
        duration: 4,
        startAnchor: 'castStart',
        startMs: 320
      }
    ],
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.75 },
        { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 1.5 }
      ]
    ),
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      {
        on: 'castCommit',
        when: hasPistolBullet,
        do: {
          type: 'elementalist.pistol.frozen-fusillade',
          id: 'water-bullet',
          effects: [
            { type: 'strike', name: 'Water Bullet', coefficient: 0.75, hits: 1 },
            { type: 'condition', name: 'Water Bullet', condition: CONDITION.BLEEDING, stacks: 5, duration: 8 }
          ]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ]
  },
  [ID.ELECTRIC_EXPOSURE]: {
    name: 'Electric Exposure',
    icon: 'https://render.guildwars2.com/file/575D6048F7B2660A3BC0D3A93CECFD49EEB1C0D1/3256323.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.PISTOL,
    attunement: 'Air',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    // The launched projectile still applies its strike and Vulnerability after an aftercast cancellation.
    interruptCommitMs: 320,
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 6 }
      ]
    )
  },
  // Strike plus crowd control; spending an Air bullet opens the Dazing Discharge window tracked in
  // profession state rather than adding packets here.
  [ID.DAZING_DISCHARGE]: {
    name: 'Dazing Discharge',
    icon: 'https://render.guildwars2.com/file/43FE5D1C5B3D70422F324071037AC844CE9C01F3/3256327.png',
    // A consumed Air bullet arms one next-pistol recharge reduction for this window.
    duration: 5,
    nextSkillRechargeMultiplier: 0.67,
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.PISTOL,
    attunement: 'Air',

    cooldown: 8,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    // Commit the cast and bullet interaction before the remaining animation ends.
    interruptCommitMs: 400,
    // Preserve the committed strike, Vulnerability, and crowd control after interruption.
    effects: impactEffects(
      { atMs: 280, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.75, canCrit: true },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 8, duration: 10 },
        { type: 'control', applications: 1, controlKind: CONTROL.DAZE }
      ]
    ),
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      { on: 'castCommit', when: hasPistolBullet, do: { type: 'elementalist.pistol.dazing-discharge' } },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ]
  },
  // First link of the three-step Aerial Agility flipover chain. The zero-coefficient packet exists only
  // to fire the leap finisher. The chain reads the Air bullet without spending it, and the two later
  // links can never stock one.
  [ID.AERIAL_AGILITY]: {
    name: 'Aerial Agility',
    icon: 'https://render.guildwars2.com/file/ADD2E4D6D49F22AF2C033058A6FF02BD316BFBC9/3256331.png',
    autoattack: false,
    // This manually activated flip chain reuses the scheduler's autoattack sequencing index.
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Air',

    cooldown: 12,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
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
                finisherType: COMBO_FINISHER.LEAP
              }
            ]
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // The root only loads Air; its follow-up links neither grant nor consume bullets.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.pistol.load' } }]
  },
  [ID.AERIAL_AGILITY_CHAIN]: {
    name: 'Aerial Agility (chain)',
    icon: 'https://render.guildwars2.com/file/ADD2E4D6D49F22AF2C033058A6FF02BD316BFBC9/3256331.png',
    autoattack: false,
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Air',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 480,
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.8 },
      { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 3 }
    ])
  },
  [ID.AERIAL_AGILITY_DASH]: {
    name: 'Aerial Agility (dash)',
    icon: 'https://render.guildwars2.com/file/B10398A8E33A70A9101F294993673004017916C1/3256333.png',
    autoattack: false,
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Air',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.LEAP
          }
        ]
      },
      { type: 'boon', boon: BOON.AEGIS, stacks: 1, duration: 3 }
    ])
  },
  [ID.PIERCING_PEBBLE]: {
    name: 'Piercing Pebble',
    icon: 'https://render.guildwars2.com/file/4F217D25EBBFC017B4621C966BD26A7C4C6CD81C/3256324.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.PISTOL,
    attunement: 'Earth',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    // Release commits the projectile one action tick before its hit and Bleeding land.
    interruptCommitMs: 320,
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.35 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 5 }
      ]
    )
  },
  [ID.SHATTERING_STONE]: {
    name: 'Shattering Stone',
    icon: 'https://render.guildwars2.com/file/387446B9ED09274D20200C2F066BF4311E6D0C93/3256328.png',
    // The self buff arms these charges; impacts consume them until the window expires.
    maximumStacks: 3,
    duration: 10,
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.PISTOL,
    attunement: 'Earth',

    cooldown: 6,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    interruptCommitMs: 400,
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.8 },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 3, duration: 10 }
    ]),
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      {
        on: 'castCommit',
        when: hasPistolBullet,
        do: {
          type: 'elementalist.pistol.shattering-stone',
          id: 'earth-bullet',
          effects: [
            { type: 'condition', name: 'Triggered Bleeding', condition: CONDITION.BLEEDING, stacks: 1, duration: 5 }
          ]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ]
  },
  [ID.BOULDER_BLAST]: {
    name: 'Boulder Blast',
    icon: 'https://render.guildwars2.com/file/C0122C48115C5E59D499E101764C94CA6047062F/3256334.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Earth',

    cooldown: 12,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    // Releasing the boulder commits its damage and conditions before the remaining cast animation ends.
    interruptCommitMs: 360,
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
              finisherType: COMBO_FINISHER.PROJECTILE
            }
          ]
        },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 5, duration: 8 },
        { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 1.5 }
      ]
    ),
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      { on: 'castCommit', when: hasPistolBullet, do: { type: 'elementalist.pistol.boulder-blast' } },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ]
  },
  [ID.ELEMENTAL_EXPLOSION]: {
    name: 'Elemental Explosion',
    icon: 'https://render.guildwars2.com/file/95DA48632542F0073A9022C4165E570EDBD72474/3256337.png',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.PISTOL,

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    // The explosion commits before its projectile packets, which persist after a 480 ms interruption.
    interruptCommitMs: 480,
    effects: [
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.2 },
        {
          type: 'condition',
          condition: CONDITION.BURNING,
          stacks: 2,
          duration: 6
        }
      ]),
      ...impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.2 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 4, duration: 6 }
      ]),
      ...impactEffects({ atMs: 680, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.2 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 4, duration: 10 }
      ]),
      ...impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.2 },
        { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 4 }
      ])
    ],
    // Elemental Explosion consumes every stored bullet and grants the current attunement's aura.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.core.consume-elemental-explosion',
          id: 'attunement-aura',
          effects: [
            { type: 'aura', name: 'Fire', aura: AURA.FIRE, duration: 4 },
            { type: 'aura', name: 'Water', aura: AURA.FROST, duration: 4 },
            { type: 'aura', name: 'Air', aura: AURA.SHOCKING, duration: 3 },
            { type: 'aura', name: 'Earth', aura: AURA.MAGNETIC, duration: 3 }
          ]
        }
      }
    ]
  }
};
