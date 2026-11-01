/**
 * Owns Core Ranger pet skill definitions for the Feline family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, BOON, CONDITION, RECIPIENT, STATUS } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
export const RANGER_CORE_FELINE_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  // Natural Phase Pounce uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.FELINE_PHASE_POUNCE]: definePetSkill({
    name: 'Phase Pounce',
    description:
      "Leap through a rift in the Mists, shadowstepping briefly to the target's location and inflicting damage and conditions.",
    icon: 'https://render.guildwars2.com/file/F16B4742E83542D8406DDAEBD7BE06EEA8061E16/2604865.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['White Tiger'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 16,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_PHASE_POUNCE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_PHASE_POUNCE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 4,
        duration: 10,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.MIGHTY_ROAR]: definePetSkill({
    name: 'Mighty Roar',
    description: 'Beast. Give extreme might to nearby allies.',
    icon: 'https://render.guildwars2.com/file/FC1F050E63ACD1504A2E71FD01C279ED26CFE423/103240.png',
    petNames: ['Jungle Stalker'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 15,
        stacks: 8,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.RENDING_POUNCE]: definePetSkill({
    name: 'Rending Pounce',
    description: 'Beast. Leap at a foe and make them bleed.',
    icon: 'https://render.guildwars2.com/file/43210A51F17CF8FA6E600CD8D0495458471C4CDA/103959.png',
    petNames: ['Lynx'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
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
  }),
  [ID.ICY_POUNCE]: definePetSkill({
    name: 'Icy Pounce',
    description: 'Beast. Leap at your foe, chilling them.',
    icon: 'https://render.guildwars2.com/file/43210A51F17CF8FA6E600CD8D0495458471C4CDA/103959.png',
    petNames: ['Snow Leopard'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 2,
        duration: 2,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.STALK]: definePetSkill({
    name: 'Stalk',
    description:
      'Beast. Gain stealth and increased critical-strike chance and ferocity for a short duration. Grant your ranger stealth.\nThis skill will not grant your ranger stealth if they are downed.',
    icon: 'https://render.guildwars2.com/file/15780BCEBC0C20E7403191DEA92DB365AB380AE6/103960.png',
    petNames: ['Jaguar'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 333,
    // Jaguar grants its ranger stealth, enabling spear attacks without spending Panther's Prowl.
    effects: [{ type: 'buff', kind: STATUS.STEALTH, duration: 3, stacks: 1 }]
  }),
  [ID.FURIOUS_POUNCE]: definePetSkill({
    name: 'Furious Pounce',
    description: 'Beast. Pounce on your target and grant fury to nearby allies.',
    icon: 'https://render.guildwars2.com/file/ACDDD2A75BEE6C4FDDA26D0C9F3D4F94C85C9412/1128614.png',
    petNames: ['Tiger'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FURIOUS_POUNCE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FURIOUS_POUNCE]!.quicknessCastTimeMs,
    // Impact precedes the remaining animation; the pet lane retains the full recovery.
    effects: impactEffects({ atMs: 1080, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.FURY,
        duration: 10,
        stacks: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }),
  [ID.FELINE_SLASH]: definePetSkill({
    name: 'Slash',
    description: 'Slash at your foe.',
    icon: 'https://render.guildwars2.com/file/D5420B910EE4DA1D2F63AEC71F4DF862E414D6E1/103515.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Tiger', 'Jungle Stalker', 'Lynx', 'Snow Leopard', 'Jaguar', 'Cheetah', 'Sand Lion', 'White Tiger'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_SLASH]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_SLASH]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.35 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.FELINE_BITE]: definePetSkill({
    name: 'Bite',
    description: 'Bite your foe for severe damage.',
    icon: 'https://render.guildwars2.com/file/520693759A79FD464CA7AD08947D10B4B50F7A96/103516.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Tiger', 'Jungle Stalker', 'Lynx', 'Snow Leopard', 'Jaguar', 'Cheetah', 'Sand Lion', 'White Tiger'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 8,
    // Recorded pet activation timing keeps manual commands on the pet's independent lane.
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_BITE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_BITE]!.quicknessCastTimeMs,
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.7,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 6,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }),
  [ID.FELINE_MAUL]: definePetSkill({
    name: 'Maul',
    description: 'Slash a foe multiple times and make them bleed.',
    icon: 'https://render.guildwars2.com/file/D5420B910EE4DA1D2F63AEC71F4DF862E414D6E1/103515.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Tiger', 'Jungle Stalker', 'Lynx', 'Snow Leopard', 'Jaguar', 'Cheetah', 'Sand Lion'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 16,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_MAUL]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_MAUL]!.quicknessCastTimeMs,
    // Each strike applies its own two stacks, so the second hit cannot bleed early.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [360, 560].map((atMs) => ({
          atMs,
          coefficient: 0.4
        })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        ticks: [360, 560].map((atMs) => ({ atMs, condition: CONDITION.BLEEDING, stacks: 2, duration: 10 })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }),
  [ID.SAVANNAH_STRIKE]: definePetSkill({
    name: 'Savannah Strike',
    description: 'Beast. Shadowstep to your target and strike them. Grant nearby allies swiftness.',
    icon: 'https://render.guildwars2.com/file/2FC4CC6A29447D5DAE0557DA747CADA35B09A1AE/1770565.png',
    petNames: ['Cheetah'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.SWIFTNESS,
        duration: 5,
        stacks: 2,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.BLINDING_ROAR]: definePetSkill({
    name: 'Blinding Roar',
    description: 'Beast. Release a powerful roar that blinds nearby foes.',
    icon: 'https://render.guildwars2.com/file/06EFCDD57F325D6A5E472660E993BF62E0CADD0A/1770552.png',
    petNames: ['Sand Lion'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 1.0499999999999998,
        hits: 3,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.GUARDIANS_ROAR]: definePetSkill({
    name: "Guardian's Roar",
    description: 'Beast. Roar and grant aegis to nearby allies.',
    icon: 'https://render.guildwars2.com/file/AC019F149969B613AF6245F8715CBFE132B20239/2604864.png',
    petNames: ['White Tiger'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.AEGIS,
        duration: 5,
        stacks: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  })
});
