/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';

export const REVENANT_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.FRIGID_BLITZ]: {
    // Keep the axe hit when only the opening phase completes; the follow-up needs the remaining cast.
    castTimeMs: 1000,
    interruptMode: 'per-packet',
    cooldown: 10,
    energyCost: 10,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [{ atMs: 680, coefficient: 0.15 }],
        name: 'Pass-Through Damage',
        actorType: 'player'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 1.5 }],
        name: 'Final Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 680, condition: 'Chilled', stacks: 1, duration: 2 }],
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1000, condition: 'Torment', stacks: 3, duration: 6 }],
        actorType: 'player'
      }
    ])
  },
  [ID.TEMPORAL_RIFT]: {
    castTimeMs: 560,
    // Once opened at 480 ms, the rift retains its delayed effects and the remaining cast lockout.
    interruptCommitMs: 480,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 15,
    energyCost: 10,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 640, timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Temporal Rift',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 4,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'pull'
      }
    ])
  }
});
