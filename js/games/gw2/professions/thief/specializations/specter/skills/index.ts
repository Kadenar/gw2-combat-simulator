import { ACTOR, COMBO_FINISHER, CONTROL, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Shadow Shroud entry and exit are state-selected variants of one UI tile.
const SHADOW_SHROUD_PALETTE_TILE = 'specter-shadow-shroud';

// Share each impact's timing while preserving effect order and effect-local payloads.
export const SPECTER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SIPHON]: {
    stealTraitSkill: true,
    // Siphon adds Lead Attacks and Sleight of Hand reductions instead of multiplying them.
    stealRechargeMode: 'additive',
    cooldown: 18,
    initiativeCost: 0,

    castTimeMs: 520,
    // Siphon's committed effects survive cancellation of the remaining animation.
    interruptCommitMs: 440,
    effects: [
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: CONDITION.SLOW, stacks: 1, duration: 5 }],
        persistsAfterInterrupt: true,
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.siphon' } }]
  },
  [ID.ENTER_SHADOW_SHROUD]: {
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    shadowShroudTransition: 'enter',
    cooldown: 8,
    paletteTileId: SHADOW_SHROUD_PALETTE_TILE,
    paletteTileOrder: 1,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.enter-shadow-shroud' } },
      { on: 'castCommit', do: { type: 'thief.shroud-entry-barrier' } }
    ]
  },
  [ID.HAUNT_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    initiativeCost: 0,
    shadowShroudSkill: true,

    castTimeMs: 640,
    interruptCommitMs: 560,
    effects: [
      ...impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        {
          weaponStrengthProfileId: 'transform.shadow-shroud',
          type: 'strike',
          coefficient: 1.075,
          hits: 1,
          name: 'Haunt Shot',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          stacks: 1,
          duration: 6,
          actorType: ACTOR.PLAYER
        }
      ]),
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 5,
        stacks: 1,
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.GRASPING_SHADOWS]: {
    cooldown: 3,
    initiativeCost: 0,
    shadowShroudSkill: true,
    castTimeMs: 240,
    // The ground effect is already placed when a following shroud skill cancels the remaining animation.
    interruptCommitMs: 200,
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    effects: impactEffects(
      { atMs: 1000, timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          weaponStrengthProfileId: 'transform.shadow-shroud',
          type: 'strike',
          coefficient: 1.66,
          hits: 1,
          name: 'Grasping Shadows',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 3,
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          stacks: 2,
          duration: 6,
          actorType: ACTOR.PLAYER
        }
      ]
    )
  },
  [ID.DAWNS_REPOSE]: {
    cooldown: 8,
    initiativeCost: 0,
    shadowShroudSkill: true,

    // The leap hits at 800 ms and finishes its activation at 960 ms in the supplied log.
    castTimeMs: 960,
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: COMBO_FINISHER.LEAP
      }
    ],
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        weaponStrengthProfileId: 'transform.shadow-shroud',
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: "Dawn's Repose",
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.FEAR,
        stacks: 1,
        duration: 1,
        actorType: ACTOR.PLAYER
      }
    ]),
    // Successful completion grants the intrinsic barrier independently of trait rewards.
    sideEffects: [
      { on: 'castCommit', when: (_runtime, cast) => !castWasInterrupted(cast), do: { type: 'thief.dawns-barrier' } }
    ]
  },
  [ID.WELL_OF_SILENCE]: {
    movementSkill: true,
    cooldown: 25,
    initiativeCost: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.DAZE
      }
    ]
  },
  [ID.ETERNAL_NIGHT]: {
    cooldown: 8,
    initiativeCost: 0,
    shadowShroudSkill: true,
    // The supplied log retains the 360/680 ms impacts within a 760 ms activation.
    castTimeMs: 760,
    // Both impacts have committed before the animation finishes.
    interruptCommitMs: 720,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        weaponStrengthProfileId: 'transform.shadow-shroud',
        type: 'strike',
        ticks: Array.from({ length: 2 }, (_, index) => ({ atMs: 360 + index * 320, coefficient: 3.5 / 2 })),
        name: 'Eternal Night',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: CONDITION.CHILLED, stacks: 1, duration: 2 }],
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [{ atMs: 680, condition: CONDITION.WEAKNESS, stacks: 1, duration: 4 }],
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [360, 680].map((atMs) => ({ atMs, condition: CONDITION.POISONED, stacks: 2, duration: 4 })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.EXIT_SHADOW_SHROUD]: {
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    shadowShroudTransition: 'exit',
    cooldown: 0,
    paletteTileId: SHADOW_SHROUD_PALETTE_TILE,
    paletteTileOrder: 2,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.exit-shadow-shroud' } }]
  },
  [ID.SHADOWFALL]: {
    cooldown: 75,
    initiativeCost: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [120, 240, 360].map((atMs) => ({ atMs, coefficient: 4.5 / 3 })),
        name: 'Shadowfall',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.PULL
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.PULL
      }
    ]
  },
  [ID.WELL_OF_SORROW]: {
    movementSkill: true,
    shadowstepSkill: true,
    cooldown: 20,
    initiativeCost: 0,
    castTimeMs: 600,
    // Once placed, the well keeps pulsing through cancellation of its remaining animation.
    interruptCommitMs: 520,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 400 + index * 1000, coefficient: 1.11 / 5 })),
        name: 'Well of Sorrow',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 400, condition: CONDITION.TORMENT, stacks: 2, duration: 6 },
          { atMs: 1400, condition: CONDITION.BLEEDING, stacks: 3, duration: 6 },
          { atMs: 2400, condition: CONDITION.TORMENT, stacks: 2, duration: 6 },
          { atMs: 3400, condition: CONDITION.POISONED, stacks: 3, duration: 6 },
          { atMs: 4400, condition: CONDITION.TORMENT, stacks: 2, duration: 6 }
        ],
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.WELL_OF_GLOOM]: {
    movementSkill: true,
    cooldown: 20,
    initiativeCost: 0,
    castTimeMs: 680,
    effects: [
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: CONDITION.CRIPPLED, stacks: 1, duration: 2 }],
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.WELL_OF_TEARS]: {
    movementSkill: true,
    shadowstepSkill: true,
    cooldown: 20,
    initiativeCost: 0,
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 0 + index * 1000, coefficient: 5 / 5 })),
        name: 'Well of Tears',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.WELL_OF_BOUNTY]: {
    movementSkill: true,
    shadowstepSkill: true,
    cooldown: 20,
    initiativeCost: 0,
    castTimeMs: 400,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.STABILITY,
        duration: 5,
        stacks: 2,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 15,
        stacks: 8,
        atMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.FURY,
        duration: 5,
        stacks: 1,
        atMs: 2000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.VIGOR,
        duration: 8,
        stacks: 1,
        atMs: 3000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 12,
        stacks: 1,
        atMs: 4000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MIND_SHOCK]: {
    cooldown: 16,
    initiativeCost: 0,
    shadowShroudSkill: true,
    castTimeMs: 360,
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    effects: [
      {
        weaponStrengthProfileId: 'transform.shadow-shroud',
        type: 'strike',
        ticks: [{ atMs: 3000, coefficient: 2 }],
        name: 'Mind Shock',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.STABILITY,
        duration: 4,
        stacks: 3
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        atMs: 3000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        controlKind: CONTROL.STUN
      }
    ]
  }
});
