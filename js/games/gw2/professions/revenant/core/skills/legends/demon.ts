/** Owns Legendary Demon Stance skill fragments and its Unyielding Impact follow-up. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_DEMON_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RESIST_THE_DARKNESS]: {
    // Custom: Releases the active upkeep skill and exposes its parent again; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep-release',
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryDemon'
  },
  [ID.PAIN_ABSORPTION]: {
    castTimeMs: 500,
    cooldown: 0,
    energyCost: 30,
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 1,
        stacks: 1
      }
    ],
    legendId: 'LegendaryDemon'
  },
  [ID.BANISH_ENCHANTMENT]: {
    interruptCommitMs: 0,
    quicknessCastTimeMs: 440,
    cooldown: 0,
    energyCost: 20,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 3 }, (_, index) => ({ atMs: 402 + index * 119, coefficient: 1.2 / 3 })),
        name: 'Banish Enchantment',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {}
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 3 }, (_, index) => ({
          atMs: 402 + index * 119,
          condition: 'Chilled',
          stacks: 1,
          duration: 1
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {},
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 3 }, (_, index) => ({
          atMs: 402 + index * 119,
          condition: 'Torment',
          stacks: 1,
          duration: 3
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {},
        actorType: 'player'
      }
    ],
    legendId: 'LegendaryDemon'
  },
  [ID.CALL_TO_ANGUISH]: {
    interruptCommitMs: 0,
    quicknessCastTimeMs: 820,
    cooldown: 3,
    energyCost: 30,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 804, coefficient: 1.2 }],
        name: 'Call to Anguish',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [{ atMs: 804, condition: 'Chilled', stacks: 1, duration: 2 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {}
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 804,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        controlKind: 'pull',
        duration: 360
      }
    ],
    legendId: 'LegendaryDemon'
  },
  [ID.EMPOWERING_MISERY]: {
    castTimeMs: 750,
    cooldown: 30,
    energyCost: 5,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1
      }
    ],
    legendId: 'LegendaryDemon'
  },
  [ID.EMBRACE_THE_DARKNESS]: {
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep',
    quicknessCastTimeMs: 440,
    cooldown: 3,
    energyCost: 5,
    upkeepCost: 6,
    pulseInterval: 1,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 362, coefficient: 0.3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Embrace the Darkness',
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
        metadata: { trigger: 'empowered-upkeep-pulse' }
      }
    ],
    legendId: 'LegendaryDemon'
  },
  [ID.RELINQUISH_POWER]: {
    // Custom: Releases the active upkeep skill and exposes its parent again; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep-release',
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryAssassin'
  },
  [ID.UNYIELDING_IMPACT]: {
    quicknessCastTimeMs: 920,
    cooldown: 0,
    energyCost: 5,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 557, coefficient: 1 }],
        name: 'Unyielding Impact',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 557, condition: 'Burning', stacks: 1, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 557, condition: 'Torment', stacks: 4, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 557, condition: 'Poisoned', stacks: 1, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    legendId: 'LegendaryDemon'
  }
});
