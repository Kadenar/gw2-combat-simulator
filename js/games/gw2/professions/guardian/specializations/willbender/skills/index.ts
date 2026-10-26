import { ACTOR, CONTROL, COMBO_FINISHER, BOON, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

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
 * Owns Willbender virtue and physical skill fragments.
 * Runtime virtue behavior lives in `mechanics/virtues.ts`.
 */

export const WILLBENDER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // This combat-log identity is absent from API metadata, so its canonical fragment supplies its identity too.
  [ID.WILLBENDER_FLAMES_COURAGE]: {
    id: ID.WILLBENDER_FLAMES_COURAGE,
    name: 'Willbender Flames',
    castTimeMs: 0,
    effects: flameEffects
  },
  [ID.ROILING_LIGHT]: {
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [
      {
        on: 'castCommit',
        do: { type: 'flipArm', skillId: ID.QUICK_RETRIBUTION, durationSec: 15, expiryPriority: -220 }
      }
    ],
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
    ]
  },
  [ID.WILLBENDER_FLAMES]: {
    castTimeMs: 0,
    effects: flameEffects
  },
  [ID.CRASHING_COURAGE]: {
    // Accepted activations launch the self window and autonomous flame group.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
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
              boon: 'Aegis',
              stacks: 1,
              duration: 4
            },
            {
              type: 'boon',
              name: 'stability',
              boon: 'Stability',
              stacks: 1,
              duration: 4
            }
          ]
        }
      }
    ],
    castTimeMs: 680,
    // Grant the virtue's defensive boons with its initial strike.
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        // Virtue strikes use mechanic weapon strength independently of equipped weapons.
        weapon: 'Profession Mechanic',
        name: 'Crashing Courage — Initial Damage'
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
    ])
  },
  [ID.HEEL_CRACK]: {
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
    castTimeMs: 960,
    cooldown: 20,
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
    castTimeMs: 960,
    interruptCommitMs: 920,
    cooldown: 15,
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
    // Accepted activations launch the self window and autonomous flame group.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
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
    ],
    castTimeMs: 520,

    ammoCastLockout: 0.5,
    effects: []
  },
  [ID.FLASH_COMBO]: {
    // Committed combos arm Repose, including shortened channels; old occurrences expire before same-time casts.
    sideEffects: [
      { on: 'castCommit', do: { type: 'flipArm', skillId: ID.REPOSE, durationSec: 6, expiryPriority: -220 } }
    ],
    castTimeMs: 680,
    cooldown: 20,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        ticks: [120, 280, 400, 520, 600].map((atMs) => ({ atMs, coefficient: 0.9 }))
      }
    ]
  },
  [ID.WILLBENDER_FLAMES_ID_62618]: {
    castTimeMs: 0,
    effects: flameEffects
  },
  [ID.REVERSAL_OF_FORTUNE]: {
    castTimeMs: 680,
    effects: []
  },
  [ID.RUSHING_JUSTICE]: {
    // Accepted activations launch the self window and autonomous flame group.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
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
    ],
    castTimeMs: 480,
    rechargeAnchor: 'castStart',
    // Both impact packets retain the impact identity; the strike uses mechanic weapon strength.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        sourceId: ID.RUSHING_JUSTICE_IMPACT,
        weapon: 'Profession Mechanic',
        name: 'Rushing Justice — Impact Damage'
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 4,
        sourceId: ID.RUSHING_JUSTICE_IMPACT,
        name: 'Rushing Justice — Initial Burning'
      }
    ])
  },
  [ID.REPOSE]: {
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.REPOSE } }],
    castTimeMs: 200,
    effects: []
  },
  [ID.QUICK_RETRIBUTION]: {
    // The follow-up owns the outgoing daze; Roiling Light only breaks the player's stun and opens this window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.QUICK_RETRIBUTION } }],
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
    ]
  }
});
