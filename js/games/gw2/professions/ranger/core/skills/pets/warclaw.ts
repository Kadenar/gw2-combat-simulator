/**
 * Owns Core Ranger pet skill fragments for the Warclaw family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_WARCLAW_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Slash uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.WARCLAW_SLASH]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WARCLAW_SLASH]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WARCLAW_SLASH]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.35,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  // Natural Battle Maul uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.WARCLAW_BATTLE_MAUL]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WARCLAW_BATTLE_MAUL]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WARCLAW_BATTLE_MAUL]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 4,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  // Natural Bop uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.WARCLAW_BOP]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WARCLAW_BOP]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WARCLAW_BOP]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKDOWN,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.RALLYING_ROAR]: {
    petSkill: true,
    quicknessCastTimeMs: 333,
    effects: []
  }
});
