/**
 * Owns Core Ranger pet skill definitions for the Warclaw family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_WARCLAW_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  // Natural Slash uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.WARCLAW_SLASH]: definePetSkill({
    name: 'Slash',
    icon: new URL('@images/wiki/slash-warclaw.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Warclaw'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
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
  }),
  // Natural Battle Maul uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.WARCLAW_BATTLE_MAUL]: definePetSkill({
    name: 'Battle Maul',
    icon: new URL('@images/wiki/battle-maul-juvenile-warclaw.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Warclaw'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 15,
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
  }),
  // Natural Bop uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.WARCLAW_BOP]: definePetSkill({
    name: 'Bop',
    icon: 'https://render.guildwars2.com/file/B7474B75A6C14CE0FF295523AADCA5A5F2C1621B/3379168.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Warclaw'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 18,
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
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.RALLYING_ROAR]: definePetSkill({
    name: 'Rallying Roar',
    icon: 'https://render.guildwars2.com/file/C20B41C6C7E2E512BF73ABB968A17F61690517AF/3379169.png',
    petNames: ['Warclaw'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 333,
    effects: []
  })
};
