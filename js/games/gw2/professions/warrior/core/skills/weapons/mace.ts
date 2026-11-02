/** Mace casts and impacts use observed timings rounded to the nearest 40 ms action tick. */
import { BOON, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

export const WARRIOR_WEAPONS_MACE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<WarriorSkill>>> = {
  [ID.MACE_SMASH]: {
    name: 'Mace Smash',
    icon: 'https://render.guildwars2.com/file/F6440A5D08EDFB78FD5A5BB31E30CD25040D3F23/103121.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
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
    name: 'Mace Bash',
    icon: 'https://render.guildwars2.com/file/61EE97EF77FE27CB0A2A36AECD0769E334551645/102764.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
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
    name: 'Pulverize',
    icon: 'https://render.guildwars2.com/file/0399B3F49AB8C94602BECE809EBC0FE238ECB64E/103122.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
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
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 5
      }
    ])
  },
  [ID.COUNTERBLOW]: {
    name: 'Counterblow',
    icon: 'https://render.guildwars2.com/file/92C19D3798F16AC716CAC7A5C044E4CFC251E4A2/102986.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_2',
    // Like Illusionary Counter, the block arms a separate attack and can release its channel early.
    cooldown: 7,
    castTimeMs: 1960,
    defaultInterruptMs: 200,
    interruptCommitMs: 80,
    effects: [],
    // Early commitment exposes the follow-up only for the original block window.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime, cast) => runtime.time < cast.fullEnd,
        do: { type: 'warrior.counterblow-arm' }
      }
    ]
  },
  [ID.TACTICAL_BLOW]: {
    name: 'Tactical Blow',
    icon: 'https://render.guildwars2.com/file/5FB73638B8554158621B50CB6C16C1FABEB6D05B/3645916.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_2',
    cooldown: 0,
    castTimeMs: 480,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 8
      }
    ]),
    // Acceptance consumes the follow-up even if its attack is canceled.
    sideEffects: [
      { on: 'castStart', do: { type: 'flipConsume', skillId: ID.TACTICAL_BLOW } },
      { on: 'castCommit', do: { type: 'warrior.grant-combat-resource', amount: 5 } }
    ]
  },
  [ID.POMMEL_BASH]: {
    name: 'Pommel Bash',
    icon: 'https://render.guildwars2.com/file/F069CFD79FE89D70F612901FE5FAD70451732E02/103208.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_3',
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
        controlKind: CONTROL.DAZE
      }
    ])
  },
  [ID.CRUSHING_BLOW]: {
    name: 'Crushing Blow',
    icon: 'https://render.guildwars2.com/file/53DD40AE0BFA70045A054E30516CC054ECA73E15/103149.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_4',
    cooldown: 12,
    dualWieldEffectOffsetsMs: { 440: 320 },
    castTimeMs: 560,
    dualWieldCastTimeMs: 400,
    interruptCommitMs: 440,
    dualWieldInterruptCommitMs: 360,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2.25
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 6,
        stacks: 5
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 10,
        duration: 6
      }
    ])
  },
  [ID.TREMOR]: {
    name: 'Tremor',
    icon: 'https://render.guildwars2.com/file/60B9CD0D66AAA817ACF9F250B33391A0157D1BFE/103287.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_5',
    cooldown: 18,
    // The travelling impacts retain their observed spacing instead of scaling every packet proportionally.
    dualWieldEffectOffsetsMs: { 440: 320, 520: 360 },
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
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 1
          }
        ]
      },
      {
        type: 'control',
        atMs: 440,
        controlKind: CONTROL.KNOCKDOWN
      }
    ]),
    sideEffects: [{ on: 'castCommit', do: { type: 'rechargeReset', skillIds: [ID.CRUSHING_BLOW] } }]
  }
};

const counterblowActions: RuntimeProfession<WarriorRuntimeState, WarriorSkill>['sideEffectHandlers'] = {
  'warrior.counterblow-arm'(runtime, context) {
    if (context.kind === 'cast') runtime.armFlip(ID.TACTICAL_BLOW, { expiresAt: context.cast.fullEnd });
  }
};

/** Registers Counterblow actions with the Core hook assembly. */
export const counterblowLifecycle = {
  sideEffectHandlers: counterblowActions
} satisfies RuntimeHooks<WarriorRuntimeState, WarriorSkill>;
