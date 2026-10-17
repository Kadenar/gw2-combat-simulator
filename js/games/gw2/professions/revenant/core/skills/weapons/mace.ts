import { ACTOR, COMBO_FINISHER, COMBO_FIELD, BOON, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';

export const REVENANT_WEAPONS_MACE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.MANIFEST_TOXIN]: {
    castTimeMs: 560,
    interruptCommitMs: 440,
    cooldown: 0,
    energyCost: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.6,
          hits: 1,
          name: 'Manifest Toxin — Packet 1',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 12,
          actorType: ACTOR.PLAYER
        }
      ]
    )
  },
  [ID.ANGUISH_SWIPE]: {
    castTimeMs: 360,
    interruptCommitMs: 320,
    cooldown: 0,
    energyCost: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.4,
          hits: 1,
          name: 'Anguish Swipe',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          stacks: 1,
          duration: 3,
          actorType: ACTOR.PLAYER
        }
      ]
    )
  },
  [ID.MISERY_SWIPE]: {
    castTimeMs: 440,
    interruptCommitMs: 280,
    cooldown: 0,
    energyCost: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.35,
          hits: 1,
          name: 'Misery Swipe',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          stacks: 1,
          duration: 3,
          actorType: ACTOR.PLAYER
        }
      ]
    )
  },
  [ID.ECHOING_ERUPTION]: {
    castTimeMs: 960,
    cooldown: 8,
    ammo: 0,
    ammoRecharge: 0,
    energyCost: 5,
    comboFinishers: [
      {
        ownerId: 'revenant',
        finisherType: COMBO_FINISHER.BLAST,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Echoing Eruption',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 4,
        duration: 5,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 9,
        stacks: 3
      }
    ])
  },
  [ID.SEARING_FISSURE]: {
    castTimeMs: 600,
    interruptCommitMs: 480,
    cooldown: 3,
    energyCost: 5,
    comboFields: [
      {
        ownerId: 'revenant',
        fieldType: COMBO_FIELD.FIRE,
        duration: 3,
        startAnchor: 'castEnd'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.5 }],
        name: 'Initial Strike',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'strike',
        ticks: Array.from({ length: 3 }, (_, index) => ({ atMs: 1480 + index * 1000, coefficient: 0.75 / 3 })),
        name: 'Pulsing Strikes',
        actorType: ACTOR.PLAYER,
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [{ atMs: 480, condition: CONDITION.BURNING, stacks: 3, duration: 3 }],
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 3 }, (_, index) => ({
          atMs: 1480 + index * 1000,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 1
        })),
        actorType: ACTOR.PLAYER
      }
    ])
  }
});
