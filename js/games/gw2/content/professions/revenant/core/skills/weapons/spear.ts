/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ABYSSAL_FIRE]: {
    // Custom: Recharges Abyssal Raze after the qualifying hit; see `core/skills/spear.ts`.
    handlerId: 'revenant.spear-recharge',
    simulatorExcluded: true,
    quicknessCastTimeMs: 460,
    cooldown: 0,
    energyCost: 0,
    rechargeReduction: 1,
    flipParentId: null,
    effects: [
      {
        type: 'strike',
        coefficient: 0.85,
        hits: 1,
        name: 'Abyssal Fire',
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
  },
  [ID.ABYSSAL_BLITZ]: {
    interruptCommitMs: 0,
    // Custom: Recharges Abyssal Raze after the qualifying hit; see `core/skills/spear.ts`.
    handlerId: 'revenant.spear-recharge',
    quicknessCastTimeMs: 520,
    cooldown: 10,
    energyCost: 10,
    rechargeReduction: 3,
    effects: [
      {
        type: 'strike',
        name: 'Abyssal Blitz — Mine',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        ticks: [
          { atMs: 560, coefficient: 0.5 },
          { atMs: 720, coefficient: 0.5 },
          { atMs: 960, coefficient: 0.5 }
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
          { atMs: 560, condition: 'Slow', stacks: 1, duration: 3 },
          { atMs: 720, condition: 'Slow', stacks: 1, duration: 3 },
          { atMs: 960, condition: 'Slow', stacks: 1, duration: 3 }
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
          { atMs: 560, condition: 'Chilled', stacks: 1, duration: 3 },
          { atMs: 720, condition: 'Chilled', stacks: 1, duration: 3 },
          { atMs: 960, condition: 'Chilled', stacks: 1, duration: 3 }
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
          { atMs: 560, condition: 'Weakness', stacks: 1, duration: 3 },
          { atMs: 720, condition: 'Weakness', stacks: 1, duration: 3 },
          { atMs: 960, condition: 'Weakness', stacks: 1, duration: 3 }
        ],
        metadata: {}
      }
    ]
  },
  [ID.ABYSSAL_BLOT]: {
    interruptCommitMs: 0,
    // Custom: Recharges Abyssal Raze after the qualifying hit; see `core/skills/spear.ts`.
    handlerId: 'revenant.spear-recharge',
    quicknessCastTimeMs: 800,
    cooldown: 15,
    energyCost: 12,
    rechargeReduction: 2,
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
      {
        type: 'condition',
        ticks: [{ atMs: 960, condition: 'Chilled', stacks: 1, duration: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 960,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        controlKind: 'pull',
        duration: 180
      }
    ]
  },
  [ID.ABYSSAL_FORCE]: {
    interruptCommitMs: 0,
    // Custom: Recharges Abyssal Raze after the qualifying hit; see `core/skills/spear.ts`.
    handlerId: 'revenant.spear-recharge',
    quicknessCastTimeMs: 520,
    cooldown: 6,
    energyCost: 4,
    rechargeReduction: 5,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1162, coefficient: 0.8 }],
        name: 'Abyssal Force',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1162, condition: 'Burning', stacks: 1, duration: 8 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1162, condition: 'Chilled', stacks: 1, duration: 2 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.ABYSSAL_STRIKE]: {
    // Custom: Recharges Abyssal Raze after the qualifying hit; see `core/skills/spear.ts`.
    handlerId: 'revenant.spear-recharge',
    quicknessCastTimeMs: 520,
    interruptCommitMs: 396,
    cooldown: 0,
    energyCost: 0,
    rechargeReduction: 1,
    nextChainId: null,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 396, coefficient: 0.85 }],
        name: 'Abyssal Strike',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 396, condition: 'Torment', stacks: 1, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 396, condition: 'Vulnerability', stacks: 1, duration: 6 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.ABYSSAL_RAZE]: {
    // Custom: Consumes Crushing Abyss stacks and materializes the scaled raze packets; see `core/skills/spear.ts`.
    handlerId: 'revenant.abyssal-raze',
    quicknessCastTimeMs: 600,
    cooldown: 1,
    recharge: 1,
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
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 559, coefficient: 1 }],
        damageIncreasePerStack: 0.33,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Abyssal Raze',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 559, condition: 'Torment', stacks: 1, duration: 5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 559, condition: 'Torment', stacks: 2, duration: 5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player',
        metadata: { trigger: 'crushing-abyss' }
      },
      {
        type: 'buff',
        sourceId: 72962,
        kind: 'crushing-abyss',
        duration: 10,
        stacks: 1,
        atMs: 559,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Crushing Abyss',
        actorType: 'player'
      }
    ]
  }
});
