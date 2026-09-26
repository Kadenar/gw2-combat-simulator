/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';

// Align measured impacts and their attached effects on the nearest 40 ms action tick.
export const REVENANT_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.ABYSSAL_BLITZ]: {
    // Custom: Recharges Abyssal Raze after the qualifying hit; see `core/live-weapons.ts`.
    castTimeMs: 520,
    cooldown: 10,
    energyCost: 10,
    rechargeReduction: 3,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        name: 'Abyssal Blitz — Mine',
        actorType: 'player',
        ticks: [560, 720, 960].map((atMs) => ({ atMs, coefficient: 0.5 })),
        metadata: {}
      },
      {
        type: 'condition',
        actorType: 'player',
        ticks: [560, 720, 960].map((atMs) => ({ atMs, condition: 'Slow', stacks: 1, duration: 3 })),
        metadata: {}
      },
      {
        type: 'condition',
        actorType: 'player',
        ticks: [560, 720, 960].map((atMs) => ({ atMs, condition: 'Chilled', stacks: 1, duration: 3 })),
        metadata: {}
      },
      {
        type: 'condition',
        actorType: 'player',
        ticks: [560, 720, 960].map((atMs) => ({ atMs, condition: 'Weakness', stacks: 1, duration: 3 })),
        metadata: {}
      }
    ])
  },
  [ID.ABYSSAL_BLOT]: {
    // Abyssal Blot commits after 760 ms, preserving its field and delayed impacts after interruption.
    interruptCommitMs: 760,
    // Custom: Recharges Abyssal Raze after the qualifying hit; see `core/live-weapons.ts`.
    castTimeMs: 800,
    cooldown: 15,
    energyCost: 12,
    // The initial pull recharges Raze by 3 seconds per target, matching the in-game tooltip.
    rechargeReduction: 3,
    // The dark field spans Blot's five impacts so subsequent spear finishers
    // resolve their combo outcome against the field instead of its damage.
    comboFields: [
      {
        ownerId: 'revenant',
        fieldType: 'Dark',
        duration: 1.12,
        startMs: 960,
        startAnchor: 'castStart',
        inclusiveExpiry: true
      }
    ],
    effects: [
      {
        type: 'strike',
        name: 'Abyssal Blot',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        ticks: [
          { atMs: 960, coefficient: 0.4 },
          { atMs: 1240, coefficient: 0.4 },
          { atMs: 1520, coefficient: 0.4 },
          { atMs: 1800, coefficient: 0.4 },
          { atMs: 2080, coefficient: 0.4 }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player',
        persistsAfterInterrupt: true,
        ticks: [
          { atMs: 960, condition: 'Poisoned', stacks: 1, duration: 6 },
          { atMs: 1240, condition: 'Poisoned', stacks: 1, duration: 6 },
          { atMs: 1520, condition: 'Poisoned', stacks: 1, duration: 6 },
          { atMs: 1800, condition: 'Poisoned', stacks: 1, duration: 6 },
          { atMs: 2080, condition: 'Poisoned', stacks: 1, duration: 6 }
        ],
        metadata: {}
      },
      // Share one impact timing while preserving independent payloads and declaration order.
      ...impactEffects({ atMs: 960, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
        {
          type: 'condition',
          condition: 'Chilled',
          stacks: 1,
          duration: 2,
          actorType: 'player'
        },
        {
          type: 'control',
          actorType: 'player',
          controlKind: 'pull'
        }
      ])
    ]
  },
  [ID.ABYSSAL_FORCE]: {
    // Custom: Recharges Abyssal Raze after the qualifying hit; see `core/live-weapons.ts`.
    castTimeMs: 520,
    cooldown: 6,
    energyCost: 4,
    rechargeReduction: 5,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 1160, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Abyssal Force',
        actorType: 'player',
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ])
  },
  [ID.ABYSSAL_STRIKE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    // Custom: Recharges Abyssal Raze after the qualifying hit; see `core/live-weapons.ts`.
    castTimeMs: 520,
    interruptCommitMs: 396,
    cooldown: 0,
    energyCost: 0,
    rechargeReduction: 1,
    nextChainId: null,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.85,
          hits: 1,
          name: 'Abyssal Strike',
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Torment',
          stacks: 1,
          duration: 3,
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Vulnerability',
          stacks: 1,
          duration: 6,
          actorType: 'player'
        }
      ]
    )
  },
  [ID.ABYSSAL_RAZE]: {
    // Custom: Consumes Crushing Abyss stacks and materializes the scaled raze packets; see `core/live-weapons.ts`.
    castTimeMs: 600,
    cooldown: 1,
    ammoCastLockout: 1,
    ammo: 3,
    ammoRecharge: 15,
    energyCost: 8,
    maximumStacks: 3,
    comboFinishers: [
      {
        ownerId: 'revenant',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        damageIncreasePerStack: 0.33,
        name: 'Abyssal Raze',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 5,
        actorType: 'player',
        metadata: { trigger: 'crushing-abyss' }
      },
      {
        type: 'buff',
        sourceId: 72962,
        kind: 'crushing-abyss',
        duration: 10,
        stacks: 1,
        name: 'Crushing Abyss',
        actorType: 'player'
      }
    ])
  }
});
