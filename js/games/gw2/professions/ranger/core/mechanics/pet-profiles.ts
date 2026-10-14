import {
  RANGER_PET_SKILL_TIMINGS,
  rangerPetSkillTiming
} from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

export interface RangerPetAttributes {
  readonly power: number;
  readonly precision: number;
  readonly toughness: number;
  readonly vitality: number;
  readonly ferocity: number;
  readonly conditionDamage: number;
  readonly expertise: number;
  readonly healingPower: number;
}

export interface PetAutoSkill {
  readonly id: SkillId;
  readonly recovery: number;
  readonly cooldown?: number;
}

export interface PetAutoProfile {
  readonly weaponStrength?: number;
  readonly openingDelay: number;
  readonly openingRecoveryDelay?: number;
  readonly quicknessOpeningRecoveryDelay?: number;
  readonly opening?: PetAutoSkill;
  readonly basic: PetAutoSkill;
  readonly specials: readonly PetAutoSkill[];
  readonly commandRecovery: Readonly<Record<string, number>>;
  readonly ignoresAlacrity?: boolean;
}

/** Fixed pet baselines used by Wuthering Wind; live pet attacks supply their own scaling metadata. */
export const RANGER_PET_STRIKE_SCALING = Object.freeze({
  basePower: 1524,
  baseConditionDamage: 1000
});

const DEFAULT_PET_BASE_ATTRIBUTES: RangerPetAttributes = Object.freeze({
  power: 1524,
  precision: 1524,
  toughness: 1000,
  vitality: 1000,
  ferocity: 0,
  conditionDamage: 1000,
  expertise: 0,
  healingPower: 0
});

