/**
 * Owns Core Ranger pet skill fragments for the Jacaranda family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Snap each 1.5-second pulse independently so both conditions stay aligned without accumulating rounding drift.
const EMBRACE_PULSE_TIMES_MS = [0, 1520, 3000, 4520, 6000];

export const RANGER_CORE_JACARANDA_PET_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.JACARANDAS_EMBRACE]: {
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // EVTC records one projectile impact about 920 ms after each command, not one strike per control pulse.
        ticks: [{ atMs: 920, coefficient: 0.16 }],
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: EMBRACE_PULSE_TIMES_MS.map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 1,
          duration: 8
        })),
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: [1, 2, 2, 2, 2].map((duration, index) => ({
          atMs: EMBRACE_PULSE_TIMES_MS[index],
          condition: 'Immobilized',
          stacks: 1,
          duration
        })),
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ]),
    quicknessCastTimeMs: 1480,
    petSkill: true
  },
  [ID.JACARANDA_ROOT_SLAP]: {
    effects: [
      {
        type: 'strike',
        // The root connects before the pet's recovery ends, allowing the last pre-swap attack to land.
        ticks: [{ atMs: 920, coefficient: 0.4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 800,
    petSkill: true
  },
  [ID.JACARANDA_CALL_LIGHTNING]: {
    // The autonomous storm commits when launched, so swapping pets does not erase its remaining pulses.
    interruptCommitMs: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [0, 1000, 2000, 3000, 4000].map((atMs) => ({
          atMs,
          coefficient: 0.5
        })),
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: [0, 1000, 2000, 3000, 4000].map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 1,
          duration: 6
        })),
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ]),
    quicknessCastTimeMs: 500,
    petSkill: true
  }
});
