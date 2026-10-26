import { ACTOR, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const NECROMANCER_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.VICIOUS_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    interruptMode: 'per-packet',
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.65 },
      { type: 'condition', condition: CONDITION.TORMENT, stacks: 1, duration: 3.5 }
    ])
  },
  [ID.WEEPING_SHOTS]: {
    castTimeMs: 840,
    // Interruption preserves landed packets and cancels the remaining shots.
    interruptMode: 'per-packet',
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    // Both conditions follow each bullet so partial casts and condition-triggered rewards use landed shots.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // Each landed bullet grants its share; misses and interrupted shots earn nothing.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'each',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 1.5 } })
          }
        ],
        ticks: [240, 360, 520, 640, 760, 880].map((atMs) => ({ atMs, coefficient: 0.4 }))
      },
      {
        type: 'condition',
        ticks: [240, 360, 520, 640, 760, 880].map((atMs) => ({
          atMs,
          condition: CONDITION.TORMENT,
          stacks: 1,
          duration: 4
        }))
      },
      {
        type: 'condition',
        ticks: [240, 360, 520, 640, 760, 880].map((atMs) => ({
          atMs,
          condition: CONDITION.VULNERABILITY,
          stacks: 1,
          duration: 6
        }))
      }
    ])
  },
  [ID.VILE_BLAST]: {
    castTimeMs: 600,
    // Committed casts retain the full lockout so cancelling cannot skip the aftercast.
    interruptCommitMs: 560,
    retainsCastLockoutAfterInterrupt: true,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 4 } })
          }
        ],
        coefficient: 1
      },
      { type: 'condition', condition: CONDITION.POISONED, stacks: 5, duration: 6 },
      { type: 'control', controlKind: CONTROL.STUN }
    ])
  }
});
