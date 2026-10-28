/** Berserker PvE packets use nearest-40 ms offsets to remove false timing precision. */
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const BERSERKER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SUNDERING_LEAP]: {
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
    adrenalineCost: 10,
    burst: true,
    primalBurst: true,
    castTimeMs: 500,
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
    adrenalineCost: 10,
    burst: true,
    primalBurst: true,
    castTimeMs: 333,
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
    cooldown: 5,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      }
    ]
  },
  [ID.RAMPART_SPLITTER]: {
    adrenalineCost: 10,
    burst: true,
    primalBurst: true,
    castTimeMs: 333,
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
});

/** Intrinsic live modifiers retain critical semantics and the simulator's boonless-target assumption. */
export const slicingMaelstromModifiers: readonly Gw2ModifierRule[] = [
  {
    id: 'warrior.slicing-maelstrom-boonless',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    order: 100,
    when: (context) =>
      skillForEvent(context.profession?.catalog, context.event, context.skillId)?.id === ID.SLICING_MAELSTROM
  }
];
