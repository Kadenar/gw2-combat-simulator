import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { WEAPON, ACTOR, CONDITION } from '#gw2/platform/constants.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerResourceDefinition } from '#gw2/professions/mesmer/family-state.js';
import type { MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/core/profiles.js';

/** Sample the clone cap at the landed hit; blades and imagery still gain their own resource. */
function atCloneLimit(runtime: MechanicQueryContext<MesmerRuntimeState>): boolean {
  const definition = mesmerResourceDefinition(runtime.profession.specialization.kind, runtime);
  return definition.singular === 'clone' && runtime.profession.core.clones.length >= definition.maximum;
}

export const MESMER_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, Partial<MesmerSkill>>> = Object.freeze({
  // Flip actions share their parent's catalog so ordinary mechanics assembly owns both faces.
  [ID.COUNTERSPELL]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.COUNTERSPELL } }],
    castTimeMs: 600,
    // The projectile and clone commit on the 360 ms Quickness frame, but weapon-swap cancellation retains the full cast lane.
    interruptCommitMs: 360,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 0,
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castStart',
      atMs: 360
    },
    // Blind and Confusion land with the projectile, including after committed animation cancellation.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5,
        source: 'Player',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'strike',
        coefficient: 0.1,
        hits: 1,
        name: 'Projectile',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SCEPTER.toLowerCase()
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 5,
        duration: 7
      }
    ])
  },
  [ID.CONFUSING_IMAGES]: {
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 920, coefficient: 0.76 },
          { atMs: 1080, coefficient: 0.76 },
          { atMs: 1200, coefficient: 0.76 },
          { atMs: 1440, coefficient: 0.76 },
          { atMs: 1560, coefficient: 0.76 },
          { atMs: 1680, coefficient: 0.76 },
          { atMs: 1840, coefficient: 0.76 }
        ],
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SCEPTER.toLowerCase(),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        // Confusion applies once per channel pulse, independently of the strike packet cadence.
        ticks: [280, 560, 840, 1080, 1360, 1640, 1920].map((atMs) => ({
          atMs,
          condition: CONDITION.CONFUSION,
          duration: 7,
          stacks: 1
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    castTimeMs: 1920
  },
  [ID.ILLUSIONARY_COUNTER]: {
    // Flip lifetime follows its parent's authored clock, with delayed readiness kept separate.
    flipArm: { skillId: ID.COUNTERSPELL, duration: 2, delay: 0, anchor: 'castStart' },
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.arm-flip' } }],
    castTimeMs: 1200,
    effects: [],
    defaultInterruptMs: 120,
    interruptCommitMs: 80
  },
  [ID.ETHER_BOLT]: {
    nextChainId: ID.ETHER_BLAST,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 0.5 }],
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SCEPTER.toLowerCase(),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        duration: 4,
        stacks: 1
      }
    ],
    castTimeMs: 440
  },
  [ID.ETHER_BLAST]: {
    castTimeMs: 520,
    nextChainId: ID.ETHER_CLONE,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.5 }],
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SCEPTER.toLowerCase(),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.ETHER_CLONE]: {
    interruptCommitMs: 440,
    castTimeMs: 840,
    nextChainId: null,
    effects: [
      {
        type: 'strike',
        // Resolve the replacement before granting a resource so reaching the cap never grants both rewards.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (runtime, { event }) => Number(event.coefficient) > 0 && atCloneLimit(runtime),
            do: {
              type: 'emitProfile',
              profileId: PROFILE.etherClone,
              attribution: { source: 'Player', sourceId: ID.ETHER_CLONE, actorType: ACTOR.PLAYER, name: 'Ether Clone' }
            }
          },
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (runtime, { event }) => Number(event.coefficient) > 0 && !atCloneLimit(runtime),
            do: { type: 'mesmer.illusion-gain', amount: 1 }
          }
        ],
        ticks: [{ atMs: 440, coefficient: 0.75 }],
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SCEPTER.toLowerCase(),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
