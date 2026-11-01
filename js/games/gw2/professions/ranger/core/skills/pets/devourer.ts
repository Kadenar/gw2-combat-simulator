/**
 * Owns Core Ranger pet skill definitions for the Devourer family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

// CAdruid's opener lands 1,162 ms after the pet starts casting; use 1,160 ms as the fixed travel approximation.
const POISONOUS_CLOUD_PULSE_TIMES_MS = [1160, 2160, 3160, 4160, 5160, 6160];

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
export const RANGER_CORE_DEVOURER_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.POISONOUS_CLOUD]: definePetSkill({
    name: 'Poisonous Cloud',
    description: 'Beast. Spit a ball of venom that covers an area with a poisonous cloud.',
    icon: 'https://render.guildwars2.com/file/36A3327C0EEA1D5C03EAA5587C73692580A42BB5/104031.png',
    petNames: ['Carrion Devourer'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 30,
    // The unquickened pet animation occupies 1.8 s
    castTimeMs: 1800,
    quicknessCastTimeMs: 1800,
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: COMBO_FIELD.POISON,
        duration: 5,
        // The five-second field runs from the first fixed pulse through the sixth.
        startMs: POISONOUS_CLOUD_PULSE_TIMES_MS[0],
        startAnchor: 'castStart'
      }
    ],
    // In-game bug: both strikes and poison use Ranger stats instead of pet stats; preserve that behavior.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: POISONOUS_CLOUD_PULSE_TIMES_MS.map((atMs) => ({
          atMs,
          coefficient: 0.2,
          weaponStrength: 2880,
          independentSummonStrike: true,
          summonUsesProfessionModifiers: true,
          summonInheritsAttributes: true,
          summonInheritsCriticalAttributes: true
        })),
        source: 'ranger-pet',
        actorType: ACTOR.PLAYER
      },
      {
        // EVTC attributes both the command strike and its poison applications
        // to the Ranger even though the active Devourer executes the command.
        type: 'condition',
        ticks: POISONOUS_CLOUD_PULSE_TIMES_MS.map((atMs) => ({
          atMs,
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 6
        })),
        source: 'ranger',
        actorType: ACTOR.PLAYER
      }
    ])
  }),
  [ID.POISON_BARBS]: definePetSkill({
    name: 'Poison Barbs',
    description: 'Beast. Spray poisonous barbs in an arc in front of you, damaging and poisoning foes.',
    icon: 'https://render.guildwars2.com/file/9A033F36CC4EEB19F6FCDE440D7CCB150A169BB5/104030.png',
    petNames: ['Whiptail Devourer'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 1667,
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 4,
        duration: 6,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.RENDING_BARBS]: definePetSkill({
    name: 'Rending Barbs',
    description: 'Beast. Rapidly launch projectiles that bleed your target.',
    icon: 'https://render.guildwars2.com/file/5A56036047B5A211D8470C4F65F56FAC0550006D/104032.png',
    petNames: ['Lashtail Devourer'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 2667,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 6,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 6,
        duration: 8,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.TWIN_DARTS]: definePetSkill({
    name: 'Twin Darts',
    description: 'Fire two shots from your tail that bleed your enemy.',
    icon: 'https://render.guildwars2.com/file/9D3C1CD36EAFF4F4F5E4EB7B41C318771E579C78/103583.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Carrion Devourer', 'Whiptail Devourer', 'Lashtail Devourer'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.TWIN_DARTS]!.quicknessCastTimeMs,
    // An interrupted autonomous windup must cancel its pending darts and their conditions together.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [840, 920].map((atMs) => ({ atMs, coefficient: 0.15 })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2
          }
        ]
      },
      {
        // Each projectile applies one full four-second bleed; Arachnophobia's pet expertise extends it to five.
        type: 'condition',
        ticks: [840, 920].map((atMs) => ({
          atMs,
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 4
        })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }),
  [ID.PET_TAIL_LASH]: definePetSkill({
    name: 'Tail Lash',
    description: 'Push back a foe with your tail.',
    icon: 'https://render.guildwars2.com/file/086363EFF41571AD74CD1B506DF2B2F6F1F038D1/104029.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Carrion Devourer', 'Whiptail Devourer', 'Lashtail Devourer'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 1280,
    effects: impactEffects({ atMs: 1280, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.5,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'control',
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        controlKind: CONTROL.KNOCKBACK
      }
    ])
  })
});
