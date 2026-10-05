/** Berserker PvE packets use nearest-40 ms offsets to remove false timing precision. */
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import {
  berserkerState,
  publishBerserk,
  berserkExtensions
} from '#gw2/professions/warrior/specializations/berserker/state.js';
import { BERSERKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/berserker/profiles.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
export const BERSERKER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SUNDERING_LEAP]: {
    movementSkill: true,
    // Retain a field crossed during the leap even when it expires before landing.
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Leap',
        fieldSelectionAnchor: 'castStart',
        ambiguousFieldSelection: 'oldest'
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
        condition: 'Crippled',
        stacks: 1,
        duration: 5
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 8
      },
      {
        type: 'boon',
        boon: 'aegis',
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
        condition: 'Burning',
        stacks: 1,
        duration: 10
      },
      {
        type: 'control',
        controlKind: 'daze'
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
        controlKind: 'daze'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 8
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 5,
        duration: 3
      },
      {
        type: 'condition',
        condition: 'Crippled',
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
    skillWeapon: 'Greatsword',
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
    skillWeapon: 'Longbow',
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: 'Fire',
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
        ticks: [320, 2320, 4320].map((atMs) => ({ atMs, condition: 'Burning', stacks: 1, duration: 3 }))
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
        controlKind: 'daze'
      },
      {
        type: 'boon',
        boon: 'fury',
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
        condition: 'Bleeding',
        stacks: 4,
        duration: 10
      },
      {
        type: 'boon',
        boon: 'stability',
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
        controlKind: 'stun'
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
    skillWeapon: 'Sword',
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
          condition: 'Burning',
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
    skillWeapon: 'Axe',
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'might',
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
    skillWeapon: 'Hammer',
    cooldown: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 2.75,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2
      },
      {
        type: 'control',
        controlKind: 'daze'
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
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      },
      { type: 'condition', condition: 'Immobilized', stacks: 1, duration: 2 }
    ],
    castTimeMs: 333,
    adrenalineCost: 10,
    burst: true,
    primalBurst: true
  },
  [ID.WILD_THROW]: {
    interruptMode: 'per-packet',
    skillWeapon: 'Spear',
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
        condition: 'Vulnerability',
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

/** Skill-owned entry and base extensions leave expiry and combined trait publication with the mode owner. */
export const berserkSkillActions: RuntimeProfession<WarriorRuntimeState, WarriorSkill>['sideEffectHandlers'] = {
  'warrior.berserk-spend'(runtime, context) {
    runtime.resourceController.spend('adrenaline', context.skill.adrenalineCost ?? 0);
  },
  'warrior.berserk-enter'(runtime, context) {
    if (context.kind !== 'cast') return;
    const cast = context.cast;
    const state = berserkerState.from(runtime);
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
    const effect = requireEffect(profile, 'buff', 'berserk');
    if (effect && effectNumber(profile, effect, 'duration') > 0) {
      state.berserkActive = true;
      state.berserkUntil = gw2EffectExpiresAt(runtime.time, effectNumber(profile, effect, 'duration'));
      // Mode entry changes capacity without refilling the pool.
      runtime.resourceController.refresh('adrenaline');
      publishBerserk(runtime, cast);
    }
  },
  'warrior.berserk-extension'(runtime, context, action) {
    if (context.kind === 'cast' && action.type === 'warrior.berserk-extension' && action.amount != null)
      berserkExtensions.set(context.cast, sideEffectAmount(runtime, action.amount));
  }
};
