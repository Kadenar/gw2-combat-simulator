import { CONDITION } from '#gw2/platform/effects/conditions.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
/**
 * Owns Core Ranger pet skill fragments for the Chak family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_CHAK_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Unleash Energy uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.CHAK_UNLEASH_ENERGY]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.425,
        source: 'ranger-pet',
        actorType: 'summon',
        projectile: true
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CHAK_UNLEASH_ENERGY]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CHAK_UNLEASH_ENERGY]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Electrocute uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.CHAK_ELECTROCUTE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.67,
        source: 'ranger-pet',
        actorType: 'summon',
        projectile: true
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 8,
        duration: 8,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CHAK_ELECTROCUTE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CHAK_ELECTROCUTE]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Spit Goop uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.CHAK_SPIT_GOOP]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        source: 'ranger-pet',
        actorType: 'summon',
        projectile: true
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2.5,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CHAK_SPIT_GOOP]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CHAK_SPIT_GOOP]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.LEY_ENERGY_PULSE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 500,
    petSkill: true
  }
});
