/**
 * Owns Core Ranger pet skill fragments for the Jacaranda family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

// The pet's own projectile lands first. The vine then pulses four more times; each pulse snaps to the action grid
// independently so the strike and both conditions stay aligned without accumulating rounding drift.
const EMBRACE_STRIKE_MS = 920;
const EMBRACE_VINE_PULSE_TIMES_MS = [1520, 3000, 4520, 6000];
// The storm's first impact follows its windup; later pulses retain that delay and stop with the casting pet.
const CALL_LIGHTNING_PULSE_TIMES_MS = [1760, 2760, 3760, 4760, 5760];
// Calibrated so both condition Druid presets reproduce the 158 damage every logged vine hit deals in their logs.
const EMBRACE_VINE_COEFFICIENT = 0.0845;

export const RANGER_CORE_JACARANDA_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.JACARANDA_PHOTOSYNTHESIZE]: {
    petSkill: true,
    castTimeMs: 750,
    quicknessCastTimeMs: 500,
    // Regeneration belongs to the casting companion, while healing and cleansing remain outside combat scope.
    effects: [
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        duration: 5,
        stacks: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        audience: { recipients: RECIPIENT.SELF }
      }
    ]
  },
  [ID.JACARANDAS_EMBRACE]: {
    petSkill: true,
    // The pet's unquickened animation lasts 1.48 s; treating that measurement as Quickness inflated its lane occupancy.
    castTimeMs: 1480,
    quicknessCastTimeMs: 1480,
    // EVTC splits Embrace by owner. The first proc is the pet's projectile: its strike, Vulnerability and 1 s
    // Immobile all belong to the pet, so it can crit and trigger the pet's Sharpened Edges, and Ranger control traits
    // such as Blood Moon ignore it. The four vine procs belong to the Ranger: each strike never crits, and each
    // Immobile triggers Blood Moon. Vine procs use Ranger stats and survive pet swap.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [{ atMs: EMBRACE_STRIKE_MS, coefficient: 0.16 }],
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        ticks: [
          { atMs: EMBRACE_STRIKE_MS, condition: CONDITION.VULNERABILITY, stacks: 1, duration: 8 },
          { atMs: EMBRACE_STRIKE_MS, condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 1 }
        ],
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'strike',
        ticks: EMBRACE_VINE_PULSE_TIMES_MS.map((atMs) => ({ atMs, coefficient: EMBRACE_VINE_COEFFICIENT })),
        canCrit: false,
        source: 'ranger-pet',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: EMBRACE_VINE_PULSE_TIMES_MS.flatMap((atMs) => [
          { atMs, condition: CONDITION.VULNERABILITY, stacks: 1, duration: 8 },
          { atMs, condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 2 }
        ]),
        source: 'ranger-pet',
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.JACARANDA_ROOT_SLAP]: {
    petSkill: true,
    quicknessCastTimeMs: 800,
    effects: [
      {
        type: 'strike',
        // The root connects before the pet's recovery ends, allowing the last pre-swap attack to land.
        ticks: [{ atMs: 920, coefficient: 0.4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.JACARANDA_CALL_LIGHTNING]: {
    petSkill: true,
    quicknessCastTimeMs: 500,
    // The autonomous storm survives attack interruption, but its remaining pulses still end on pet swap.
    interruptCommitMs: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: CALL_LIGHTNING_PULSE_TIMES_MS.map((atMs) => ({
          atMs,
          coefficient: 0.5
        })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        ticks: CALL_LIGHTNING_PULSE_TIMES_MS.map((atMs) => ({
          atMs,
          condition: CONDITION.VULNERABILITY,
          stacks: 1,
          duration: 6
        })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }
});