// Keep explicitly modeled pet stats in one lookup so supporting another pet is a data-only change.
const PET_BASE_ATTRIBUTES: Readonly<Record<string, RangerPetAttributes>> = Object.freeze({
  // The October pet logs directly confirm these independent condition baselines.
  Boar: {
    ...DEFAULT_PET_BASE_ATTRIBUTES,
    precision: 1180,
    toughness: 2211,
    vitality: 3585,
    conditionDamage: 1500,
    healingPower: 600
  },
  'Aether Hunter': {
    ...DEFAULT_PET_BASE_ATTRIBUTES,
    power: 1868,
    toughness: 1524,
    vitality: 3585,
    conditionDamage: 1800
  },
  'Raptor Swiftwing': {
    ...DEFAULT_PET_BASE_ATTRIBUTES,
    power: 1868,
    precision: 2211,
    toughness: 1524,
    vitality: 2898,
    conditionDamage: 1500
  },
  'Carrion Devourer': {
    ...DEFAULT_PET_BASE_ATTRIBUTES,
    toughness: 2898,
    vitality: 2211
  },
  'Fanged Iboga': DEFAULT_PET_BASE_ATTRIBUTES,
  Hawk: {
    ...DEFAULT_PET_BASE_ATTRIBUTES,
    precision: 2211,
    toughness: 1524,
    vitality: 2211,
    conditionDamage: 700
  },
  Tiger: {
    ...DEFAULT_PET_BASE_ATTRIBUTES,
    precision: 2211,
    toughness: 1524,
    vitality: 2211
  },
  Pig: {
    ...DEFAULT_PET_BASE_ATTRIBUTES,
    precision: 1180,
    toughness: 2211,
    vitality: 3585,
    conditionDamage: 700,
    healingPower: 600
  },
  Wallow: {
    ...DEFAULT_PET_BASE_ATTRIBUTES,
    toughness: 2211,
    vitality: 2898,
    conditionDamage: 700
  },
  Jacaranda: {
    ...DEFAULT_PET_BASE_ATTRIBUTES,
    power: 1868,
    toughness: 2211,
    vitality: 2211,
    conditionDamage: 400,
    healingPower: 1200
  },
  'Jungle Stalker': {
    power: 1524,
    precision: 2211,
    toughness: 1524,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  },
  Lynx: {
    power: 1524,
    precision: 2211,
    toughness: 1524,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  },
  'Krytan Drakehound': {
    power: 1868,
    precision: 1524,
    toughness: 2211,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 0
  },
  'Brown Bear': {
    power: 1524,
    precision: 1524,
    toughness: 2211,
    vitality: 4959,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 1200
  },
  'Salamander Drake': {
    power: 1868,
    precision: 1524,
    toughness: 2211,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 700,
    expertise: 0,
    healingPower: 600
  },
  'Alpine Wolf': {
    power: 1868,
    precision: 1524,
    toughness: 2211,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 0
  },
  'Snow Leopard': {
    power: 1524,
    precision: 2211,
    toughness: 1524,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  },
  Raven: {
    power: 1524,
    precision: 2211,
    toughness: 1524,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 700,
    expertise: 0,
    healingPower: 0
  },
  Jaguar: {
    power: 1524,
    precision: 2211,
    toughness: 1524,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  },
  'Marsh Drake': {
    power: 1868,
    precision: 1524,
    toughness: 2211,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 700,
    expertise: 0,
    healingPower: 600
  },
  'Blue Moa': {
    power: 1524,
    precision: 1524,
    toughness: 1524,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 1200
  },
  'Pink Moa': {
    power: 1524,
    precision: 1524,
    toughness: 1524,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 1200
  },
  'Black Moa': {
    power: 1524,
    precision: 1524,
    toughness: 1524,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 1200
  },
  'Red Moa': {
    power: 1524,
    precision: 1524,
    toughness: 1524,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 1200
  },
  'Ice Drake': {
    power: 1868,
    precision: 1524,
    toughness: 2211,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 700,
    expertise: 0,
    healingPower: 600
  },
  'River Drake': {
    power: 1868,
    precision: 1524,
    toughness: 2211,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 700,
    expertise: 0,
    healingPower: 600
  },
  Murellow: {
    power: 1524,
    precision: 1524,
    toughness: 2211,
    vitality: 4959,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 1200
  },
  'Fern Hound': {
    power: 1868,
    precision: 1524,
    toughness: 2211,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 0
  },
  'Black Bear': {
    power: 1524,
    precision: 1524,
    toughness: 2211,
    vitality: 4959,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 1200
  },
  'Polar Bear': {
    power: 1524,
    precision: 1524,
    toughness: 2211,
    vitality: 4959,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 1200
  },
  Arctodus: {
    power: 1524,
    precision: 1524,
    toughness: 2211,
    vitality: 4959,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 1200
  },
  'Whiptail Devourer': {
    power: 1524,
    precision: 1524,
    toughness: 2898,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  },
  'Lashtail Devourer': {
    power: 1524,
    precision: 1524,
    toughness: 2898,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  },
  Hyena: {
    power: 1868,
    precision: 1524,
    toughness: 2211,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 0
  },
  Wolf: {
    power: 1868,
    precision: 1524,
    toughness: 2211,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 0
  },
  Owl: {
    power: 1524,
    precision: 2211,
    toughness: 1524,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 700,
    expertise: 0,
    healingPower: 0
  },
  Eagle: {
    power: 1524,
    precision: 2211,
    toughness: 1524,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 700,
    expertise: 0,
    healingPower: 0
  },
  'White Raven': {
    power: 1524,
    precision: 2211,
    toughness: 1524,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 700,
    expertise: 0,
    healingPower: 0
  },
  'Forest Spider': {
    power: 1524,
    precision: 1524,
    toughness: 1524,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  },
  'Jungle Spider': {
    power: 1524,
    precision: 1524,
    toughness: 1524,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  },
  'Cave Spider': {
    power: 1524,
    precision: 1524,
    toughness: 1524,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  },
  'Black Widow Spider': {
    power: 1524,
    precision: 1524,
    toughness: 1524,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  },
  Warthog: {
    power: 1524,
    precision: 1180,
    toughness: 2211,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 700,
    expertise: 0,
    healingPower: 600
  },
  Siamoth: {
    power: 1524,
    precision: 1180,
    toughness: 2211,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 700,
    expertise: 0,
    healingPower: 600
  },
  'Reef Drake': {
    power: 1868,
    precision: 1524,
    toughness: 2211,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 700,
    expertise: 0,
    healingPower: 600
  },
  Smokescale: {
    power: 1524,
    precision: 1524,
    toughness: 2211,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 0
  },
  'Electric Wyvern': {
    power: 1868,
    precision: 1524,
    toughness: 2211,
    vitality: 2898,
    ferocity: 0,
    conditionDamage: 700,
    expertise: 0,
    healingPower: 0
  },
  'Fire Wyvern': {
    power: 1868,
    precision: 1524,
    toughness: 2211,
    vitality: 2898,
    ferocity: 0,
    conditionDamage: 700,
    expertise: 0,
    healingPower: 0
  },
  Bristleback: {
    power: 1868,
    precision: 1524,
    toughness: 2898,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  },
  Cheetah: {
    power: 1524,
    precision: 2211,
    toughness: 1524,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  },
  'Sand Lion': {
    power: 1524,
    precision: 2211,
    toughness: 1524,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  },
  'Rock Gazelle': {
    power: 1661,
    precision: 1524,
    toughness: 2898,
    vitality: 3242,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 0
  },
  'White Tiger': {
    power: 1524,
    precision: 2211,
    toughness: 1524,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  },
  Phoenix: {
    power: 1868,
    precision: 2211,
    toughness: 1524,
    vitality: 2898,
    ferocity: 0,
    conditionDamage: 700,
    expertise: 0,
    healingPower: 0
  },
  'Siege Turtle': {
    power: 1524,
    precision: 1524,
    toughness: 2211,
    vitality: 4959,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 0
  },
  'Sky-Chak Striker': {
    power: 1524,
    precision: 2211,
    toughness: 1524,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 400,
    expertise: 0,
    healingPower: 0
  },
  Spinegazer: {
    power: 1868,
    precision: 1524,
    toughness: 2898,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  },
  Warclaw: {
    power: 1524,
    precision: 2211,
    toughness: 1524,
    vitality: 2211,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  },
  'Janthiri Bee': {
    power: 1524,
    precision: 1524,
    toughness: 1524,
    vitality: 3585,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    healingPower: 0
  }
});

