import { COMBO_FINISHER, ACTOR, CONTROL, BOON, CONDITION } from '#gw2/platform/constants.js';
/**
 * Owns Amalgam offensive and defensive protocol skill fragments across mechanic slots.
 * Evolved-state actions and persistent morph behavior live in their named owners.
 */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { AmalgamSkill } from '#gw2/professions/engineer/specializations/amalgam/types.js';

const DEMOLISH_CAST_TIME_MS = 1000 + 560;
const DEMOLISH_RECHARGE_OFFSET_MS = 1000;
// EVTC splits Demolish into a one-second spin and a 560 ms smash; fixed packet
// timestamps preserve the observed animation hits under Quickness.
const DEMOLISH_SPIN_TICKS = Object.freeze([
  { atMs: 360, coefficient: 0.9 },
  { atMs: 640, coefficient: 0.9 },
  { atMs: 920, coefficient: 0.9 }
]);
const DEMOLISH_SMASH_AT_MS = 1440;

// Declare each protocol once; its three catalog entries differ only in mechanic slot.
const shred: Partial<AmalgamSkill> = {
  countsAsToolbeltSkill: true,
  cooldown: 20,
  castTimeMs: 760,
  comboFinishers: [
    {
      ownerId: 'engineer',
      finisherType: COMBO_FINISHER.PROJECTILE
    }
  ],
  effects: [
    {
      type: 'strike',
      ticks: [
        { atMs: 640, coefficient: 0.96 },
        { atMs: 680, coefficient: 0.96 },
        { atMs: 720, coefficient: 0.96 }
      ],
      timingAnchor: 'castStart',
      timingScale: 'cast',
      name: 'Offensive Protocol: Shred',
      // Each disk is a missile hit and can trigger Aim-Assisted Rocket.
      projectile: true,
      actorType: ACTOR.PLAYER
    },
    {
      type: 'condition',
      condition: CONDITION.IMMOBILIZED,
      stacks: 1,
      duration: 3,
      actorType: ACTOR.PLAYER
    }
  ],
  // This protocol's strain is consumed by Evolve or Silver Lining, never emitted unconditionally.
  sideEffects: [
    {
      on: 'castCommit',
      do: {
        type: 'engineer.morph',
        id: 'strain',
        effects: [
          {
            type: 'boon',
            boon: 'Quickness',
            duration: 8,
            sourceId: 'engineer.predator-strain',
            name: 'Predator Strain'
          },
          {
            type: 'buff',
            kind: 'superspeed',
            duration: 8,
            sourceId: 'engineer.predator-strain',
            name: 'Predator Strain'
          }
        ]
      }
    }
  ]
};

const thorns: Partial<AmalgamSkill> = {
  // The intrinsic field-gated retaliation is scheduled once; Morph trait rewards remain shared.
  maximumStacks: 6,
  retaliationInterval: 1,
  countsAsToolbeltSkill: true,
  cooldown: 20,
  // Custom: Activates the selected morph, strain, and form-specific effects; see `amalgam/mechanics/evolved-form.ts`.

  castTimeMs: 0,
  effects: [
    {
      type: 'strike',
      coefficient: 1,
      hits: 1,
      name: 'Initial Damage',
      actorType: ACTOR.PLAYER
    }
  ],
  // Retaliation and strain grants are independent components of the accepted Thorns protocol.
  sideEffects: [
    {
      on: 'castCommit',
      do: {
        type: 'engineer.thorns-retaliation',
        id: 'retaliation',
        effects: [{ name: 'Amalgam Morphs', type: 'strike', coefficient: 0.5, hits: 1 }]
      }
    },
    {
      on: 'castCommit',
      do: {
        type: 'engineer.morph',
        id: 'strain',
        effects: [{ name: 'Rapacious Strain', type: 'strike', coefficient: 0.3, hits: 1 }]
      }
    }
  ]
};

