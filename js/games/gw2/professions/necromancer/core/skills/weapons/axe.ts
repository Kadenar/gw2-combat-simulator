/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill, SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const NECROMANCER_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.GHASTLY_CLAWS]: {
    interruptMode: 'per-packet',
    castTimeMs: 1520,
    cooldown: 6,
    lifeForcePerHit: 12 / 8,
    effects: [
      {
        type: 'strike',
        // The supplied Quickness logs resolve eight individual hits; interruptions preserve only reached packets.
        ticks: [320, 440, 600, 760, 920, 1040, 1200, 1360].map((atMs) => ({ atMs, coefficient: 4.6 / 8 })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.RENDING_CLAWS]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    // Each logged claw applies one Vulnerability stack at its own impact.
    interruptMode: 'per-packet',
    castTimeMs: 720,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [400, 640].map((atMs) => ({ atMs, coefficient: 1.4 / 2 }))
      },
      {
        type: 'condition',
        ticks: [400, 640].map((atMs) => ({ atMs, condition: 'Vulnerability', duration: 7, stacks: 1 }))
      }
    ])
  },
  [ID.UNHOLY_FEAST]: {
    // The impact precedes cast completion; its health-gated burst is scheduled from that impact.
    castTimeMs: 920,
    cooldown: 10,
    interruptCommitMs: 720,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2.5, hits: 1 },
      { type: 'condition', condition: 'Crippled', duration: 5, stacks: 1 }
    ])
  }
});

// The log's separate burst identity is a triggered strike, with a fixed delay after Feast's qualifying impact.
export const NECROMANCER_AXE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.UNHOLY_BURST,
    name: 'Unholy Burst',
    type: 'Proc',
    simulatorExcluded: true,
    parentId: ID.UNHOLY_FEAST,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        weapon: 'Axe'
      }
    ]
  }
]);
