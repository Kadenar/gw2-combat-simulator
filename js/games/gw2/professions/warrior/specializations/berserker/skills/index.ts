/** Berserker PvE packets use nearest-40 ms offsets to remove false timing precision. */
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

export const BERSERKER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<WarriorSkill>>> = {
  [ID.SUNDERING_LEAP]: {
    name: 'Sundering Leap',
    icon: 'https://render.guildwars2.com/file/C8B8AD46430401040D732711F8EB3BFF37B6052B/1058651.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Rage',
    cooldown: 15,
    // This Rage skill owns its base extension; traits add their own rewards.
    durationExtension: 3,
    movementSkill: true,
    castTimeMs: 960,
    // Retain a field crossed during the leap even when it expires before landing.
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.LEAP,
        fieldSelectionAnchor: 'castStart'
      }
    ],
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 840, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.5
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 5
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 10,
        duration: 8
      },
      {
        type: 'boon',
        boon: BOON.AEGIS,
        duration: 3,
        stacks: 1
      }
    ]),
    sideEffects: [
      // Base duration combines with selected trait extensions in the mode owner.
      {
        on: 'castCommit',
        do: { type: 'warrior.berserk-extension' }
      },
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          resource: 'adrenaline',
          id: 'adrenaline-gained',
          label: 'Adrenaline gained',
          amount: 10
        }
      }
    ]
  },
  [ID.GUN_FLAME]: {
    name: 'Gun Flame',
    icon: 'https://render.guildwars2.com/file/C4CF21FCA018CF58CC94B8F3211004A2496147AE/1058645.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 5,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true,
    castTimeMs: 500,
    skillWeapon: WEAPON.RIFLE,
    effects: [
      {
        type: 'strike',
        coefficient: 2.2,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 10
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ]
  },
  [ID.SKULL_GRINDER]: {
    name: 'Skull Grinder',
    icon: 'https://render.guildwars2.com/file/043071CABF4FD10BB85AD24947ADF30734ACC7E9/1058644.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 5,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true,
    castTimeMs: 333,
    skillWeapon: WEAPON.MACE,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 4,
        duration: 8
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 5,
        duration: 3
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 8
      }
    ]
  },
  [ID.ARC_DIVIDER]: {
    name: 'Arc Divider',
    icon: 'https://render.guildwars2.com/file/0CC6E97CF3DD32E5B57001980702C10F1538F97E/1058639.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 5,
    requiredMainHand: 'Greatsword',
    skillWeapon: WEAPON.GREATSWORD,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true,
    castTimeMs: 680,
    interruptMode: 'commit',
    // Committed bursts preserve their effects and hold the cast lane through the remaining animation.
    interruptCommitMs: 640,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 3.5 }],
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.SCORCHED_EARTH]: {
    name: 'Scorched Earth',
    icon: 'https://render.guildwars2.com/file/BE01D01CCE7503A4FE1D7F0F0A680EED3230BAAA/1058643.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 5,
    requiredMainHand: 'Longbow',
    skillWeapon: WEAPON.LONGBOW,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true,
    castTimeMs: 360,
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: COMBO_FIELD.FIRE,
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [320, 2320, 4320].map((atMs) => ({ atMs, coefficient: 0.5 }))
      },
      {
        type: 'condition',
        ticks: [320, 2320, 4320].map((atMs) => ({ atMs, condition: CONDITION.BURNING, stacks: 1, duration: 3 }))
      }
    ])
  },
  [ID.WILD_BLOW]: {
    name: 'Wild Blow',
    icon: 'https://render.guildwars2.com/file/584D27AD243C071B3505B311D9A50CB9B9C0ED94/1058653.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Rage',
    cooldown: 20,
    // This Rage skill owns its base extension; traits add their own rewards.
    durationExtension: 5,
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        // Wild Blow always critically hits, regardless of precision.
        forceCrit: true
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 8,
        stacks: 1
      }
    ],
    sideEffects: [
      // Base duration combines with selected trait extensions in the mode owner.
      {
        on: 'castCommit',
        do: { type: 'warrior.berserk-extension' }
      },
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          resource: 'adrenaline',
          id: 'adrenaline-gained',
          label: 'Adrenaline gained',
          amount: 5
        }
      }
    ]
  },
  [ID.SHATTERING_BLOW]: {
    name: 'Shattering Blow',
    icon: 'https://render.guildwars2.com/file/317AAB9736A32EBBE8A54FA6519FAD7510A71672/1058650.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Rage',
    cooldown: 15,
    // This Rage skill owns its base extension; traits add their own rewards.
    durationExtension: 3,
    castTimeMs: 520,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 4,
        duration: 10
      },
      {
        type: 'boon',
        boon: BOON.STABILITY,
        duration: 2,
        stacks: 2
      }
    ]),
    sideEffects: [
      // Base duration combines with selected trait extensions in the mode owner.
      {
        on: 'castCommit',
        do: { type: 'warrior.berserk-extension' }
      },
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          resource: 'adrenaline',
          id: 'adrenaline-gained',
          label: 'Adrenaline gained',
          amount: 5
        }
      }
    ]
  },
  [ID.BERSERK]: {
    name: 'Berserk',
    icon: 'https://render.guildwars2.com/file/1354D8FC07F9F859DC7F0E7B61C0724FD4927C4E/1058638.png',
    type: 'Profession',
    slot: 'Profession_2',
    skillFamily: 'Rage',
    cooldown: 8,
    adrenalineCost: 30,
    castTimeMs: 0,
    effects: [],
    // Acceptance spends even when canceled; commitment grants before the new cap clamps the pool.
    sideEffects: [
      { on: 'castStart', do: { type: 'warrior.berserk-spend' } },
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          resource: 'adrenaline',
          id: 'adrenaline-gained',
          label: 'Adrenaline gained',
          amount: 10
        }
      },
      {
        on: 'castCommit',
        do: {
          type: 'warrior.berserk-enter',
          id: 'berserk',
          effects: [{ name: 'berserk', type: 'buff', kind: 'berserk', stacks: 1, duration: 20 }]
        }
      }
    ]
  },
  [ID.BLOOD_RECKONING]: {
    name: 'Blood Reckoning',
    icon: 'https://render.guildwars2.com/file/3E80EA264B52D3A3B3CA2E5DA41F57BF35445AF4/1058642.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Rage',
    cooldown: 20,
    // This Rage skill owns its base extension; traits add their own rewards.
    durationExtension: 2,
    castTimeMs: 280,
    dualWieldCastTimeMs: 240,
    effects: [],
    // Reset live primal skills only after the completed heal's adrenaline grant.
    sideEffects: [
      // Base duration combines with selected trait extensions in the mode owner.
      {
        on: 'castCommit',
        do: { type: 'warrior.berserk-extension' }
      },
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          resource: 'adrenaline',
          id: 'adrenaline-gained',
          label: 'Adrenaline gained',
          amount: 10
        }
      },
      { on: 'castCommit', do: { type: 'warrior.reset-primal-bursts' } }
    ]
  },
  [ID.OUTRAGE]: {
    name: 'Outrage',
    icon: 'https://render.guildwars2.com/file/DE44372830465728D82500744A04041359ECA9C0/1058652.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Rage',
    cooldown: 10,
    // This Rage skill owns its base extension; traits add their own rewards.
    durationExtension: 3,
    stunbreak: true,
    castTimeMs: 0,
    effects: [],
    sideEffects: [
      // Base duration combines with selected trait extensions in the mode owner.
      {
        on: 'castCommit',
        do: { type: 'warrior.berserk-extension' }
      },
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          resource: 'adrenaline',
          id: 'adrenaline-gained',
          label: 'Adrenaline gained',
          amount: 10
        }
      }
    ]
  },
  [ID.HEAD_BUTT]: {
    name: 'Head Butt',
    icon: 'https://render.guildwars2.com/file/046F1B0E64AC140CB7C0DE26A8D61CE13E02466A/1058637.png',
    type: 'Elite',
    slot: 'Elite',
    skillFamily: 'Rage',
    cooldown: 20,
    // This Rage skill owns its base extension; traits add their own rewards.
    durationExtension: 2,
    movementSkill: true,
    // Head Butt stuns both the foe and the player. The self-stun holds the cast
    // lane for 1s unless broken by a stunbreak (Outrage) or negated by stability.
    selfStunMs: 1000,
    castTimeMs: 800,
    interruptCommitMs: 760,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 4.5
      },
      {
        type: 'control',
        controlKind: CONTROL.STUN
      }
    ]),
    sideEffects: [
      // Base duration combines with selected trait extensions in the mode owner.
      {
        on: 'castCommit',
        do: { type: 'warrior.berserk-extension' }
      },
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          resource: 'adrenaline',
          id: 'adrenaline-gained',
          label: 'Adrenaline gained',
          amount: 30
        }
      }
    ]
  },
  [ID.FLAMING_FLURRY]: {
    name: 'Flaming Flurry',
    icon: 'https://render.guildwars2.com/file/F7DB99C8C851FA8094FFFAE2B92F0372641CF89F/1058647.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 5,
    requiredMainHand: 'Sword',
    skillWeapon: WEAPON.SWORD,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true,
    castTimeMs: 1600,
    interruptMode: 'per-packet',
    // Flaming Flurry safely commits by its final 1560ms packet; per-packet
    // interruptions retain only the strike and burning packets already fired.
    interruptCommitMs: 1560,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [400, 640, 880, 1120, 1320, 1560].map((atMs) => ({ atMs, coefficient: 0.33 }))
      },
      {
        type: 'condition',
        ticks: [400, 640, 880, 1120, 1320, 1560].map((atMs) => ({
          atMs,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 3.5
        }))
      }
    ])
  },
  [ID.DECAPITATE]: {
    name: 'Decapitate',
    icon: 'https://render.guildwars2.com/file/93C1E158334AF969FCDCDFC3FD2625780C73B237/1058636.png',
    type: 'Profession',
    slot: 'Profession_1',

    requiredMainHand: 'Axe',
    skillWeapon: WEAPON.AXE,
    cooldown: 0,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true,
    castTimeMs: 720,
    dualWieldCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 5,
        stacks: 5
      }
    ]
  },
  [ID.RUPTURING_SMASH]: {
    name: 'Rupturing Smash',
    icon: 'https://render.guildwars2.com/file/F64D02DBB50B06737D3B4905B26E2A71A3EF0A19/1058640.png',
    type: 'Profession',
    slot: 'Profession_1',

    requiredMainHand: 'Hammer',
    movementSkill: true,
    skillWeapon: WEAPON.HAMMER,
    cooldown: 5,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true,
    castTimeMs: 920,
    effects: [
      {
        type: 'strike',
        coefficient: 2.75,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ]
  },
  [ID.SLICING_MAELSTROM]: {
    name: 'Slicing Maelstrom',
    icon: 'https://render.guildwars2.com/file/E8D6FA67E7460325725107F636DDF1492106A342/3098879.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 5,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true,
    castTimeMs: 500,
    // The simulated target has no boons; only this primal burst receives the intrinsic multiplier.
    modifiers: [
      {
        id: 'warrior.slicing-maelstrom-boonless',
        label: 'Slicing Maelstrom',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 1.5,
        order: 100
      }
    ],
    skillWeapon: WEAPON.DAGGER,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      }
    ]
  },
  [ID.RAMPART_SPLITTER]: {
    name: 'Rampart Splitter',
    icon: 'https://render.guildwars2.com/file/5FC8CA3826E41F7E2DB10811E5F61A2EA4B816EC/3256397.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 5,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true,
    castTimeMs: 333,
    skillWeapon: WEAPON.STAFF,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 5,
        stacks: 1
      },
      { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 2 }
    ]
  },
  [ID.WILD_THROW]: {
    name: 'Wild Throw',
    icon: 'https://render.guildwars2.com/file/0B79EB6203654C703FF9DCBEDF2A4BDAB54D35FC/3379204.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 5,
    requiredMainHand: 'Spear',
    skillWeapon: WEAPON.SPEAR,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true,
    castTimeMs: 1280,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 240, coefficient: 0.75 },
          {
            atMs: 440,
            coefficient: 0.75
          },
          { atMs: 600, coefficient: 0.75 },
          {
            atMs: 800,
            coefficient: 0.75
          },
          { atMs: 960, coefficient: 0.75 },
          {
            atMs: 1160,
            coefficient: 0.75
          },
          { atMs: 1280, coefficient: 0.75 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 2,
        duration: 5
      }
    ]
  }
};