const demolish: Partial<AmalgamSkill> = {
  countsAsToolbeltSkill: true,
  cooldown: 20,
  rechargeAnchor: 'castStart',
  rechargeOffsetMs: DEMOLISH_RECHARGE_OFFSET_MS,
  castTimeMs: DEMOLISH_CAST_TIME_MS,
  // Commit after the smash so its remaining aftercast can be interrupted.
  interruptCommitMs: 1520,
  effects: [
    {
      type: 'strike',
      ticks: DEMOLISH_SPIN_TICKS,
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      name: 'Offensive Protocol: Demolish — Packet 1',
      actorType: ACTOR.PLAYER,
      comboFinishers: [
        {
          ownerId: 'engineer',
          finisherType: COMBO_FINISHER.WHIRL
        }
      ]
    },
    {
      type: 'strike',
      ticks: [{ atMs: DEMOLISH_SMASH_AT_MS, coefficient: 2.25 }],
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      name: 'Smash Damage',
      actorType: ACTOR.PLAYER,
      comboFinishers: [
        {
          ownerId: 'engineer',
          finisherType: COMBO_FINISHER.BLAST
        }
      ]
    }
  ],
  // This protocol's strain is consumed by Evolve or Silver Lining, never emitted unconditionally.
  sideEffects: [
    {
      on: 'castCommit',
      do: {
        type: 'engineer.morph',
        id: 'strain',
        effects: [
          {
            type: 'boon',
            boon: 'Stability',
            duration: 8,
            stacks: 5,
            sourceId: 'engineer.berserker-strain',
            name: 'Berserker Strain'
          }
        ]
      }
    }
  ]
};

const obliterate: Partial<AmalgamSkill> = {
  countsAsToolbeltSkill: true,
  cooldown: 20,
  castTimeMs: 800,
  // Share one impact timing while preserving independent payloads and declaration order.
  effects: impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'fixed' }, [
    {
      type: 'strike',
      coefficient: 2.88,
      hits: 1,
      name: 'Offensive Protocol: Obliterate',
      actorType: ACTOR.PLAYER
    },
    {
      type: 'condition',
      condition: CONDITION.BLEEDING,
      stacks: 8,
      duration: 6,
      actorType: ACTOR.PLAYER
    }
  ]),
  // This protocol's strain is consumed by Evolve or Silver Lining, never emitted unconditionally.
  sideEffects: [
    {
      on: 'castCommit',
      do: {
        type: 'engineer.morph',
        id: 'strain',
        effects: [
          {
            type: 'boon',
            boon: 'Might',
            duration: 8,
            stacks: 10,
            sourceId: 'engineer.titanic-strain',
            name: 'Titanic Strain'
          }
        ]
      }
    }
  ]
};

const cleanse: Partial<AmalgamSkill> = {
  countsAsToolbeltSkill: true,
  cooldown: 20,
  castTimeMs: 0,
  effects: [
    {
      type: 'boon',
      boon: BOON.PROTECTION,
      duration: 3,
      stacks: 1
    }
  ],
  // This protocol's strain is consumed by Evolve or Silver Lining, never emitted unconditionally.
  sideEffects: [
    {
      on: 'castCommit',
      do: {
        type: 'engineer.morph',
        id: 'strain',
        effects: [
          {
            type: 'boon',
            boon: 'Alacrity',
            duration: 8,
            sourceId: 'engineer.replicating-strain',
            name: 'Replicating Strain'
          }
        ]
      }
    }
  ]
};

const pierce: Partial<AmalgamSkill> = {
  countsAsToolbeltSkill: true,
  cooldown: 20,
  castTimeMs: 680,
  effects: [
    {
      type: 'strike',
      coefficient: 2.88,
      hits: 1,
      name: 'Offensive Protocol: Pierce',
      actorType: ACTOR.PLAYER
    },
    {
      type: 'condition',
      condition: CONDITION.VULNERABILITY,
      stacks: 8,
      duration: 8,
      actorType: ACTOR.PLAYER
    },
    {
      type: 'control',
      actorType: ACTOR.PLAYER,
      controlKind: CONTROL.STUN
    }
  ],
  // This protocol's strain is consumed by Evolve or Silver Lining, never emitted unconditionally.
  sideEffects: [
    {
      on: 'castCommit',
      do: {
        type: 'engineer.morph',
        id: 'strain',
        effects: [
          { type: 'control', controlKind: 'stun', sourceId: 'engineer.volatile-strain', name: 'Volatile Strain' }
        ]
      }
    }
  ]
};

