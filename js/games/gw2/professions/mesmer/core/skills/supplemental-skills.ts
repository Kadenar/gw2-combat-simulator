/**
 * Owns supplemental Core Mesmer fragments for flip and alternate skill identities.
 * Canonical weapon and slot-skill fragments live in their named catalog files.
 */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment, SkillId } from '#gw2/platform/engine/skills/types.js';

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
    flipDuration: 2,
    // Blind and Confusion land with the projectile, including after committed animation cancellation.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'blind',
        duration: 5,
        source: 'Player',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0.1,
        hits: 1,
        name: 'Projectile',
        actorType: 'player',
        weapon: 'scepter'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 5,
        duration: 7
      }
    ])
  },
  [ID.SWAP]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 0,
    flipDuration: 5,
    flipDelay: 0,
    comboFinishers: [
      {
        ownerId: 'mesmer',
        finisherType: 'Leap',
        fieldSelectionAnchor: 'castStart',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: []
  },
  [ID.COUNTER_BLADE]: {
    castTimeMs: 680,
    cooldown: 0,
    flipDuration: 3,
    flipDelay: 0,
    effects: [
      // Preserve the flip's existing control timing at cast completion.
      {
        type: 'control',
        source: 'Player',
        actorType: 'player',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.1 }],
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
    // Activating the flip applies its pull immediately.
    effects: [
      { type: 'control', source: 'Player', actorType: 'player', atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }
    ]
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
    // Early detonation replaces the image's boons with an offensive blast of its own field.
    effects: [
      {
        type: 'strike',
        coefficient: 1.81,
        hits: 1,
        name: 'Detonation',
        actorType: 'player',
        weapon: 'rifle'
      },
      { type: 'condition', condition: 'Weakness', stacks: 1, duration: 5 },
      { type: 'condition', condition: 'Blinded', stacks: 1, duration: 5 }
    ]
  }
});
