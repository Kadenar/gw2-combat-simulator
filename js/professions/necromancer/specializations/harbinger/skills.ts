/**
 * Harbinger skill mechanics owned by the Harbinger Necromancer module.
 *
 * The root catalog composes this inert fragment with the other active module
 * fragments. Weapon skills remain Core-owned because Weaponmaster Training
 * makes elite weapon families profession-wide.
 */
import { NECROMANCER_SKILL_IDS as ID } from '../../data/ids.js';
import type { SkillFragment } from '../../../../platform/engine/types.js';
import { HARBINGER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

export const HARBINGER_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ELIXIR_OF_BLISS]: {
    implemented: true,
    castTimeMs: 500,
    blightCost: 5,
    blightGain: 10,
    effects: [{ type: 'strike', coefficient: 0.8, hits: 1 }],
    handlerId: 'necromancer.elixir'
  },
  [ID.ELIXIR_OF_RISK]: {
    implemented: true,
    // Risk occupies the same 680 ms Quickness cast lane as the other thrown Harbinger elixirs.
    quicknessCastTimeMs: 680,
    blightCost: 5,
    blightGain: 10,
    effects: [
      { type: 'strike', coefficient: 2, hits: 1 },
      { type: 'condition', condition: 'Torment', stacks: 3, duration: 5 },
      { type: 'condition', condition: 'Weakness', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'might', stacks: 10, duration: 10 },
      { type: 'boon', boon: 'fury', stacks: 1, duration: 10 }
    ],
    cooldown: 20,
    handlerId: 'necromancer.elixir'
  },
  [ID.VORACIOUS_ARC]: {
    implemented: true,
    quicknessCastTimeMs: 840,
    blightCost: 5,
    effects: [{ type: 'strike', coefficient: 1.4, hits: 1 }],
    type: 'Profession',
    slot: 'Weapon_4',
    shroud: 'harbinger',
    shroudSlot: 4,
    specialization: 'Harbinger',
    handlerId: 'necromancer.blight-skill'
  },
  [ID.EXIT_HARBINGER_SHROUD]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    cooldown: 0,
    specialization: 'Harbinger',
    shroudExit: 'harbinger',
    handlerId: 'necromancer.shroud'
  },
  [ID.VITAL_DRAW]: {
    implemented: true,
    quicknessCastTimeMs: 800,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 760, coefficient: 0.4 },
          { atMs: 1760, coefficient: 0.4 },
          { atMs: 2760, coefficient: 0.4 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        applications: 3,
        atMs: 760,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'float',
          duration: 1
        }
      }
    ],
    lifeForceGain: 3,
    type: 'Profession',
    slot: 'Weapon_5',
    shroud: 'harbinger',
    shroudSlot: 5,
    specialization: 'Harbinger'
  },
  [ID.HARBINGER_SHROUD]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    cooldown: 10,
    specialization: 'Harbinger',
    shroudEntry: 'harbinger',
    shroudProfileId: PROFILE.resources,
    minimumShroudLifeForcePercent: 0,
    handlerId: 'necromancer.shroud'
  },
  [ID.TAINTED_BOLTS]: {
    implemented: true,
    dhuumfireDuration: 1,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 320, coefficient: 0.6 },
          { atMs: 600, coefficient: 0.6 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 320,
            condition: 'Torment',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 600,
            condition: 'Torment',
            stacks: 1,
            duration: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'harbinger',
    shroudSlot: 1,
    specialization: 'Harbinger'
  },
  [ID.DARK_BARRAGE]: {
    implemented: true,
    quicknessCastTimeMs: 920,
    // All six strike and Torment packets resolve by 800 ms, so interrupting the remaining aftercast keeps them.
    interruptCommitMs: 800,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 600, coefficient: 0.6 },
          { atMs: 680, coefficient: 0.6 },
          { atMs: 680, coefficient: 0.6 },
          { atMs: 800, coefficient: 0.6 },
          { atMs: 800, coefficient: 0.6 },
          { atMs: 800, coefficient: 0.6 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 600, condition: 'Torment', stacks: 1, duration: 3 },
          { atMs: 680, condition: 'Torment', stacks: 1, duration: 3 },
          { atMs: 680, condition: 'Torment', stacks: 1, duration: 3 },
          { atMs: 800, condition: 'Torment', stacks: 1, duration: 3 },
          { atMs: 800, condition: 'Torment', stacks: 1, duration: 3 },
          { atMs: 800, condition: 'Torment', stacks: 1, duration: 3 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'harbinger',
    shroudSlot: 2,
    specialization: 'Harbinger',
    handlerId: 'necromancer.dark-barrage'
  },
  [ID.ELIXIR_OF_IGNORANCE]: {
    implemented: true,
    castTimeMs: 500,
    blightCost: 5,
    blightGain: 10,
    effects: [
      { type: 'strike', coefficient: 0.8, hits: 1 },
      { type: 'blind', metadata: { duration: 0 } }
    ],
    handlerId: 'necromancer.elixir'
  },
  [ID.ELIXIR_OF_AMBITION]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    blightCost: 10,
    blightGain: 15,
    effects: [
      { type: 'strike', coefficient: 1.5, hits: 1 },
      ...['Bleeding', 'Burning', 'Confusion', 'Poisoned', 'Torment'].map((condition) => ({
        type: 'condition' as const,
        condition,
        stacks: 3,
        duration: 5
      })),
      { type: 'boon', boon: 'might', stacks: 25, duration: 5 },
      { type: 'boon', boon: 'fury', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'quickness', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'alacrity', stacks: 1, duration: 5 }
    ],
    handlerId: 'necromancer.elixir'
  },
  [ID.ELIXIR_OF_ANGUISH]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    blightCost: 5,
    blightGain: 10,
    effects: [
      { type: 'strike', coefficient: 1, hits: 1 },
      // Anguish pairs enemy control with mobility; its empowered profile doubles these durations.
      { type: 'condition', condition: 'Crippled', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'quickness', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'swiftness', stacks: 1, duration: 10 }
    ],
    handlerId: 'necromancer.elixir'
  },
  [ID.ELIXIR_OF_PROMISE]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    blightCost: 5,
    blightGain: 10,
    effects: [
      { type: 'strike', coefficient: 0.8, hits: 1 },
      { type: 'condition', condition: 'Poisoned', stacks: 3, duration: 5 }
    ],
    handlerId: 'necromancer.elixir'
  },
  [ID.DEVOURING_CUT]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    blightCost: 5,
    effects: [{ type: 'strike', coefficient: 1, hits: 1 }],
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'harbinger',
    shroudSlot: 3,
    specialization: 'Harbinger',
    handlerId: 'necromancer.blight-skill'
  }
});
