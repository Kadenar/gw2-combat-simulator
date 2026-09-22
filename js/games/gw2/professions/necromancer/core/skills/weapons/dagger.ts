/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const NECROMANCER_WEAPONS_DAGGER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DARK_PACT]: {
    castTimeMs: 680,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2.4 },
      { type: 'condition', condition: 'Bleeding', stacks: 2, duration: 10 }
    ]),
    // Dark Pact cannot gain life force: simulated targets have no boons to remove.
    // Custom: Applies self-bleeding and target immobilize only after the first hit; see `core/mechanics/conditions.ts`.
    handlerId: 'necromancer.dark-pact'
  },
  [ID.NECROTIC_SLASH]: {
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 2,
        atMs: 0
      }
    ]
  },
  [ID.NECROTIC_STAB]: {
    castTimeMs: 400,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 160, coefficient: 0.9 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 4
  },
  [ID.NECROTIC_BITE]: {
    castTimeMs: 640,
    effects: [
      {
        type: 'strike',
        coefficient: 1.3,
        hits: 1
      }
    ],
    lifeForceGain: 8
  },
  [ID.DEATHLY_SWARM]: {
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      },
      {
        type: 'blind',
        duration: 6
      }
    ],
    // Custom: Moves a skill-specific number of active self-conditions to the target; see `core/mechanics/conditions.ts`.
    handlerId: 'necromancer.condition-transfer'
  },
  [ID.ENFEEBLING_BLOOD]: {
    castTimeMs: 840,
    // The ground packet commits before its delayed impact; cancelling retains the full cast lockout.
    interruptCommitMs: 520,
    retainsCastLockoutAfterInterrupt: true,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 1200, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 1.5 },
        { type: 'condition', condition: 'Bleeding', stacks: 3, duration: 10 },
        { type: 'condition', condition: 'Weakness', stacks: 1, duration: 6 }
      ]
    )
  },
  [ID.LIFE_SIPHON]: {
    castTimeMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 9 }, (_, index) => ({ atMs: 480 + index * 160, coefficient: 2.7 / 9 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    // Custom: Applies Life Siphon's self-bleeding on its first resolved hit; see `core/mechanics/conditions.ts`.
    handlerId: 'necromancer.life-siphon'
  }
});
