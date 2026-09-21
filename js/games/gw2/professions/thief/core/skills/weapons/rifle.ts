/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DEATHS_ADVANCE]: {
    castTimeMs: 200,
    cooldown: 0,
    initiativeCost: 2,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      }
    ],
    kneelSkill: true
  },
  [ID.KNEEL]: {
    // Custom: Enters Kneel and exposes kneeling rifle skills; see `core/skills/actions.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'thief.kneel',
    castTimeMs: 360,
    cooldown: 0.5,
    initiativeCost: 1,
    effects: []
  },
  [ID.DEADLY_AIM]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    cooldown: 0,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1,
        name: 'Deadly Aim',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]),
    kneelSkill: true
  },
  [ID.FREE_ACTION]: {
    // Custom: Leaves Kneel and restores standing rifle skills; see `core/skills/actions.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'thief.free-action',
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ],
    kneelSkill: true
  },
  [ID.BRUTAL_AIM]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 520,
    cooldown: 0,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Brutal Aim',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ])
  },
  [ID.SKIRMISHERS_SHOT]: {
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      ...impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1,
          hits: 1,
          name: "Skirmisher's Shot",
          actorType: 'player',
          comboFinishers: [
            {
              ownerId: 'thief',
              finisherType: 'Projectile',
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {}
        },
        {
          type: 'condition',
          condition: 'Crippled',
          stacks: 1,
          duration: 4,
          actorType: 'player'
        }
      ]),
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.DEATHS_RETREAT]: {
    castTimeMs: 200,
    cooldown: 0,
    initiativeCost: 4,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        name: "Death's Retreat",
        actorType: 'player',
        // Retain a field crossed during the leap even when it expires before landing.
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Leap',
            fieldSelectionAnchor: 'castStart',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      }
    ])
  },
  [ID.DOUBLE_TAP]: {
    castTimeMs: 520,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [280, 520].map((atMs) => ({ atMs, coefficient: 2.8 / 2 })),
        name: 'Double Tap',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 6,
        stacks: 3
      }
    ]
  },
  [ID.SPOTTERS_SHOT]: {
    castTimeMs: 520,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      ...impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1.3,
          hits: 1,
          name: "Spotter's Shot",
          actorType: 'player',
          comboFinishers: [
            {
              ownerId: 'thief',
              finisherType: 'Projectile',
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {}
        },
        {
          type: 'condition',
          condition: 'Crippled',
          stacks: 1,
          duration: 4,
          actorType: 'player'
        }
      ]),
      {
        type: 'boon',
        boon: 'fury',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 3,
        stacks: 1
      }
    ],
    kneelSkill: true
  },
  [ID.THREE_ROUND_BURST]: {
    castTimeMs: 840,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [240, 440, 680].map((atMs) => ({ atMs, coefficient: 2.25 / 3 })),
        name: 'Three Round Burst',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 6,
        stacks: 3
      }
    ],
    kneelSkill: true
  },
  [ID.SNIPERS_COVER]: {
    castTimeMs: 200,
    cooldown: 0,
    initiativeCost: 4,
    // The smoke field lasts through the existing five-second Death's Advance follow-up window.
    comboFields: [{ ownerId: 'thief', fieldType: 'Smoke', duration: 5, startAnchor: 'castEnd' }],
    effects: [],
    kneelSkill: true
  },
  [ID.DEATHS_JUDGMENT]: {
    // Custom: Consumes stealth and applies Revealed after the attack; see `core/mechanics/stealth.ts`.
    handlerId: 'thief.stealth-attack',
    castTimeMs: 360,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.67 }],
        name: "Death's Judgment — Packet 1",
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.32 }],
        name: 'Damage on Unmarked Foes',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Rifle',
    stealthAttack: true
  }
});
