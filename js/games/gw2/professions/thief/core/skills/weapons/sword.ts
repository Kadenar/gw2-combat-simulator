import { ACTOR, WEAPON, CONTROL, BOON, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.LARCENOUS_STRIKE]: {
    // Apply the intrinsic factor to the current packet, retaining coefficient patch semantics.
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, _cast, effects) =>
          effects.map((effect) =>
            effect.type !== 'strike'
              ? effect
              : effect.ticks?.length
                ? { ...effect, ticks: effect.ticks.map((tick) => ({ ...tick, coefficient: tick.coefficient * 1.2 })) }
                : { ...effect, coefficient: (effect.coefficient || 0) * 1.2 }
          )
      }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.LARCENOUS_STRIKE } }],
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.17 }],
        name: 'Larcenous Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: WEAPON.SWORD,
    requiredOffHand: WEAPON.DAGGER
  },
  [ID.SLICE]: {
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.85 }],
        name: 'Slice (thief skill)',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.INFILTRATORS_STRIKE]: {
    flipDuration: 15,
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.INFILTRATORS_RETURN } }],
    movementSkill: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 3,
    // The strike, immobilize, and independent Swiftness grant all resolve at cast completion.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: "Infiltrator's Strike",
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 3,
        stacks: 1
      }
    ])
  },
  [ID.FLANKING_STRIKE]: {
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.LARCENOUS_STRIKE, durationSec: 4 } }],
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Flanking Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: WEAPON.SWORD,
    requiredOffHand: WEAPON.DAGGER
  },
  [ID.SLASH]: {
    castTimeMs: 440,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.85 }],
        name: 'Slash (thief skill)',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.STAB]: {
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.05 }],
        name: 'Stab (thief sword skill)',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: WEAPON.SWORD,
    requiredOffHand: false
  },
  [ID.TACTICAL_STRIKE]: {
    castTimeMs: 360,
    cooldown: 1,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 2, hits: 1, name: 'Tactical Strike', actorType: ACTOR.PLAYER },
      { type: 'control', actorType: ACTOR.PLAYER, controlKind: CONTROL.DAZE },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 10, duration: 5, actorType: ACTOR.PLAYER }
    ]),
    requiredMainHand: WEAPON.SWORD,
    stealthAttack: true
  },
  [ID.CRIPPLING_STRIKE]: {
    castTimeMs: 520,
    cooldown: 0,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.55,
        hits: 1,
        name: 'Crippling Strike',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.INFILTRATORS_RETURN]: {
    // The return shadowsteps back, so shadowstep and movement rewards (Peitha, Fluid Strikes) apply.
    movementSkill: true,
    shadowstepSkill: true,
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.INFILTRATORS_RETURN } }],
    castTimeMs: 200,
    cooldown: 0,
    initiativeCost: 2,
    effects: []
  },
  [ID.FLAWLESS_EXECUTION]: {
    interruptMode: 'per-packet',
    castTimeMs: 1400,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 400, coefficient: 0.53 },
          { atMs: 560, coefficient: 0.53 },
          { atMs: 720, coefficient: 0.53 }
        ],
        name: 'Flawless Execution — Packet 1',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1240, coefficient: 1.6 }],
        name: 'Final Slash Damage',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          { atMs: 320, coefficient: 0.25 },
          { atMs: 440, coefficient: 0.25 },
          { atMs: 520, coefficient: 0.25 },
          { atMs: 640, coefficient: 0.25 },
          { atMs: 760, coefficient: 0.25 },
          { atMs: 840, coefficient: 0.25 }
        ],
        name: 'Projectile Damage',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    requiredMainHand: WEAPON.SWORD,
    requiredOffHand: WEAPON.PISTOL
  }
});
