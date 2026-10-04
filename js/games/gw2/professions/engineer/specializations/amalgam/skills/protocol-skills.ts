/**
 * Owns Amalgam offensive and defensive protocol skill fragments across mechanic slots.
 * Evolved-state actions and persistent morph behavior live in their named owners.
 */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';

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

export type AmalgamMorphKind = 'cleanse' | 'protect' | 'thorns' | 'demolish' | 'obliterate' | 'pierce' | 'shred';

// Declare each protocol once; its three catalog entries differ only in mechanic slot.
const shred: Partial<Skill> = {
  countsAsToolbeltSkill: true,
  castTimeMs: 760,
  cooldown: 20,
  comboFinishers: [
    {
      ownerId: 'engineer',
      finisherType: 'Projectile',
      preferredFieldTypes: ['Fire'],
      ambiguousFieldSelection: 'oldest'
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
      actorType: 'player'
    },
    {
      type: 'condition',
      condition: 'Immobilized',
      stacks: 1,
      duration: 3,
      actorType: 'player'
    }
  ]
};

const thorns: Partial<Skill> = {
  // The intrinsic field-gated retaliation is scheduled once; Morph trait rewards remain shared.
  sideEffects: [{ on: 'castCommit', do: { type: 'engineer.thorns-retaliation' } }],
  countsAsToolbeltSkill: true,
  // Custom: Activates the selected morph, strain, and form-specific effects; see `amalgam/mechanics/evolved-form.ts`.

  castTimeMs: 0,
  cooldown: 20,
  effects: [
    {
      type: 'strike',
      coefficient: 1,
      hits: 1,
      name: 'Initial Damage',
      actorType: 'player'
    }
  ]
};

const demolish: Partial<Skill> = {
  countsAsToolbeltSkill: true,
  castTimeMs: DEMOLISH_CAST_TIME_MS,
  // Commit after the smash so its remaining aftercast can be interrupted.
  interruptCommitMs: 1520,
  cooldown: 20,
  rechargeAnchor: 'castStart',
  rechargeOffsetMs: DEMOLISH_RECHARGE_OFFSET_MS,
  effects: [
    {
      type: 'strike',
      ticks: DEMOLISH_SPIN_TICKS,
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      name: 'Offensive Protocol: Demolish — Packet 1',
      actorType: 'player',
      comboFinishers: [
        {
          ownerId: 'engineer',
          finisherType: 'Whirl',
          ambiguousFieldSelection: 'oldest'
        }
      ]
    },
    {
      type: 'strike',
      ticks: [{ atMs: DEMOLISH_SMASH_AT_MS, coefficient: 2.25 }],
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      name: 'Smash Damage',
      actorType: 'player',
      comboFinishers: [
        {
          ownerId: 'engineer',
          finisherType: 'Blast',
          ambiguousFieldSelection: 'oldest'
        }
      ]
    }
  ]
};

const obliterate: Partial<Skill> = {
  countsAsToolbeltSkill: true,
  castTimeMs: 800,
  cooldown: 20,
  // Share one impact timing while preserving independent payloads and declaration order.
  effects: impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'fixed' }, [
    {
      type: 'strike',
      coefficient: 2.88,
      hits: 1,
      name: 'Offensive Protocol: Obliterate',
      actorType: 'player'
    },
    {
      type: 'condition',
      condition: 'Bleeding',
      stacks: 8,
      duration: 6,
      actorType: 'player'
    }
  ])
};

const cleanse: Partial<Skill> = {
  countsAsToolbeltSkill: true,
  castTimeMs: 0,
  cooldown: 20,
  effects: [
    {
      type: 'boon',
      boon: 'protection',
      duration: 3,
      stacks: 1
    }
  ]
};

const pierce: Partial<Skill> = {
  countsAsToolbeltSkill: true,
  castTimeMs: 680,
  cooldown: 20,
  effects: [
    {
      type: 'strike',
      coefficient: 2.88,
      hits: 1,
      name: 'Offensive Protocol: Pierce',
      actorType: 'player'
    },
    {
      type: 'condition',
      condition: 'Vulnerability',
      stacks: 8,
      duration: 8,
      actorType: 'player'
    },
    {
      type: 'control',
      actorType: 'player',
      controlKind: 'stun'
    }
  ]
};

const protect: Partial<Skill> = {
  countsAsToolbeltSkill: true,
  castTimeMs: 1000,
  cooldown: 20,
  effects: []
};

export const AMALGAM_PROTOCOL_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  [ID.OFFENSIVE_PROTOCOL_SHRED_ID_77103]: { ...shred, mechanicSlot: 2 },
  [ID.OFFENSIVE_PROTOCOL_SHRED_ID_76866]: { ...shred, mechanicSlot: 3 },
  [ID.OFFENSIVE_PROTOCOL_SHRED]: { ...shred, mechanicSlot: 4 },
  [ID.DEFENSIVE_PROTOCOL_THORNS_ID_77163]: { ...thorns, mechanicSlot: 2 },
  [ID.DEFENSIVE_PROTOCOL_THORNS_ID_77104]: { ...thorns, mechanicSlot: 3 },
  [ID.DEFENSIVE_PROTOCOL_THORNS]: { ...thorns, mechanicSlot: 4 },
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76927]: { ...demolish, mechanicSlot: 2 },
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH]: { ...demolish, mechanicSlot: 3 },
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76954]: { ...demolish, mechanicSlot: 4 },
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76806]: { ...obliterate, mechanicSlot: 2 },
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76901]: { ...obliterate, mechanicSlot: 3 },
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE]: { ...obliterate, mechanicSlot: 4 },
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

/** Maps each slot identity to its protocol for strain and trait observers. */
export const AMALGAM_MORPH_KIND_BY_SKILL_ID: ReadonlyMap<SkillId, AmalgamMorphKind> = new Map([
  [ID.OFFENSIVE_PROTOCOL_SHRED_ID_77103, 'shred'],
  [ID.OFFENSIVE_PROTOCOL_SHRED_ID_76866, 'shred'],
  [ID.OFFENSIVE_PROTOCOL_SHRED, 'shred'],
  [ID.DEFENSIVE_PROTOCOL_THORNS_ID_77163, 'thorns'],
  [ID.DEFENSIVE_PROTOCOL_THORNS_ID_77104, 'thorns'],
  [ID.DEFENSIVE_PROTOCOL_THORNS, 'thorns'],
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76927, 'demolish'],
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH, 'demolish'],
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76954, 'demolish'],
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76806, 'obliterate'],
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76901, 'obliterate'],
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE, 'obliterate'],
  [ID.DEFENSIVE_PROTOCOL_CLEANSE_ID_76798, 'cleanse'],
  [ID.DEFENSIVE_PROTOCOL_CLEANSE_ID_77285, 'cleanse'],
  [ID.DEFENSIVE_PROTOCOL_CLEANSE, 'cleanse'],
  [ID.OFFENSIVE_PROTOCOL_PIERCE, 'pierce'],
  [ID.OFFENSIVE_PROTOCOL_PIERCE_ID_77005, 'pierce'],
  [ID.OFFENSIVE_PROTOCOL_PIERCE_ID_77015, 'pierce'],
  [ID.DEFENSIVE_PROTOCOL_PROTECT, 'protect'],
  [ID.DEFENSIVE_PROTOCOL_PROTECT_ID_77203, 'protect'],
  [ID.DEFENSIVE_PROTOCOL_PROTECT_ID_77358, 'protect']
]);
