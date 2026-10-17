import { CONDITION } from '#gw2/platform/effects/conditions.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
/**
 * Owns Core Ranger pet skill fragments for the Wyvern family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_WYVERN_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Wing Swipe uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.WYVERN_WING_SWIPE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WYVERN_WING_SWIPE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WYVERN_WING_SWIPE]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Tail Lash uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.WYVERN_TAIL_LASH]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WYVERN_TAIL_LASH]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WYVERN_TAIL_LASH]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Wing Buffet uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.WYVERN_WING_BUFFET]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 4,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'control',
        controlKind: 'launch',
        duration: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WYVERN_WING_BUFFET]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WYVERN_WING_BUFFET]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.LIGHTNING_ASSAULT]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.CONSUMING_FLAME]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1667,
    petSkill: true
  }
});
