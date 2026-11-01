/**
 * Owns Core Ranger pet skill definitions for the Aether Hunter family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_AETHER_HUNTER_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.AETHER_HUNTER_BITE]: definePetSkill({
    name: 'Bite',
    description: 'Bite at your foe and inflict bleeding.',
    icon: new URL('@images/wiki/bite-aether-hunter.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Aether Hunter'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.AETHER_HUNTER_BITE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.AETHER_HUNTER_BITE]!.quicknessCastTimeMs,
    // The measured Quickness contact pairs its strike and bleed; the pet timing profile restores the slower contact.
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.5, source: 'ranger-pet', actorType: ACTOR.SUMMON },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 5,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }),
  [ID.AETHER_HUNTER_LUNGE]: definePetSkill({
    name: 'Lunge',
    description: 'Lunge forward, crippling opponents in the path.',
    icon: 'https://render.guildwars2.com/file/B65ECEBB72F4F10C4144510777E899E477DEE5B2/3124960.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Aether Hunter'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 8,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.AETHER_HUNTER_LUNGE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.AETHER_HUNTER_LUNGE]!.quicknessCastTimeMs,
    // Lunge's early contact and motion remain unchanged by Quickness in the paired logs.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.8, source: 'ranger-pet', actorType: ACTOR.SUMMON },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }),
  [ID.AETHER_HUNTER_LEY_LINE_VORTEX]: definePetSkill({
    name: 'Ley-Line Vortex',
    description: 'Spin around, striking and tormenting nearby enemies.',
    icon: 'https://render.guildwars2.com/file/030E7AB1CB18A4B348FD17B54B2B68FDABDB1DBC/3124961.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Aether Hunter'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.AETHER_HUNTER_LEY_LINE_VORTEX]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.AETHER_HUNTER_LEY_LINE_VORTEX]!.quicknessCastTimeMs,
    // Quickness compresses the paired pulses but leaves the full channel recovery; retirement cancels pending pulses.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [0, 680, 1360, 2040, 2720].map((atMs) => ({ atMs, coefficient: 0.5 })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        ticks: [0, 680, 1360, 2040, 2720].map((atMs) => ({
          atMs,
          condition: CONDITION.TORMENT,
          stacks: 1,
          duration: 8
        })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }),
  [ID.DIMENSION_BREACH]: definePetSkill({
    name: 'Dimension Breach',
    description: "Beast.  Dive between dimensions, resurfacing at your foe's location and knocking them into the air.",
    icon: 'https://render.guildwars2.com/file/090FC4C97ADB55985F67F1FE225803784B3E6FAE/3124959.png',
    petNames: ['Aether Hunter'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.DIMENSION_BREACH]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.DIMENSION_BREACH]!.quicknessCastTimeMs,
    // Breach's launch accompanies its resurfacing strike before the pet can resume basic attacks.
    // Retain the API coefficient: the unquickened sample's lower damage does not isolate a scaling change.
    effects: impactEffects({ atMs: 880, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      { type: 'control', controlKind: CONTROL.LAUNCH, source: 'ranger-pet', actorType: ACTOR.SUMMON }
    ])
  })
});
