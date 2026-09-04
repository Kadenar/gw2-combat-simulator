/**
 * Owns Core Ranger pet skill fragments for the Jellyfish family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const RANGER_CORE_JELLYFISH_PET_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.CHILLING_WHIRL]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 4,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 4,
        duration: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1833,
    petSkill: true
  },
  [ID.IMMOBILIZING_WHIRL]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 4,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1833,
    petSkill: true
  }
});
