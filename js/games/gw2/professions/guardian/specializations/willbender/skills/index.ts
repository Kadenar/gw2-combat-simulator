import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianSkill } from '#gw2/professions/guardian/types.js';

// Each recorded flame identity owns a separately patchable projection of the same authored trail.
const flameEffects = [
  {
    type: 'strike',
    name: 'Strike',
    ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: (index + 1) * 1000, coefficient: 0.22 })),
    timingAnchor: 'castEnd',
    timingScale: 'fixed',
    actorType: ACTOR.PLAYER
  }
] satisfies readonly SkillEffect[];

/**
 * Owns Willbender virtue and physical skill definitions.
 * Runtime virtue behavior lives in `mechanics/virtues.ts`.
 */

export const WILLBENDER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<GuardianSkill>>> = {
  [ID.WILLBENDER_FLAMES_COURAGE]: {
    name: 'Willbender Flames',
    type: 'Proc',
    cooldown: 0,
    icon: 'https://render.guildwars2.com/file/9EBC7246D94A4742CFA576CE553C019D93EA92F5/2479370.png',
    castTimeMs: 0,
    effects: flameEffects
  },
  [ID.ROILING_LIGHT]: {
    name: 'Roiling Light',
    icon: 'https://render.guildwars2.com/file/0D02DC3C2F31E51158C710BBB1382CE9094C3D30/2479375.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Physical',
    cooldown: 15,
    castTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5
      }
    ],
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [
      {
        on: 'castCommit',
        do: { type: 'flipArm', skillId: ID.QUICK_RETRIBUTION, durationSec: 15 }
      }
    ]
  },
  [ID.WILLBENDER_FLAMES]: {
    name: 'Willbender Flames',
    icon: 'https://render.guildwars2.com/file/9EBC7246D94A4742CFA576CE553C019D93EA92F5/2479370.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 0,
    castTimeMs: 0,
    effects: flameEffects
  },
  [ID.CRASHING_COURAGE]: {
    name: 'Crashing Courage',
    icon: 'https://render.guildwars2.com/file/3AD50BA43AA00EA97C6152D5EC6092FE0F0979D0/2479369.png',
    type: 'Profession',
    slot: 'Profession_3',
    virtue: 'courage',
    cooldown: 30,
    shadowstepSkill: true,
    castTimeMs: 680,
    // Grant the virtue's defensive boons with its initial strike.
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        // Virtue strikes use mechanic weapon strength independently of equipped weapons.
        weapon: 'Profession Mechanic',
        name: 'Crashing Courage - Initial Damage'
      },
      {
        type: 'boon',
        boon: BOON.AEGIS,
        stacks: 1,
        duration: 4
      },
      {
        type: 'boon',
        boon: BOON.STABILITY,
        stacks: 1,
        duration: 4
      }
    ]),
    // Accepted activations launch the self window and autonomous flame group.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelledBeforeCommit,
        do: {
          type: 'guardian.start-courage',
          id: 'virtue',
          effects: [
            {
              type: 'buff',
              name: 'courage',
              kind: 'courage',
              stacks: 1,
              duration: 6
            },
            {
              type: 'boon',
              name: 'aegis',
              boon: 'aegis',
              stacks: 1,
              duration: 4
            },
            {
              type: 'boon',
              name: 'stability',
              boon: 'stability',
              stacks: 1,
              duration: 4
            }
          ]
        }
      }
    ]
  },
  [ID.HEEL_CRACK]: {
    name: 'Heel Crack',
    icon: 'https://render.guildwars2.com/file/A0AB7CACD03DF97ABC629019B2E31078D2C10AE5/2479378.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Physical',
    cooldown: 2,

    castTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.STUN
      }
    ]
  },
  [ID.HEAVENS_PALM]: {
    name: "Heaven's Palm",
    icon: 'https://render.guildwars2.com/file/547D1CB9323E9DA5495E1250F4A6396CA915119A/2479365.png',
    type: 'Elite',
    slot: 'Elite',
    skillFamily: 'Physical',
    shadowstepSkill: true,
    cooldown: 20,
    castTimeMs: 960,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKBACK
      }
    ]
  },
  [ID.WHIRLING_LIGHT]: {
    name: 'Whirling Light',
    icon: 'https://render.guildwars2.com/file/5B15BDE6546101D1D3B453AC2B2DE4C12B1F7EA0/2479377.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Physical',
    cooldown: 15,
    castTimeMs: 960,
    interruptCommitMs: 920,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        // Resolve one bolt per strike so field expiry and ignition cooldowns apply to each pulse.
        ticks: [280, 480, 680, 880].map((atMs) => ({
          atMs,
          coefficient: 1,
          comboFinishers: [
            {
              ownerId: 'guardian',
              finisherType: COMBO_FINISHER.WHIRL,
              attemptGroup: `whirl:${atMs}`
            }
          ]
        }))
      },
      {
        type: 'condition',
        ticks: [280, 480, 680, 880].map((atMs) => ({
          atMs,
          condition: CONDITION.WEAKNESS,
          stacks: 1,
          duration: 3
        }))
      },
      {
        type: 'condition',
        ticks: [280, 480, 680, 880].map((atMs) => ({
          atMs,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 3
        }))
      }
    ])
  },
  [ID.FLOWING_RESOLVE]: {
    name: 'Flowing Resolve',
    icon: 'https://render.guildwars2.com/file/E7DB54CE0FA25D3476405E083DBA25033C18FDA3/2479368.png',
    type: 'Profession',
    slot: 'Profession_2',
    virtue: 'resolve',
    cooldown: 20,
    ammo: 2,

    ammoCastLockout: 0.5,
    castTimeMs: 520,
    effects: [],
    // Accepted activations launch the self window and autonomous flame group.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelledBeforeCommit,
        do: {
          type: 'guardian.start-resolve',
          id: 'virtue',
          effects: [
            {
              type: 'buff',
              name: 'resolve',
              kind: 'resolve',
              stacks: 1,
              duration: 6
            }
          ]
        }
      }
    ]
  },
  [ID.FLASH_COMBO]: {
    name: 'Flash Combo',
    icon: 'https://render.guildwars2.com/file/4B51750AC83E9E433F10A70FCFD2EDB5536566C2/2479373.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Physical',
    shadowstepSkill: true,
    cooldown: 20,
    castTimeMs: 680,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        ticks: [120, 280, 400, 520, 600].map((atMs) => ({ atMs, coefficient: 0.9 }))
      }
    ],
    // Committed combos arm Repose, including shortened channels; old occurrences expire before same-time casts.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.REPOSE, durationSec: 6 } }]
  },
  [ID.WILLBENDER_FLAMES_ID_62618]: {
    name: 'Willbender Flames',
    icon: 'https://render.guildwars2.com/file/9EBC7246D94A4742CFA576CE553C019D93EA92F5/2479370.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 0,
    castTimeMs: 0,
    effects: flameEffects
  },
  [ID.REVERSAL_OF_FORTUNE]: {
    name: 'Reversal of Fortune',
    icon: 'https://render.guildwars2.com/file/769AAD7FC9A2EDDD5658514C7717940BA5DEB5D1/2479366.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Physical',
    cooldown: 2,

    castTimeMs: 680,
    effects: []
  },
  [ID.RUSHING_JUSTICE]: {
    name: 'Rushing Justice',
    icon: 'https://render.guildwars2.com/file/2F3E006427F17D3EF747BF0F0B0E0A941964572F/2479367.png',
    type: 'Profession',
    slot: 'Profession_1',
    virtue: 'justice',
    cooldown: 12,
    rechargeAnchor: 'castStart',
    castTimeMs: 480,
    // Both impact packets retain the impact identity; the strike uses mechanic weapon strength.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        sourceId: ID.RUSHING_JUSTICE_IMPACT,
        weapon: 'Profession Mechanic',
        name: 'Rushing Justice - Impact Damage'
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 4,
        sourceId: ID.RUSHING_JUSTICE_IMPACT,
        name: 'Rushing Justice - Initial Burning'
      }
    ]),
    // Accepted activations launch the self window and autonomous flame group.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelledBeforeCommit,
        do: {
          type: 'guardian.start-justice',
          id: 'virtue',
          effects: [
            {
              type: 'buff',
              name: 'justice',
              kind: 'justice',
              stacks: 1,
              duration: 8
            }
          ]
        }
      }
    ]
  },
  [ID.REPOSE]: {
    name: 'Repose',
    icon: 'https://render.guildwars2.com/file/3D9C99D66E6CD2B0529DED46AC38AA51F4E2A61E/2479374.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 0,
    shadowstepSkill: true,
    castTimeMs: 200,
    effects: [],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.REPOSE } }]
  },
  [ID.QUICK_RETRIBUTION]: {
    name: 'Quick Retribution',
    icon: 'https://render.guildwars2.com/file/30A7260E22B123AD772B93C6DD11C2313D3F2D02/2479376.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Physical',
    cooldown: 0,
    castTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ],
    // The follow-up owns the outgoing daze; Roiling Light only breaks the player's stun and opens this window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.QUICK_RETRIBUTION } }]
  }
};
