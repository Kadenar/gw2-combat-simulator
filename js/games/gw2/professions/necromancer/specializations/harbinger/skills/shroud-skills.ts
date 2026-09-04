/**
 * Owns Harbinger Shroud entry, exit, and weapon skill fragments.
 * Persistent Blight and shroud state remain under `mechanics/`.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { HARBINGER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Supplies Harbinger Shroud fragments to specialization composition. */
export const HARBINGER_SHROUD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.VORACIOUS_ARC]: {
    quicknessCastTimeMs: 840,
    blightCost: 5,
    effects: [{ type: 'strike', coefficient: 1.4, hits: 1 }],
    type: 'Profession',
    slot: 'Weapon_4',
    shroud: 'harbinger',
    shroudSlot: 4,
    specialization: 'Harbinger',
    // Custom: Consumes live Blight to materialize the skill's scaled packets; see `harbinger/mechanics/blight.ts`.
    handlerId: 'necromancer.blight-skill'
  },
  [ID.EXIT_HARBINGER_SHROUD]: {
    castTimeMs: 0,
    effects: [],
    cooldown: 0,
    specialization: 'Harbinger',
    shroudExit: 'harbinger',
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/shroud.ts`.
    handlerId: 'necromancer.shroud'
  },
  [ID.VITAL_DRAW]: {
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
        controlKind: 'float',
        duration: 1
      }
    ],
    // Aggregate the three 3% siphons because the simulator assumes every strike connects.
    lifeForceGain: 9,
    type: 'Profession',
    slot: 'Weapon_5',
    shroud: 'harbinger',
    shroudSlot: 5,
    specialization: 'Harbinger'
  },
  [ID.HARBINGER_SHROUD]: {
    castTimeMs: 0,
    effects: [],
    cooldown: 10,
    specialization: 'Harbinger',
    shroudEntry: 'harbinger',
    shroudProfileId: PROFILE.resources,
    minimumShroudLifeForcePercent: 0,
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/shroud.ts`.
    handlerId: 'necromancer.shroud'
  },
  [ID.TAINTED_BOLTS]: {
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
          { atMs: 320, condition: 'Torment', stacks: 1, duration: 3 },
          { atMs: 600, condition: 'Torment', stacks: 1, duration: 3 }
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
    quicknessCastTimeMs: 920,
    // Dark Barrage is a channel: interruption keeps each landed volley while 800 ms remains the full-damage cutoff.
    interruptMode: 'per-packet',
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
    // Custom: Replaces the base hit with Doom Approaches' sequence; see `harbinger/execution/dark-barrage.ts`.
    handlerId: 'necromancer.dark-barrage'
  },
  [ID.DEVOURING_CUT]: {
    quicknessCastTimeMs: 480,
    // Devouring Cut lands at its 400 ms commit frame while retaining a 480 ms default cast.
    interruptCommitMs: 400,
    blightCost: 5,
    effects: [{ type: 'strike', coefficient: 1, hits: 1 }],
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'harbinger',
    shroudSlot: 3,
    specialization: 'Harbinger',
    // Custom: Consumes live Blight to materialize the skill's scaled packets; see `harbinger/mechanics/blight.ts`.
    handlerId: 'necromancer.blight-skill'
  }
});
