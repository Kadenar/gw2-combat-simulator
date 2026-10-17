import { CONDITION } from '#gw2/platform/effects/conditions.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
/**
 * Owns Core Ranger pet skill fragments for the Warclaw family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_WARCLAW_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Slash uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.WARCLAW_SLASH]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.35,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WARCLAW_SLASH]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WARCLAW_SLASH]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Battle Maul uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.WARCLAW_BATTLE_MAUL]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 4,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WARCLAW_BATTLE_MAUL]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WARCLAW_BATTLE_MAUL]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Bop uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.WARCLAW_BOP]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'control',
        controlKind: 'knockdown',
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WARCLAW_BOP]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WARCLAW_BOP]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.RALLYING_ROAR]: {
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  }
});
