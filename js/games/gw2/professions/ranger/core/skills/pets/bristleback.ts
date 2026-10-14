import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
/**
 * Owns Core Ranger pet skill fragments for the Bristleback family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_BRISTLEBACK_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Spike Shoot uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.BRISTLEBACK_SPIKE_SHOOT]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.31,
        source: 'ranger-pet',
        actorType: 'summon',
        projectile: true
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BRISTLEBACK_SPIKE_SHOOT]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BRISTLEBACK_SPIKE_SHOOT]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Sharpen Spines uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.BRISTLEBACK_SHARPEN_SPINES]: {
    effects: [
      {
        type: 'buff',
        kind: 'pet-sharpen-spines',
        duration: 30,
        stacks: 5,
        audience: {
          recipients: 'self'
        },
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BRISTLEBACK_SHARPEN_SPINES]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BRISTLEBACK_SHARPEN_SPINES]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Rain of Spikes uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.BRISTLEBACK_RAIN_OF_SPIKES]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        source: 'ranger-pet',
        actorType: 'summon',
        projectile: true
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 5,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BRISTLEBACK_RAIN_OF_SPIKES]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BRISTLEBACK_RAIN_OF_SPIKES]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.SPIKE_BARRAGE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 2.2,
        hits: 10,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 10,
        duration: 5,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1333,
    petSkill: true
  }
});
