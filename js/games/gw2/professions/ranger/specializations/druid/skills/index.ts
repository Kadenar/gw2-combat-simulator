/** Explicit PvE skill mechanics owned by the Druid Ranger module. */
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

// Native and Eclipse effects share the impact, independently of the Avatar animation ending.
export const SEED_OF_LIFE_DETONATION_MS = 720;

export const LUNAR_IMPACT_HIT_MS = 560;

export const DRUID_BASE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.GLYPH_OF_REJUVENATION]: {
    castTimeMs: 333,
    effects: []
  },
  [ID.RELEASE_CELESTIAL_AVATAR]: {
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    castTimeMs: 0,
    effects: [],
    // Use the common form lifecycle for manual entry/release and resource depletion.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.avatar-release' } }]
  },
  [ID.GLYPH_OF_THE_STARS]: {
    castTimeMs: 667,
    effects: []
  },
  [ID.CELESTIAL_AVATAR]: {
    // The form owns its maximum window; its resource clock derives depletion from this duration.
    duration: 15,
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    castTimeMs: 0,
    effects: [],
    // Use the common form lifecycle for manual entry/release and resource depletion.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.avatar-enter' } }]
  },
  [ID.COSMIC_RAY]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 520,
    effects: []
    // Custom: Applies Celestial Avatar skill traits after the cast; see `druid/module.ts`.
  },
  [ID.SEED_OF_LIFE]: {
    cooldown: 4,
    castTimeMs: 0,
    canCastConcurrently: true,
    // The planted seed detonates later, including after the player releases Celestial Avatar.
    effects: impactEffects({ atMs: SEED_OF_LIFE_DETONATION_MS, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 4
      }
    ])
    // Custom: Applies Celestial Avatar skill traits after the cast; see `druid/module.ts`.
  },
  [ID.LUNAR_IMPACT]: {
    cooldown: 8,
    // Match the measured Quickness animation from the condition Druid EVTC.
    castTimeMs: 920,
    // The impact commits before the remaining animation, so cancelling the aftercast retains its effects.
    interruptCommitMs: LUNAR_IMPACT_HIT_MS,
    effects: impactEffects({ atMs: LUNAR_IMPACT_HIT_MS, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'control',
        controlKind: CONTROL.DAZE,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      }
    ])
    // Custom: Applies Celestial Avatar skill traits after the cast; see `druid/module.ts`.
  },
  [ID.REJUVENATING_TIDES]: {
    castTimeMs: 480,
    // A committed cast keeps its delayed pulses and remaining animation lockout after interruption.
    interruptCommitMs: 440,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 10,
        stacks: 1,
        applications: 5,
        atMs: 960,
        intervalMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]
    // Custom: Applies Celestial Avatar skill traits after the cast; see `druid/module.ts`.
  },
  [ID.NATURAL_CONVERGENCE]: {
    cooldown: 10,
    castTimeMs: 2080,
    // Channel impacts resolve as they occur; only the final impact releases the persistent Black Hole.
    interruptCommitMs: 520,
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        weaponStrengthProfileId: 'transform.celestial-avatar',
        type: 'strike',
        ticks: [520, 1160, 1640].map((atMs) => ({
          atMs,
          coefficient: 0.75
        }))
      },
      {
        weaponStrengthProfileId: 'transform.celestial-avatar',
        type: 'strike',
        ticks: [{ atMs: 2040, coefficient: 2 }]
      },
      {
        type: 'condition',
        ticks: [520, 1160, 1640, 2040].flatMap((atMs) => [
          {
            atMs,
            condition: CONDITION.CRIPPLED,
            stacks: 1,
            duration: 1
          },
          { atMs, condition: CONDITION.SLOW, stacks: 1, duration: 1 }
        ])
      },
      {
        weaponStrengthProfileId: 'transform.celestial-avatar',
        type: 'strike',
        name: 'Black Hole',
        // This child effect has no catalog entry, so carry its dedicated icon into damage breakdown rows.
        icon: new URL('@images/wiki/black-hole.png', import.meta.url).href,
        sourceId: ID.BLACK_HOLE,
        interruptCommitMs: 2040,
        persistsAfterInterrupt: true,
        skillName: 'Black Hole',
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        canCrit: false,
        ticks: [2640, 4160, 5680, 7200].map((atMs) => ({
          atMs,
          coefficient: 0,
          flatDamage: 158,
          canCrit: false
        }))
      },
      {
        // Each Black Hole pulse immobilizes once; there is no additional pull to trigger Blood Moon.
        type: 'condition',
        name: 'Black Hole',
        sourceId: ID.BLACK_HOLE,
        interruptCommitMs: 2040,
        persistsAfterInterrupt: true,
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        applications: 4,
        atMs: 2640,
        intervalMs: 1520,
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2,
        skillName: 'Black Hole'
      },
      ...[520, 1160, 1640, 2040].map((atMs) => ({
        type: 'boon' as const,
        boon: BOON.MIGHT,
        duration: 10,
        stacks: 1,
        atMs,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }))
    ])
    // Custom: Applies Celestial Avatar skill traits after the cast; see `druid/module.ts`.
  }
});
