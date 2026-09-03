/**
 * Owns supplemental Core Mesmer fragments for flip and alternate skill identities.
 * Canonical weapon and slot-skill fragments live in their named catalog files.
 */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { SkillFragment, SkillId } from '#gw2/platform/engine/types.js';

export const MESMER_CORE_SUPPLEMENTAL_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze({
  [ID.POWER_SPIKE]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 10,
    ammo: 2,
    armedAtStart: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.33,
        hits: 1,
        name: 'Damage',
        actorType: 'player'
      },
      // Apply the live debuff with the instant strike so reconstructed Mantra casts update target state.
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 8,
        stacks: 5
      }
    ]
  },
  [ID.COUNTERSPELL]: {
    castTimeMs: 900,
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
    flipDuration: 2,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 322, coefficient: 0.1 }],
        name: 'Projectile',
        actorType: 'player',
        weapon: 'scepter',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        // Confusion lands with the committed projectile so a weapon-swap cancellation does not discard it.
        ticks: [{ atMs: 322, condition: 'Confusion', stacks: 5, duration: 7 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SWAP]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 0,
    flipDuration: 5,
    flipDelay: 0,
    effects: []
  },
  [ID.COUNTER_BLADE]: {
    castTimeMs: 1020,
    cooldown: 0,
    flipDuration: 3,
    flipDelay: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 484, coefficient: 0.1 }],
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.INTO_THE_VOID]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 0,
    flipDuration: 5,
    flipDelay: 1,
    effects: []
  },
  [ID.DIMENSIONAL_APERTURE]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 0,
    flipDuration: 3,
    flipDelay: 0,
    parentCooldownIncrease: 0.5,
    effects: []
  },
  [ID.ABSTRACTION]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 0,
    flipDuration: 2,
    flipDelay: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Detonation',
        actorType: 'player',
        weapon: 'rifle'
      }
    ]
  }
});
