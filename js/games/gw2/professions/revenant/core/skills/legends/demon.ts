/** Owns Legendary Demon Stance skill fragments and its Unyielding Impact follow-up. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';

// Align measured impacts and their attached effects on the nearest 40 ms action tick.
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
    // Grant the base boons without assuming any allied conditions were absorbed.
    castTimeMs: 360,
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
      }
    ],
    legendId: 'LegendaryDemon'
  },
  [ID.BANISH_ENCHANTMENT]: {
    // Banish Enchantment commits at 400 ms, preserving the launched multi-hit sequence after interruption.
    interruptCommitMs: 400,
    castTimeMs: 440,
    cooldown: 0,
    energyCost: 20,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 3 }, (_, index) => ({ atMs: 400 + index * 120, coefficient: 1.2 / 3 })),
        name: 'Banish Enchantment',
        actorType: 'player',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 3 }, (_, index) => ({
          atMs: 400 + index * 120,
          condition: 'Chilled',
          stacks: 1,
          duration: 1
        })),
        metadata: {},
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 3 }, (_, index) => ({
          atMs: 400 + index * 120,
          condition: 'Torment',
          stacks: 1,
          duration: 3
        })),
        metadata: {},
        actorType: 'player'
      }
    ]),
    legendId: 'LegendaryDemon'
  },
  [ID.CALL_TO_ANGUISH]: {
    // Call to Anguish completes on its 800 ms impact, which also commits its effects.
    interruptCommitMs: 800,
    castTimeMs: 800,
    cooldown: 3,
    energyCost: 30,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 1.2,
          hits: 1,
          name: 'Call to Anguish',
          actorType: 'player',
          metadata: {}
        },
        {
          type: 'condition',
          condition: 'Chilled',
          stacks: 1,
          duration: 2,
          actorType: 'player',
          metadata: {}
        },
        {
          type: 'control',
          actorType: 'player',
          controlKind: 'pull'
        }
      ]
    ),
    legendId: 'LegendaryDemon'
  },
  [ID.EMPOWERING_MISERY]: {
    castTimeMs: 520,
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
    castTimeMs: 440,
    interruptCommitMs: 400,
    cooldown: 3,
    energyCost: 5,
    upkeepCost: 6,
    pulseInterval: 1,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 0.3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Embrace the Darkness',
        actorType: 'player',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 5,
        actorType: 'player',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 5,
        actorType: 'player',
        persistsAfterInterrupt: true,
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
    // The reviewed activation ends after the existing 560 ms impact packets.
    castTimeMs: 680,
    cooldown: 0,
    energyCost: 5,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Unyielding Impact',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 4,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]),
    legendId: 'LegendaryDemon'
  }
});
