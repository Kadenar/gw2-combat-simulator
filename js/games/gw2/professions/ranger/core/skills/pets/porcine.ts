/**
 * Owns Core Ranger pet skill definitions for the Porcine family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_PORCINE_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.PORCINE_JAB]: definePetSkill({
    name: 'Jab',
    description: 'Jab your foe with your tusks.',
    icon: new URL('@images/wiki/jab-porcine.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Boar', 'Warthog', 'Siamoth', 'Pig'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PORCINE_JAB]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PORCINE_JAB]!.quicknessCastTimeMs,
    // The tusk impact precedes recovery; pet ownership supplies independent stats and swap cancellation.
    effects: impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.41, source: 'ranger-pet', actorType: ACTOR.SUMMON }
    ])
  }),
  [ID.PORCINE_MAUL]: definePetSkill({
    name: 'Maul',
    description: 'Maul your foes and make them bleed.',
    icon: 'https://render.guildwars2.com/file/24073F5A0566ABE32DFB74204E9FA01025D85D71/104055.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Boar', 'Warthog', 'Siamoth', 'Pig'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 10,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PORCINE_MAUL]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PORCINE_MAUL]!.quicknessCastTimeMs,
    // Both contacts apply two bleeds each; Quickness does not accelerate the measured Maul animation.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [600, 600].map((atMs) => ({ atMs, coefficient: 0.33 })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        ticks: [600, 600].map((atMs) => ({ atMs, condition: CONDITION.BLEEDING, stacks: 2, duration: 6 })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }),
  [ID.PORCINE_BRUTAL_CHARGE]: definePetSkill({
    name: 'Brutal Charge',
    description: 'Charge your foes and knock them down.',
    icon: 'https://render.guildwars2.com/file/D89C043113B1B24AE538C6F5DC297924459E3EBA/104054.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Boar', 'Warthog', 'Siamoth', 'Pig'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 24,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PORCINE_BRUTAL_CHARGE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PORCINE_BRUTAL_CHARGE]!.quicknessCastTimeMs,
    // Quickness leaves the charge unchanged; its leap and knockdown resolve with the landed strike.
    effects: impactEffects({ atMs: 1080, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.67,
        comboFinishers: [
          {
            ownerId: 'ranger',
            ownerActorType: ACTOR.SUMMON,
            finisherType: COMBO_FINISHER.LEAP
          }
        ],
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      { type: 'control', controlKind: CONTROL.KNOCKDOWN, source: 'ranger-pet', actorType: ACTOR.SUMMON }
    ])
  }),
  [ID.VAMPIRIC_BITE]: definePetSkill({
    name: 'Vampiric Bite',
    description: 'Bite your foe, siphoning health.',
    icon: 'https://render.guildwars2.com/file/0901C0B004F60F4DB5B4B503BF35B09278AA4491/2604860.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Wallow'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.VAMPIRIC_BITE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.VAMPIRIC_BITE]!.quicknessCastTimeMs,
    // The bite can crit; its healing does not add a separate life-siphon damage packet.
    effects: impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.42, source: 'ranger-pet', actorType: ACTOR.SUMMON }
    ])
  }),
  [ID.WALLOW_MAUL]: definePetSkill({
    name: 'Maul',
    description: 'Maul your foes and make them bleed.',
    icon: 'https://render.guildwars2.com/file/24073F5A0566ABE32DFB74204E9FA01025D85D71/104055.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Wallow'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 12,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WALLOW_MAUL]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WALLOW_MAUL]!.quicknessCastTimeMs,
    // Both hits land together, each applying two bleeding stacks.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [680, 680].map((atMs) => ({ atMs, coefficient: 0.33 })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        ticks: [680, 680].map((atMs) => ({ atMs, condition: CONDITION.BLEEDING, stacks: 2, duration: 6 })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }),
  [ID.UNDEAD_PLAGUE_PET]: definePetSkill({
    name: 'Undead Plague',
    description: 'Emit noxious fumes that poison foes. Poison duration is increased on disabled foes.',
    icon: 'https://render.guildwars2.com/file/28CBACDF0A6D07087766675435495E087F67BE6F/2604859.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Wallow'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.UNDEAD_PLAGUE_PET]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.UNDEAD_PLAGUE_PET]!.quicknessCastTimeMs,
    interruptCommitMs: 640,
    // Once released, the cloud retains its pet owner and one-second pulses while the pet resumes attacking.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [640, 1640, 2640, 3640, 4640].map((atMs) => ({ atMs, coefficient: 0.2 })),
        // Register the field at the actual first impact, including the pet's current action rate.
        comboFields: [{ ownerId: 'ranger', ownerActorType: ACTOR.SUMMON, fieldType: COMBO_FIELD.POISON, duration: 5 }],
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        ticks: [640, 1640, 2640, 3640, 4640].map((atMs) => ({
          atMs,
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 4
        })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }),
  [ID.FORAGE_ROCK]: definePetSkill({
    name: 'Forage Rock',
    description: 'Beast. Search the area for an improvised weapon.',
    icon: 'https://render.guildwars2.com/file/7FE63F139CC1BC0EB0F1DA49066B0DE5A0CC062B/104053.png',
    petNames: ['Boar'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FORAGE_ROCK]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FORAGE_ROCK]!.quicknessCastTimeMs,
    // Foraging occupies the pet lane but creates no direct damage; picked-up bundle skills belong to the player.
    effects: []
  }),
  [ID.FORAGE_SCALE]: definePetSkill({
    name: 'Forage Scale',
    description: 'Beast. Search the area for an improvised weapon.',
    icon: 'https://render.guildwars2.com/file/7FE63F139CC1BC0EB0F1DA49066B0DE5A0CC062B/104053.png',
    petNames: ['Warthog'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    quicknessCastTimeMs: 667,
    effects: []
  }),
  [ID.FORAGE_FEATHERS]: definePetSkill({
    name: 'Forage Feathers',
    description: 'Beast. Search the area for an improvised weapon.',
    icon: 'https://render.guildwars2.com/file/7FE63F139CC1BC0EB0F1DA49066B0DE5A0CC062B/104053.png',
    petNames: ['Siamoth'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    quicknessCastTimeMs: 667,
    effects: []
  }),
  [ID.FORAGE_SWORD]: definePetSkill({
    name: 'Forage Sword',
    description: 'Beast. Search the area for an improvised weapon.',
    icon: 'https://render.guildwars2.com/file/7FE63F139CC1BC0EB0F1DA49066B0DE5A0CC062B/104053.png',
    petNames: ['Pig'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    quicknessCastTimeMs: 667,
    effects: []
  }),
  [ID.BLOODTHIRSTY_CHARGE]: definePetSkill({
    name: 'Bloodthirsty Charge',
    description: 'Beast. Charge into a foe, pushing them back and causing them to bleed.',
    icon: 'https://render.guildwars2.com/file/682E7BE8FB06E35ACEF0B7631EB243AF574C533E/2604858.png',
    petNames: ['Wallow'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BLOODTHIRSTY_CHARGE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BLOODTHIRSTY_CHARGE]!.quicknessCastTimeMs,
    // The strike, bleed, and knockback land together before the charge's recovery finishes.
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 2,
        duration: 8,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKBACK,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  })
});
