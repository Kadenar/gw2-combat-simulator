/**
 * Owns Core Ranger pet skill definitions for the Phoenix family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_PHOENIX_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  // Natural Wicked Bite uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.PHOENIX_WICKED_BITE]: definePetSkill({
    name: 'Wicked Bite',
    description: 'Bite your foe, leaving them vulnerable.',
    icon: new URL('@images/wiki/wicked-bite.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Phoenix'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PHOENIX_WICKED_BITE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PHOENIX_WICKED_BITE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.43,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Dash uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.PHOENIX_DASH]: definePetSkill({
    name: 'Dash',
    description: 'Charge forward, leaving behind a trail of wind energy that detonates shortly afterward.',
    icon: 'https://render.guildwars2.com/file/321CD26F340F3B930A04104D61E40F0C37589BB8/2604862.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Phoenix'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PHOENIX_DASH]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PHOENIX_DASH]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Wing Buffet uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.PHOENIX_WING_BUFFET]: definePetSkill({
    name: 'Wing Buffet',
    description: 'Launch your foe backward with mighty wing beats.',
    icon: new URL('@images/wiki/wing-buffet-phoenix.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Phoenix'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PHOENIX_WING_BUFFET]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PHOENIX_WING_BUFFET]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'control',
        controlKind: CONTROL.LAUNCH,
        duration: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.GALE_BREATH]: definePetSkill({
    name: 'Gale Breath',
    description: 'Beast. Fires a sweeping breath attack, damaging foes.',
    icon: 'https://render.guildwars2.com/file/BB3497B9BE4A985F99D5ADC3FE32A3DF679B38D6/2604861.png',
    petNames: ['Phoenix'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 667,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  })
});
