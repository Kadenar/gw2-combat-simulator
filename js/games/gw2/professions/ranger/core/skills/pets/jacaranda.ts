/**
 * Owns Core Ranger pet skill fragments for the Jacaranda family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Snap each 1.5-second pulse independently so both conditions stay aligned without accumulating rounding drift.
const EMBRACE_PULSE_TIMES_MS = [0, 1520, 3000, 4520, 6000];

export const RANGER_CORE_JACARANDA_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.JACARANDA_PHOTOSYNTHESIZE]: {
    // Regeneration belongs to the casting companion, while healing and cleansing remain outside combat scope.
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon',
        audience: { recipients: 'self' }
      }
    ],
    castTimeMs: 750,
    quicknessCastTimeMs: 500,
    petSkill: true
  },
  [ID.JACARANDAS_EMBRACE]: {
    // Embrace's vine pulses use Ranger stats and survive pet swap; its direct strike and opening immobilize are pet-owned.
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
        actorType: 'player'
      },
      {
        // The opening immobilize rides the pet's own strike: it is pet-owned, so Ranger control traits such as Blood
        // Moon ignore it. EVTC shows a 1 s pet-duration Immobile at the strike and no Blood Moon bleeding with it.
        type: 'condition',
        ticks: [{ atMs: 920, condition: 'Immobilized', stacks: 1, duration: 1 }],
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        // The four later vine pulses are Ranger-owned and each one triggers Ranger control traits.
        type: 'condition',
        ticks: EMBRACE_PULSE_TIMES_MS.slice(1).map((atMs) => ({
          atMs,
          condition: 'Immobilized',
          stacks: 1,
          duration: 2
        })),
        source: 'ranger-pet',
        actorType: 'player'
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
    // The autonomous storm survives attack interruption, but its remaining pulses still end on pet swap.
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
