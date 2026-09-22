/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.LARCENOUS_STRIKE]: {
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.17 }],
        name: 'Larcenous Strike',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Sword',
    requiredOffHand: 'Dagger'
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
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.INFILTRATORS_STRIKE]: {
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
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 3,
        stacks: 1
      }
    ])
  },
  [ID.FLANKING_STRIKE]: {
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Flanking Strike',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Sword',
    requiredOffHand: 'Dagger'
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
        actorType: 'player',
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
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Sword',
    requiredOffHand: false
  },
  [ID.TACTICAL_STRIKE]: {
    // Custom: Consumes stealth and applies Revealed after the attack; see `core/mechanics/stealth.ts`.
    handlerId: 'thief.stealth-attack',
    castTimeMs: 360,
    cooldown: 1,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 2, hits: 1, name: 'Tactical Strike', actorType: 'player' },
      { type: 'control', actorType: 'player', controlKind: 'daze' },
      { type: 'condition', condition: 'Vulnerability', stacks: 10, duration: 5, actorType: 'player' }
    ]),
    requiredMainHand: 'Sword',
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
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ])
  },
  [ID.INFILTRATORS_RETURN]: {
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
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1240, coefficient: 1.6 }],
        name: 'Final Slash Damage',
        actorType: 'player',
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
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    requiredMainHand: 'Sword',
    requiredOffHand: 'Pistol'
  }
});