/** Returns the selected pet's level-80 base attributes before Ranger traits are inherited. */
export function rangerPetBaseAttributes(petName: string): RangerPetAttributes {
  return PET_BASE_ATTRIBUTES[petName] || DEFAULT_PET_BASE_ATTRIBUTES;
}

/** Natural skill membership and wiki recharge use the same timing lookup for every pet. */
function profile(petName: string, actions: readonly (readonly [SkillId, number])[]): PetAutoProfile {
  const skills = actions.map(([id, cooldown]) => {
    const timing = rangerPetSkillTiming(petName, id);
    if (!timing) throw new Error(`Missing pet skill timing: ${petName} / ${id}`);
    return { id, recovery: timing.recoveryMs / 1000, ...(cooldown ? { cooldown } : {}) };
  });
  return {
    ...(skills[0]!.id === ID.WYVERN_WING_SWIPE ? { weaponStrength: 2615.5 } : {}),
    openingDelay: 0.44,
    basic: skills[0]!,
    specials: skills.slice(1),
    commandRecovery: {}
  };
}

const PET_AUTO_PROFILES: Readonly<Record<string, PetAutoProfile>> = Object.freeze({
  // Untamed commands the specials; other specializations use the shared ready-special scheduler.
  Boar: {
    openingDelay: 0.44,
    basic: { id: ID.PORCINE_JAB, recovery: 1.48 },
    specials: [
      { id: ID.PORCINE_MAUL, recovery: 1.28, cooldown: 10 },
      { id: ID.PORCINE_BRUTAL_CHARGE, recovery: 1.92, cooldown: 24 }
    ],
    commandRecovery: { [ID.FORAGE_ROCK]: 1.24 }
  },
  'Aether Hunter': {
    openingDelay: 0.44,
    basic: { id: ID.AETHER_HUNTER_BITE, recovery: 2.12 },
    specials: [
      { id: ID.AETHER_HUNTER_LUNGE, recovery: 1.56, cooldown: 8 },
      { id: ID.AETHER_HUNTER_LEY_LINE_VORTEX, recovery: 4.16, cooldown: 20 }
    ],
    commandRecovery: { [ID.DIMENSION_BREACH]: 3.04 }
  },
  'Raptor Swiftwing': {
    openingDelay: 0.44,
    basic: { id: ID.RAPTOR_SWIFTWING_CLAW, recovery: 1.68 },
    specials: [
      { id: ID.RAPTOR_SWIFTWING_SAURIAN_MIGHT, recovery: 2.28, cooldown: 10 },
      { id: ID.RAPTOR_SWIFTWING_LEAPING_LIZARD, recovery: 3.2, cooldown: 15 }
    ],
    commandRecovery: { [ID.PIERCING_SHRIEK]: 1.92 }
  },
  Hawk: {
    // The command-controlled log measures cadence; autonomous pets use the existing ready-special priority.
    openingDelay: 0.44,
    basic: { id: ID.BIRD_SLASH, recovery: 2.68 },
    specials: [
      { id: ID.BIRD_SWOOP, recovery: 2.36, cooldown: 8 },
      { id: ID.QUICKENING_SCREECH_PET, recovery: 2.36, cooldown: 20 }
    ],
    commandRecovery: { [ID.LACERATING_SLASH]: 2.72 }
  },
  Wallow: {
    openingDelay: 0.44,
    basic: { id: ID.VAMPIRIC_BITE, recovery: 1.48 },
    specials: [
      { id: ID.WALLOW_MAUL, recovery: 2.64, cooldown: 12 },
      { id: ID.UNDEAD_PLAGUE_PET, recovery: 1.28, cooldown: 20 }
    ],
    commandRecovery: { [ID.BLOODTHIRSTY_CHARGE]: 3.88 }
  },
  'Carrion Devourer': {
    openingDelay: 0.44,
    openingRecoveryDelay: 0.8,
    basic: { id: ID.TWIN_DARTS, recovery: 1.88 },
    specials: [{ id: ID.PET_TAIL_LASH, recovery: 2.4, cooldown: 20 }],
    commandRecovery: { [ID.POISONOUS_CLOUD]: 2.08 }
  },
  'Fanged Iboga': {
    openingDelay: 0.44,
    quicknessOpeningRecoveryDelay: 0.8,
    basic: { id: ID.CONSUMING_BITE, recovery: 1.8 },
    // The Iboga casts Narcotic Spores and Crippling Anguish on its own; Fang Grapple is its Beast command and fires
    // only when the Ranger issues it. Spores never repeated sooner than their recharge plus cast in the unbuffed
    // pet-only log, so the autonomous interval carries both. Crippling Anguish recharges in 10 s but the pet delays
    // it behind other actions; this interval reproduces the 14.8 s average of that 675 s log.
    specials: [
      { id: ID.NARCOTIC_SPORES_PET, recovery: 1.56, cooldown: 16.5 },
      { id: ID.CRIPPLING_ANGUISH_PET, recovery: 1.8, cooldown: 14 }
    ],
    commandRecovery: { [ID.FANG_GRAPPLE]: 2.4 }
  },
  Tiger: {
    ignoresAlacrity: true,
    openingDelay: 0.48,
    opening: { id: ID.FELINE_BITE, recovery: RANGER_PET_SKILL_TIMINGS[ID.FELINE_BITE]!.recoveryMs / 1000, cooldown: 8 },
    basic: { id: ID.FELINE_SLASH, recovery: RANGER_PET_SKILL_TIMINGS[ID.FELINE_SLASH]!.recoveryMs / 1000 },
    specials: [
      { id: ID.FELINE_MAUL, recovery: RANGER_PET_SKILL_TIMINGS[ID.FELINE_MAUL]!.recoveryMs / 1000, cooldown: 16 },
      { id: ID.FELINE_BITE, recovery: RANGER_PET_SKILL_TIMINGS[ID.FELINE_BITE]!.recoveryMs / 1000, cooldown: 8 }
    ],
    commandRecovery: { [ID.FURIOUS_POUNCE]: RANGER_PET_SKILL_TIMINGS[ID.FURIOUS_POUNCE]!.recoveryMs / 1000 }
  },
  Jacaranda: {
    openingDelay: 0.44,
    // Root Slap repeats every 1.64 s in the unbuffed pet-only and benchmark logs.
    basic: { id: ID.JACARANDA_ROOT_SLAP, recovery: 1.64 },
    // Damage-only AI has no healing demand; Photosynthesize remains available to explicit pet commands.
    // Call Lightning shares the 12 s recharge an Untamed command shows (9.6 s with Pack Alpha).
    specials: [{ id: ID.JACARANDA_CALL_LIGHTNING, recovery: 1.48, cooldown: 12 }],
    commandRecovery: { [ID.JACARANDAS_EMBRACE]: 1.48 }
  },
  'Jungle Stalker': profile('Jungle Stalker', [
    [ID.FELINE_SLASH, 0],
    [ID.FELINE_BITE, 8],
    [ID.FELINE_MAUL, 16]
  ]),
  Lynx: profile('Lynx', [
    [ID.FELINE_SLASH, 0],
    [ID.FELINE_BITE, 8],
    [ID.FELINE_MAUL, 16]
  ]),
  'Krytan Drakehound': profile('Krytan Drakehound', [
    [ID.CANINE_BITE, 0],
    [ID.CANINE_CRIPPLING_LEAP, 10],
    [ID.CANINE_BRUTAL_CHARGE, 18]
  ]),
  'Brown Bear': profile('Brown Bear', [[ID.URSINE_SLASH, 0]]),
  'Salamander Drake': profile('Salamander Drake', [
    [ID.DRAKE_BITE, 0],
    [ID.DRAKE_TAIL_SWIPE, 16]
  ]),
  'Alpine Wolf': profile('Alpine Wolf', [
    [ID.CANINE_BITE, 0],
    [ID.CANINE_CRIPPLING_LEAP, 10],
    [ID.CANINE_BRUTAL_CHARGE, 18]
  ]),
  'Snow Leopard': profile('Snow Leopard', [
    [ID.FELINE_SLASH, 0],
    [ID.FELINE_BITE, 8],
    [ID.FELINE_MAUL, 16]
  ]),
  Raven: profile('Raven', [
    [ID.BIRD_SLASH, 0],
    [ID.BIRD_SWOOP, 8],
    [ID.QUICKENING_SCREECH_PET, 20]
  ]),
  Jaguar: profile('Jaguar', [
    [ID.FELINE_SLASH, 0],
    [ID.FELINE_BITE, 8],
    [ID.FELINE_MAUL, 16]
  ]),
  'Marsh Drake': profile('Marsh Drake', [
    [ID.DRAKE_BITE, 0],
    [ID.DRAKE_TAIL_SWIPE, 16]
  ]),
  'Blue Moa': profile('Blue Moa', [
    [ID.MOA_PECK, 0],
    [ID.MOA_FRENZIED_ATTACK, 20]
  ]),
  'Pink Moa': profile('Pink Moa', [
    [ID.MOA_PECK, 0],
    [ID.MOA_FRENZIED_ATTACK, 20]
  ]),
  'Black Moa': profile('Black Moa', [
    [ID.MOA_PECK, 0],
    [ID.MOA_FRENZIED_ATTACK, 20]
  ]),
  'Red Moa': profile('Red Moa', [
    [ID.MOA_PECK, 0],
    [ID.MOA_FRENZIED_ATTACK, 20]
  ]),
  'Ice Drake': profile('Ice Drake', [
    [ID.DRAKE_BITE, 0],
    [ID.DRAKE_TAIL_SWIPE, 16]
  ]),
  'River Drake': profile('River Drake', [
    [ID.DRAKE_BITE, 0],
    [ID.DRAKE_TAIL_SWIPE, 16]
  ]),
  Murellow: profile('Murellow', [[ID.URSINE_SLASH, 0]]),
  'Fern Hound': profile('Fern Hound', [
    [ID.CANINE_BITE, 0],
    [ID.CANINE_CRIPPLING_LEAP, 10],
    [ID.CANINE_BRUTAL_CHARGE, 18]
  ]),
  'Black Bear': profile('Black Bear', [[ID.URSINE_SLASH, 0]]),
  'Polar Bear': profile('Polar Bear', [[ID.URSINE_SLASH, 0]]),
  Arctodus: profile('Arctodus', [[ID.URSINE_SLASH, 0]]),
  'Whiptail Devourer': profile('Whiptail Devourer', [[ID.TWIN_DARTS, 0]]),
  'Lashtail Devourer': profile('Lashtail Devourer', [[ID.TWIN_DARTS, 0]]),
  Hyena: profile('Hyena', [
    [ID.CANINE_BITE, 0],
    [ID.CANINE_CRIPPLING_LEAP, 10],
    [ID.CANINE_BRUTAL_CHARGE, 18]
  ]),
  Wolf: profile('Wolf', [
    [ID.CANINE_BITE, 0],
    [ID.CANINE_CRIPPLING_LEAP, 10],
    [ID.CANINE_BRUTAL_CHARGE, 18]
  ]),
  Owl: profile('Owl', [
    [ID.BIRD_SLASH, 0],
    [ID.BIRD_SWOOP, 8],
    [ID.QUICKENING_SCREECH_PET, 20]
  ]),
  Eagle: profile('Eagle', [
    [ID.BIRD_SLASH, 0],
    [ID.BIRD_SWOOP, 8],
    [ID.QUICKENING_SCREECH_PET, 20]
  ]),
  'White Raven': profile('White Raven', [
    [ID.BIRD_SLASH, 0],
    [ID.BIRD_SWOOP, 8],
    [ID.QUICKENING_SCREECH_PET, 20]
  ]),
  'Forest Spider': profile('Forest Spider', [
    [ID.SPIT, 0],
    [ID.SPIDER_POISON_GAS, 15],
    [ID.SPIDER_ENTANGLING_WEB, 20]
  ]),
  'Jungle Spider': profile('Jungle Spider', [
    [ID.SPIT, 0],
    [ID.SPIDER_POISON_GAS, 15],
    [ID.SPIDER_ENTANGLING_WEB, 20]
  ]),
  'Cave Spider': profile('Cave Spider', [
    [ID.SPIT, 0],
    [ID.SPIDER_POISON_GAS, 15],
    [ID.SPIDER_ENTANGLING_WEB, 20]
  ]),
  'Black Widow Spider': profile('Black Widow Spider', [
    [ID.SPIT, 0],
    [ID.SPIDER_POISON_GAS, 15],
    [ID.SPIDER_ENTANGLING_WEB, 20]
  ]),
  Warthog: profile('Warthog', [
    [ID.PORCINE_JAB, 0],
    [ID.PORCINE_MAUL, 10],
    [ID.PORCINE_BRUTAL_CHARGE, 24]
  ]),
  Siamoth: profile('Siamoth', [
    [ID.PORCINE_JAB, 0],
    [ID.PORCINE_MAUL, 10],
    [ID.PORCINE_BRUTAL_CHARGE, 24]
  ]),
  Pig: profile('Pig', [
    [ID.PORCINE_JAB, 0],
    [ID.PORCINE_MAUL, 10],
    [ID.PORCINE_BRUTAL_CHARGE, 24]
  ]),
  'Reef Drake': profile('Reef Drake', [
    [ID.DRAKE_BITE, 0],
    [ID.DRAKE_TAIL_SWIPE, 16]
  ]),
  Smokescale: profile('Smokescale', [
    [ID.SMOKESCALE_BITE, 0.25],
    [ID.SMOKESCALE_TAKEDOWN, 10],
    [ID.SMOKESCALE_SMOKE_ASSAULT, 20]
  ]),
  'Electric Wyvern': profile('Electric Wyvern', [
    [ID.WYVERN_WING_SWIPE, 0],
    [ID.WYVERN_TAIL_LASH, 12],
    [ID.WYVERN_WING_BUFFET, 25]
  ]),
  'Fire Wyvern': profile('Fire Wyvern', [
    [ID.WYVERN_WING_SWIPE, 0],
    [ID.WYVERN_TAIL_LASH, 12],
    [ID.WYVERN_WING_BUFFET, 25]
  ]),
  Bristleback: profile('Bristleback', [
    [ID.BRISTLEBACK_SPIKE_SHOOT, 0],
    [ID.BRISTLEBACK_SHARPEN_SPINES, 20],
    [ID.BRISTLEBACK_RAIN_OF_SPIKES, 18]
  ]),
  Cheetah: profile('Cheetah', [
    [ID.FELINE_SLASH, 0],
    [ID.FELINE_BITE, 8],
    [ID.FELINE_MAUL, 16]
  ]),
  'Sand Lion': profile('Sand Lion', [
    [ID.FELINE_SLASH, 0],
    [ID.FELINE_BITE, 8],
    [ID.FELINE_MAUL, 16]
  ]),
  'Rock Gazelle': profile('Rock Gazelle', [
    [ID.ROCK_GAZELLE_HEADBUTT, 0],
    [ID.ROCK_GAZELLE_KICK, 8],
    [ID.ROCK_GAZELLE_CHARGE, 15]
  ]),
  'White Tiger': profile('White Tiger', [
    [ID.FELINE_SLASH, 0],
    [ID.FELINE_BITE, 8],
    [ID.FELINE_PHASE_POUNCE, 16]
  ]),
  Phoenix: profile('Phoenix', [
    [ID.PHOENIX_WICKED_BITE, 0],
    [ID.PHOENIX_DASH, 20],
    [ID.PHOENIX_WING_BUFFET, 20]
  ]),
  'Siege Turtle': profile('Siege Turtle', [
    [ID.TURTLE_JADE_CANNON, 0],
    [ID.TURTLE_HEAVY_SHOT, 20],
    [ID.TURTLE_SLAM, 25]
  ]),
  'Sky-Chak Striker': profile('Sky-Chak Striker', [
    [ID.CHAK_UNLEASH_ENERGY, 0],
    [ID.CHAK_ELECTROCUTE, 12],
    [ID.CHAK_SPIT_GOOP, 20]
  ]),
  Spinegazer: profile('Spinegazer', [
    [ID.SPINEGAZER_EVIL_EYE, 0],
    [ID.SPINEGAZER_TORMENTING_VISIONS, 20],
    [ID.SPINEGAZER_STARING_VOID, 15]
  ]),
  Warclaw: profile('Warclaw', [
    [ID.WARCLAW_SLASH, 0],
    [ID.WARCLAW_BATTLE_MAUL, 15],
    [ID.WARCLAW_BOP, 18]
  ]),
  'Janthiri Bee': profile('Janthiri Bee', [
    [ID.JANTHIRI_BEE_NIBBLE, 0],
    [ID.JANTHIRI_BEE_BUMBLE, 24],
    [ID.JANTHIRI_BEE_STINGING_SORROW, 20]
  ])
});

export function rangerPetAutoProfile(petName: string): PetAutoProfile | null {
  return PET_AUTO_PROFILES[petName] || null;
}