const protect: Partial<AmalgamSkill> = {
  countsAsToolbeltSkill: true,
  cooldown: 20,
  castTimeMs: 1000,
  effects: [],
  // This protocol's strain is consumed by Evolve or Silver Lining, never emitted unconditionally.
  sideEffects: [
    {
      on: 'castCommit',
      do: {
        type: 'engineer.morph',
        id: 'strain',
        effects: [
          {
            type: 'boon',
            boon: 'Resistance',
            duration: 8,
            sourceId: 'engineer.resiliant-strain',
            name: 'Resiliant Strain'
          }
        ]
      }
    }
  ]
};

/** Slot variants dispatch the same strain; only its canonical skill exposes the shared payload for patching. */
function withoutStrainPayload(skill: Partial<AmalgamSkill>): Partial<AmalgamSkill> {
  return {
    ...skill,
    sideEffects: skill.sideEffects?.map((rule) =>
      'id' in rule.do && rule.do.id === 'strain' ? { ...rule, do: { type: 'engineer.morph' } } : rule
    )
  };
}

export const AMALGAM_PROTOCOL_SKILL_MECHANICS: Readonly<Record<string, Partial<AmalgamSkill>>> = Object.freeze({
  [ID.OFFENSIVE_PROTOCOL_SHRED_ID_77103]: { ...shred, mechanicSlot: 2 },
  [ID.OFFENSIVE_PROTOCOL_SHRED_ID_76866]: { ...shred, mechanicSlot: 3 },
  [ID.OFFENSIVE_PROTOCOL_SHRED]: { ...shred, mechanicSlot: 4 },
  [ID.DEFENSIVE_PROTOCOL_THORNS_ID_77163]: { ...withoutStrainPayload(thorns), mechanicSlot: 2 },
  [ID.DEFENSIVE_PROTOCOL_THORNS_ID_77104]: { ...withoutStrainPayload(thorns), mechanicSlot: 3 },
  [ID.DEFENSIVE_PROTOCOL_THORNS]: { ...thorns, rapaciousDuration: 8, rapaciousInternalCooldown: 0.48, mechanicSlot: 4 },
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76927]: { ...demolish, mechanicSlot: 2 },
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH]: { ...demolish, mechanicSlot: 3 },
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76954]: { ...demolish, mechanicSlot: 4 },
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76806]: { ...withoutStrainPayload(obliterate), mechanicSlot: 2 },
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76901]: { ...withoutStrainPayload(obliterate), mechanicSlot: 3 },
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE]: { ...obliterate, titanicAttributePerStack: 5, mechanicSlot: 4 },
  [ID.DEFENSIVE_PROTOCOL_CLEANSE_ID_76798]: { ...cleanse, mechanicSlot: 2 },
  [ID.DEFENSIVE_PROTOCOL_CLEANSE_ID_77285]: { ...cleanse, mechanicSlot: 3 },
  [ID.DEFENSIVE_PROTOCOL_CLEANSE]: { ...cleanse, mechanicSlot: 4 },
  [ID.OFFENSIVE_PROTOCOL_PIERCE]: { ...pierce, mechanicSlot: 2 },
  [ID.OFFENSIVE_PROTOCOL_PIERCE_ID_77005]: { ...pierce, mechanicSlot: 3 },
  [ID.OFFENSIVE_PROTOCOL_PIERCE_ID_77015]: { ...pierce, mechanicSlot: 4 },
  [ID.DEFENSIVE_PROTOCOL_PROTECT]: { ...protect, mechanicSlot: 2 },
  [ID.DEFENSIVE_PROTOCOL_PROTECT_ID_77203]: { ...protect, mechanicSlot: 3 },
  [ID.DEFENSIVE_PROTOCOL_PROTECT_ID_77358]: { ...protect, mechanicSlot: 4 }
});
