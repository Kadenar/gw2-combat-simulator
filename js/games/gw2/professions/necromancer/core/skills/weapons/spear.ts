/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const NECROMANCER_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.EXTIRPATE]: {
    castTimeMs: 840,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 3.8,
        comboFinishers: [
          {
            ownerId: 'necromancer',
            finisherType: 'Whirl',
            applications: 3,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      { type: 'boon', boon: 'Might', duration: 8, stacks: 5 },
      { type: 'condition', condition: 'Weakness', stacks: 1, duration: 3 },
      { type: 'buff', kind: 'extirpation', duration: 4, stacks: 3 }
    ]),
    lifeForceGain: 12,
    // Custom: Adds Soul Shards on the first committed hit; see `core/execution/spear.ts`.
    handlerId: 'necromancer.extirpate'
  },
  [ID.DARK_SLASH]: {
    interruptCommitMs: 560,
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 1.2 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.ADDLE]: {
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 240, coefficient: 1.9 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 10,
    // Custom: Applies the shard-gated immobilize, defiance bonus, life force, and Soul Shards; see `core/execution/spear.ts`.
    handlerId: 'necromancer.addle'
  },
  [ID.DEADLY_SLICE]: {
    interruptCommitMs: 480,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1.4 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ],
    // Custom: Adds one Soul Shard after the attack; see `core/execution/spear.ts`.
    handlerId: 'necromancer.deadly-slice'
  },
  [ID.SINISTER_STAB]: {
    castTimeMs: 560,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.8 },
      { type: 'condition', condition: 'Chilled', stacks: 1, duration: 2 }
    ]),
    lifeForceGain: 5,
    // Custom: Adds one Soul Shard after the attack; see `core/execution/spear.ts`.
    handlerId: 'necromancer.sinister-stab'
  },
  [ID.PERFORATE]: {
    interruptMode: 'per-packet',
    // The measured Quickness cast ends one 40 ms action tick after its final packet.
    castTimeMs: 800,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 400,
            coefficient: 0.5
          },
          {
            atMs: 480,
            coefficient: 0.5
          },
          {
            atMs: 520,
            coefficient: 0.5
          },
          {
            atMs: 560,
            coefficient: 0.5
          },
          {
            atMs: 640,
            coefficient: 0.5
          },
          {
            atMs: 720,
            coefficient: 0.5
          },
          {
            atMs: 760,
            coefficient: 0.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        coefficientModifiers: [
          {
            kind: 'target-health-below',
            threshold: 0.5,
            multiplier: 1.2
          }
        ]
      }
    ],
    // Custom: Snapshots/consumes Soul Shards and emits one shard hit per eligible packet; see `core/execution/spear.ts`.
    handlerId: 'necromancer.perforate'
  },
  [ID.ISOLATE]: {
    castTimeMs: 480,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2.4 },
      { type: 'condition', condition: 'Chilled', stacks: 1, duration: 3 },
      { type: 'condition', condition: 'Vulnerability', stacks: 8, duration: 8 }
    ]),
    flipDuration: 3,
    flipActivationAtMs: 440
  },
  [ID.DISTRESS]: {
    castTimeMs: 0,
    effects: [],
    // Custom: Consumes the flip, refreshes Perforate, and grants Soul Shards; see `core/execution/spear.ts`.
    handlerId: 'necromancer.distress'
  }
});
