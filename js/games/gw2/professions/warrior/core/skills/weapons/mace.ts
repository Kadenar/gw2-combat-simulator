/** Mace casts and impacts use observed timings rounded to the nearest 40 ms action tick. */
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const WARRIOR_WEAPONS_MACE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.MACE_SMASH]: {
    castTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MACE_BASH]: {
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PULVERIZE]: {
    castTimeMs: 920,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5
      }
    ])
  },
  [ID.TREMOR]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'rechargeReset', skillIds: [ID.CRUSHING_BLOW] } }],
    // Tremor refreshes Crushing Blow when its cast completes.
    castTimeMs: 560,
    dualWieldCastTimeMs: 400,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [440, 520].map((atMs) => ({ atMs, coefficient: 1.25 })),
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Projectile',
            chance: 1,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'control',
        atMs: 440,
        controlKind: 'knockdown'
      }
    ])
  },
  [ID.POMMEL_BASH]: {
    cooldown: 10,
    castTimeMs: 440,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ])
  },
  [ID.COUNTERBLOW]: {
    // Early commitment exposes the follow-up only for the original block window.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime, cast) => runtime.time < cast.fullEnd,
        do: { type: 'warrior.counterblow-arm' }
      }
    ],
    // Like Illusionary Counter, the block arms a separate attack and can release its channel early.
    cooldown: 7,
    castTimeMs: 1960,
    defaultInterruptMs: 200,
    interruptCommitMs: 80,
    effects: []
  },
  [ID.CRUSHING_BLOW]: {
    castTimeMs: 560,
    dualWieldCastTimeMs: 400,
    interruptCommitMs: 440,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2.25
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 6,
        stacks: 5
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 6
      }
    ])
  },
  [ID.TACTICAL_BLOW]: {
    castTimeMs: 480,
    // Acceptance consumes the follow-up even if its attack is canceled.
    sideEffects: [
      { on: 'castStart', do: { type: 'flipConsume', skillId: ID.TACTICAL_BLOW } },
      { on: 'castCommit', do: { type: 'warrior.adrenaline', amount: 5 } }
    ],
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 8
      }
    ])
  }
});

export const counterblowActions: RuntimeProfession<WarriorRuntimeState, WarriorSkill>['sideEffectHandlers'] = {
  'warrior.counterblow-arm'(runtime, context) {
    if (context.kind === 'cast') runtime.armFlip(ID.TACTICAL_BLOW, { expiresAt: context.cast.fullEnd });
  }
};
