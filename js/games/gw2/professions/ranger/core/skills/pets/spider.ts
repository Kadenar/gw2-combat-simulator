import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
/**
 * Owns Core Ranger pet skill fragments for the Spider family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_SPIDER_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Poison Gas uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SPIDER_POISON_GAS]: {
    // Once the cast releases its cloud, later pulses retain the originating companion.
    interruptCommitMs: 3000,
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 6,
        applications: 3,
        intervalMs: 1000,
        persistsAfterInterrupt: true,
        comboFields: [
          {
            ownerId: 'ranger',
            ownerActorType: 'summon',
            fieldType: 'Poison',
            duration: 4
          }
        ],
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPIDER_POISON_GAS]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPIDER_POISON_GAS]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Entangling Web uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SPIDER_ENTANGLING_WEB]: {
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
        condition: 'Immobilized',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPIDER_ENTANGLING_WEB]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPIDER_ENTANGLING_WEB]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.DEADLY_VENOM]: {
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 2,
        duration: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.PARALYZING_VENOM]: {
    // The venom arms the pet's next landed attack for twenty seconds (wiki: Paralyzing_Venom).
    effects: [
      {
        type: 'buff',
        kind: 'paralyzing-venom',
        duration: 20,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon',
        audience: { recipients: 'self' }
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.WEAKENING_VENOM]: {
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 10,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.SPIT]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.57,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPIT]!.quicknessCastTimeMs,
    petSkill: true
  }
});
