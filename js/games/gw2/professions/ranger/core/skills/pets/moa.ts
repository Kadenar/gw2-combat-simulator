/**
 * Owns Core Ranger pet skill definitions for the Moa family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_MOA_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  // Natural Peck uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.MOA_PECK]: definePetSkill({
    name: 'Peck',
    description: 'Peck at your foe.',
    icon: new URL('@images/wiki/peck.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Blue Moa', 'Pink Moa', 'Black Moa', 'Red Moa'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.MOA_PECK]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.MOA_PECK]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.315,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Frenzied Attack uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.MOA_FRENZIED_ATTACK]: definePetSkill({
    name: 'Frenzied Attack',
    description: 'Attack with a pecking frenzy and make your foe vulnerable.',
    icon: 'https://render.guildwars2.com/file/E4C75BA1A9056A684EDDF0CBCB746B36D707A842/103007.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Blue Moa', 'Pink Moa', 'Black Moa', 'Red Moa'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.MOA_FRENZIED_ATTACK]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.MOA_FRENZIED_ATTACK]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 4,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 8,
        duration: 10,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.PROTECTING_SCREECH]: definePetSkill({
    name: 'Protecting Screech',
    description: 'Beast. Screech to grant protection to nearby allies.',
    icon: 'https://render.guildwars2.com/file/103BC1F43615CD02E416E04100022EB0AAEDD618/103238.png',
    petNames: ['Blue Moa'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 667,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.PROTECTION,
        duration: 4,
        stacks: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.DAZING_SCREECH]: definePetSkill({
    name: 'Dazing Screech',
    description: 'Beast. Create a high-pitched screech, dazing nearby foes.',
    icon: 'https://render.guildwars2.com/file/103BC1F43615CD02E416E04100022EB0AAEDD618/103238.png',
    petNames: ['Pink Moa'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.DAZING_SCREECH_ID_12709]: definePetSkill({
    name: 'Dazing Screech',
    description: 'Beast. Create a cone of sound, dazing foes.',
    icon: 'https://render.guildwars2.com/file/103BC1F43615CD02E416E04100022EB0AAEDD618/103238.png',
    petNames: ['Black Moa'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.FURIOUS_SCREECH]: definePetSkill({
    name: 'Furious Screech',
    description: 'Beast. Screech angrily to grant fury to nearby allies.',
    icon: 'https://render.guildwars2.com/file/103BC1F43615CD02E416E04100022EB0AAEDD618/103238.png',
    petNames: ['Red Moa'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 667,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.FURY,
        duration: 15,
        stacks: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  })
});
