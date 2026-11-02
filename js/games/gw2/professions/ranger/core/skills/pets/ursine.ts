/**
 * Owns Core Ranger pet skill definitions for the Ursine family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_URSINE_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  // Natural Slash uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.URSINE_SLASH]: definePetSkill({
    name: 'Slash',
    icon: new URL('@images/wiki/slash-bear.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Brown Bear', 'Murellow', 'Black Bear', 'Polar Bear', 'Arctodus'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.URSINE_SLASH]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.URSINE_SLASH]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.51,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.SHAKE_IT_OFF]: definePetSkill({
    name: 'Shake It Off',
    icon: 'https://render.guildwars2.com/file/4D234DA072DE77DEFC0605ED401CB93EDC2AC84B/103009.png',
    petNames: ['Brown Bear'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    quicknessCastTimeMs: 333,
    effects: []
  }),
  [ID.POISON_CLOUD_MURELLOW]: definePetSkill({
    name: 'Poison Cloud',
    icon: 'https://render.guildwars2.com/file/F80934FEC30547EAE2022A22D06E00CFDBB4B328/104038.png',
    petNames: ['Murellow'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.1,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 1,
        duration: 4,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.ENFEEBLING_ROAR]: definePetSkill({
    name: 'Enfeebling Roar',
    icon: 'https://render.guildwars2.com/file/F4ECC4EA13941443755D0F9B3344C4B015F1DAA7/103927.png',
    petNames: ['Black Bear'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    quicknessCastTimeMs: 833,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 4,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.ICY_ROAR]: definePetSkill({
    name: 'Icy Roar',
    icon: 'https://render.guildwars2.com/file/F4ECC4EA13941443755D0F9B3344C4B015F1DAA7/103927.png',
    petNames: ['Polar Bear'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 30,
    quicknessCastTimeMs: 833,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.RENDING_MAUL]: definePetSkill({
    name: 'Rending Maul',
    icon: 'https://render.guildwars2.com/file/695DA2E83CF23F527DD9109333CCB5239053DB94/104027.png',
    petNames: ['Arctodus'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 15,
    quicknessCastTimeMs: 1167,
    effects: [
      {
        type: 'strike',
        coefficient: 1.34,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 4,
        duration: 6,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  })
};
