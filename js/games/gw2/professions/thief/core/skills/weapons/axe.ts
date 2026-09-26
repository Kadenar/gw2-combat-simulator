/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.VENOMOUS_VOLLEY]: {
    castTimeMs: 520,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        ticks: [160, 360, 520].map((atMs) => ({
          atMs,
          coefficient: 3.6 / 3
        })),
        name: 'Venomous Volley',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Poisoned', stacks: 1, duration: 2 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SPINNING_AXE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Spinning Axe',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ])
  },
  [ID.HARROWING_STORM]: {
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Torment', stacks: 1, duration: 2 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Axe',
    requiredOffHand: 'Dagger'
  },
  [ID.RECALL_AXES]: {
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Weakness', stacks: 1, duration: 1 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Axe',
    requiredOffHand: false
  },
  [ID.ORCHESTRATED_ASSAULT]: {
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Weakness', stacks: 1, duration: 1 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Axe',
    requiredOffHand: 'Pistol'
  },
  [ID.SPINNING_AXE_ID_71967]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Spinning Axe',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ])
  },
  [ID.CUNNING_SALVO]: {
    // Custom: Consumes stealth and applies Revealed after the attack through `core/hooks.ts`.
    castTimeMs: 360,
    cooldown: 1,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Cunning Salvo',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]),
    requiredMainHand: 'Axe',
    stealthAttack: true
  }
});
