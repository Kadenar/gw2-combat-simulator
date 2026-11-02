/**
 * Owns Core Ranger pet skill definitions for the Canine family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_CANINE_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  // Natural Bite uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.CANINE_BITE]: definePetSkill({
    name: 'Bite',
    icon: new URL('@images/wiki/bite-canine.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Krytan Drakehound', 'Alpine Wolf', 'Fern Hound', 'Hyena', 'Wolf'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_BITE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_BITE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.335,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Crippling Leap uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.CANINE_CRIPPLING_LEAP]: definePetSkill({
    name: 'Crippling Leap',
    icon: 'https://render.guildwars2.com/file/09990305A163E3BC2DF2E9D1D2BA93F2ECE8BA3E/103610.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Krytan Drakehound', 'Alpine Wolf', 'Fern Hound', 'Hyena', 'Wolf'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 10,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_CRIPPLING_LEAP]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_CRIPPLING_LEAP]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.67,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        comboFinishers: [
          {
            ownerId: 'ranger',
            ownerActorType: ACTOR.SUMMON,
            finisherType: COMBO_FINISHER.LEAP
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 5,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Brutal Charge uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.CANINE_BRUTAL_CHARGE]: definePetSkill({
    name: 'Brutal Charge',
    icon: 'https://render.guildwars2.com/file/06614FF537DBD771DE67B341BA0CA565B24F0A67/103239.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Krytan Drakehound', 'Alpine Wolf', 'Fern Hound', 'Hyena', 'Wolf'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 18,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_BRUTAL_CHARGE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_BRUTAL_CHARGE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.67,
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
  [ID.INTIMIDATING_HOWL]: definePetSkill({
    name: 'Intimidating Howl',
    icon: 'https://render.guildwars2.com/file/45E153B2939D037C4E6FDE1FEF42CF6456280D3E/104046.png',
    petNames: ['Krytan Drakehound'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        // Pet-owned immobilize follows the attack's applications and uses pet condition duration.
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2,
        applications: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.CHILLING_HOWL]: definePetSkill({
    name: 'Chilling Howl',
    icon: 'https://render.guildwars2.com/file/5D97691719F5D52AAA610CCECB13B0F2056A0E08/103607.png',
    petNames: ['Alpine Wolf'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 1000,
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
  [ID.REGENERATE_FERN_HOUND]: definePetSkill({
    name: 'Regenerate',
    icon: 'https://render.guildwars2.com/file/3CD0D15B0C0E9CB7BD6709E773DFB2FCFEC25823/103609.png',
    petNames: ['Fern Hound'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 6,
        stacks: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.HOWL_OF_THE_PACK]: definePetSkill({
    name: 'Howl of the Pack',
    icon: 'https://render.guildwars2.com/file/B824F20C4F5F7B739A0634DD79EE0EA2A82D7FC3/103237.png',
    petNames: ['Hyena'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 30,
    quicknessCastTimeMs: 1000,
    effects: []
  }),
  [ID.TERRIFYING_HOWL]: definePetSkill({
    name: 'Terrifying Howl',
    icon: 'https://render.guildwars2.com/file/C016B80FBD257CDD09EACFE7EBC611DF0A7040D6/103520.png',
    petNames: ['Wolf'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 30,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  })
};
