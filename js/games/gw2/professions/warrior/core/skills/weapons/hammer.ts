/** Canonical Core warrior skill definitions grouped by their GW2 owner. */
import { COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

export const WARRIOR_WEAPONS_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.HAMMER_SWING]: {
    name: 'Hammer Swing',
    icon: 'https://render.guildwars2.com/file/C3BAD7D3D29FB64654985F0AB8FEA7713BE375E9/103178.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 0.9 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HAMMER_BASH]: {
    name: 'Hammer Bash',
    icon: 'https://render.guildwars2.com/file/2D1D0B576D78A4B16A390BB035D1D9B34BB2D2C7/103179.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 640,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 0.9 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HAMMER_SMASH]: {
    name: 'Hammer Smash',
    icon: 'https://render.guildwars2.com/file/54427BAB97B2DED3682BF1FAD37605AA66FA4009/103180.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 440,
    interruptCommitMs: 320,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1.2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FIERCE_BLOW]: {
    name: 'Fierce Blow',
    icon: 'https://render.guildwars2.com/file/02B0015D214FCAA0241650DFC46D933CEEEE6018/104115.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_2',
    cooldown: 6,
    castTimeMs: 880,
    interruptCommitMs: 600,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.8
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 4
      }
    ])
  },
  [ID.HAMMER_SHOCK]: {
    name: 'Hammer Shock',
    icon: 'https://render.guildwars2.com/file/D378332B719ED07509EABBCDA3D96C5ABFC116D6/103256.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_3',
    cooldown: 8,
    castTimeMs: 600,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.8
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 7
      }
    ])
  },
  [ID.STAGGERING_BLOW]: {
    name: 'Staggering Blow',
    icon: 'https://render.guildwars2.com/file/1E4BD7F1F66B0F2406252467804878E3365F292D/103085.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_4',
    cooldown: 18,
    castTimeMs: 480,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: COMBO_FINISHER.WHIRL
          }
        ]
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKBACK
      }
    ])
  },
  [ID.BACKBREAKER]: {
    name: 'Backbreaker',
    icon: 'https://render.guildwars2.com/file/3FB1611D020DAE0C082558D346BBF91148E2E223/103086.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_5',
    cooldown: 25,
    // Backbreaker refreshes Fierce Blow when its cast completes.
    castTimeMs: 880,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 680, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.25
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKDOWN
      }
    ]),
    sideEffects: [{ on: 'castCommit', do: { type: 'rechargeReset', skillIds: [ID.FIERCE_BLOW] } }]
  }
};

export const fierceBlowDamage: NonNullable<
  RuntimeProfession<WarriorRuntimeState, WarriorSkill>['reactions']
>['damage.resolving'] = (runtime, event) => {
  // Only defiant targets receive the bonus; temporary disable windows are outside simulation scope.
  if (event.skillId === ID.FIERCE_BLOW && Number(event.coefficient) > 0 && runtime.config.target?.defiant)
    return { coefficient: Number(event.coefficient) * 1.5 };
};
