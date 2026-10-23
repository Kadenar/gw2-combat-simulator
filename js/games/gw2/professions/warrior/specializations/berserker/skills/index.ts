import { COMBO_FINISHER, CONTROL, WEAPON, COMBO_FIELD, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
/** Berserker PvE packets use nearest-40 ms offsets to remove false timing precision. */
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { BERSERKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/berserker/profiles.js';

export const BERSERKER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SUNDERING_LEAP]: {
    movementSkill: true,
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
    castTimeMs: 960,
    sideEffects: [
      // Base duration combines with selected trait extensions in the mode owner.
      {
        on: 'castCommit',
        do: { type: 'warrior.berserk-extension', amount: { profile: PROFILE.rageExtensions, field: 'threshold' } }
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
    ],
    castTimeMs: 500,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true
  },
  [ID.SKULL_GRINDER]: {
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
    ],
    castTimeMs: 333,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true
  },
  [ID.ARC_DIVIDER]: {
    skillWeapon: WEAPON.GREATSWORD,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 3.5 }],
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    castTimeMs: 680,
    // Committed bursts preserve their effects and hold the cast lane through the remaining animation.
    interruptCommitMs: 640,
    interruptMode: 'commit',
    retainsCastLockoutAfterInterrupt: true,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true
  },
  [ID.SCORCHED_EARTH]: {
    skillWeapon: WEAPON.LONGBOW,
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
    ]),
    castTimeMs: 360,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true
  },
  [ID.WILD_BLOW]: {
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
    castTimeMs: 600,
    sideEffects: [
      // Base duration combines with selected trait extensions in the mode owner.
      {
        on: 'castCommit',
        do: { type: 'warrior.berserk-extension', amount: { profile: PROFILE.rageExtensions, field: 'maximumStacks' } }
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
    castTimeMs: 520,
    sideEffects: [
      // Base duration combines with selected trait extensions in the mode owner.
      {
        on: 'castCommit',
        do: { type: 'warrior.berserk-extension', amount: { profile: PROFILE.rageExtensions, field: 'threshold' } }
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
    castTimeMs: 0,
    effects: [],
    adrenalineCost: 30,
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
      { on: 'castCommit', do: { type: 'warrior.berserk-enter' } }
    ]
  },
  [ID.BLOOD_RECKONING]: {
    effects: [],
    castTimeMs: 280,
    dualWieldCastTimeMs: 240,
    // Reset live primal skills only after the completed heal's adrenaline grant.
    sideEffects: [
      // Base duration combines with selected trait extensions in the mode owner.
      {
        on: 'castCommit',
        do: { type: 'warrior.berserk-extension', amount: { profile: PROFILE.rageExtensions, field: 'minimumStacks' } }
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
    castTimeMs: 0,
    effects: [],
    sideEffects: [
      // Base duration combines with selected trait extensions in the mode owner.
      {
        on: 'castCommit',
        do: { type: 'warrior.berserk-extension', amount: { profile: PROFILE.rageExtensions, field: 'threshold' } }
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
    ],
    stunbreak: true
  },
  [ID.HEAD_BUTT]: {
    movementSkill: true,
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
    castTimeMs: 800,
    interruptCommitMs: 760,
    sideEffects: [
      // Base duration combines with selected trait extensions in the mode owner.
      {
        on: 'castCommit',
        do: { type: 'warrior.berserk-extension', amount: { profile: PROFILE.rageExtensions, field: 'minimumStacks' } }
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
    ],
    // Head Butt stuns both the foe and the player. The self-stun holds the cast
    // lane for 1s unless broken by a stunbreak (Outrage) or negated by stability.
    selfStunMs: 1000
  },
  [ID.FLAMING_FLURRY]: {
    skillWeapon: WEAPON.SWORD,
    // Flaming Flurry safely commits by its final 1560ms packet; per-packet
    // interruptions retain only the strike and burning packets already fired.
    interruptCommitMs: 1560,
    interruptMode: 'per-packet',
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
    ]),
    castTimeMs: 1600,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true
  },
  [ID.DECAPITATE]: {
    skillWeapon: WEAPON.AXE,
    cooldown: 0,
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
    ],
    castTimeMs: 720,
    dualWieldCastTimeMs: 480,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true
  },
  [ID.RUPTURING_SMASH]: {
    movementSkill: true,
    skillWeapon: WEAPON.HAMMER,
    cooldown: 5,
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
        ],
        metadata: {}
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
    ],
    castTimeMs: 920,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true
  },
  [ID.SLICING_MAELSTROM]: {
    cooldown: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      }
    ],
    castTimeMs: 500,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true
  },
  [ID.RAMPART_SPLITTER]: {
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
    ],
    castTimeMs: 333,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true
  },
  [ID.WILD_THROW]: {
    interruptMode: 'per-packet',
    skillWeapon: WEAPON.SPEAR,
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
    ],
    castTimeMs: 1280,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true
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
