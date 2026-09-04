import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

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
  readonly openingDelay: number;
  readonly openingRecoveryDelay?: number;
  readonly quicknessOpeningRecoveryDelay?: number;
  readonly opening?: PetAutoSkill;
  readonly basic: PetAutoSkill;
  readonly specials: readonly PetAutoSkill[];
  readonly commandRecovery: Readonly<Record<string, number>>;
  readonly ignoresAlacrity?: boolean;
}

export const RANGER_PET_STRIKE_SCALING = Object.freeze({
  basePower: 1524,
  basePrecision: 1524,
  baseFerocity: 0,
  baseConditionDamage: 1000,
  baseExpertise: 0,
  criticalChance: (1524 - 1000) / 2100,
  criticalDamage: 1.5,
  damagePerCoefficient: (2880 * 1524) / 2597
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
  'Carrion Devourer': {
    ...DEFAULT_PET_BASE_ATTRIBUTES,
    toughness: 2898,
    vitality: 2211
  },
  'Fanged Iboga': DEFAULT_PET_BASE_ATTRIBUTES,
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
  Jacaranda: {
    ...DEFAULT_PET_BASE_ATTRIBUTES,
    power: 1868,
    toughness: 2211,
    vitality: 2211,
    conditionDamage: 400,
    healingPower: 1200
  }
});

/** Returns the selected pet's level-80 base attributes before Ranger traits are inherited. */
export function rangerPetBaseAttributes(petName: string): RangerPetAttributes {
  return PET_BASE_ATTRIBUTES[petName] || DEFAULT_PET_BASE_ATTRIBUTES;
}

const PET_AUTO_PROFILES: Readonly<Record<string, PetAutoProfile>> = Object.freeze({
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
    basic: { id: ID.CONSUMING_BITE, recovery: 1.87 },
    specials: [
      { id: ID.CRIPPLING_ANGUISH_PET, recovery: 1.8, cooldown: 20 },
      { id: ID.FANG_GRAPPLE, recovery: 2.4, cooldown: 20 }
    ],
    commandRecovery: { [ID.NARCOTIC_SPORES_PET]: 1.84 }
  },
  Tiger: {
    ignoresAlacrity: true,
    openingDelay: 0.48,
    opening: { id: ID.FELINE_BITE, recovery: 1.32, cooldown: 8 },
    basic: { id: ID.FELINE_SLASH, recovery: 1.35 },
    specials: [
      { id: ID.FELINE_MAUL, recovery: 1.44, cooldown: 16 },
      { id: ID.FELINE_BITE, recovery: 1.32, cooldown: 8 }
    ],
    commandRecovery: { [ID.FURIOUS_POUNCE]: 1.76 }
  },
  Jacaranda: {
    openingDelay: 0.44,
    basic: { id: ID.JACARANDA_ROOT_SLAP, recovery: 1.6 },
    specials: [
      { id: ID.JACARANDA_CALL_LIGHTNING, recovery: 1.48, cooldown: 15 },
      { id: ID.PHOTOSYNTHESIZE, recovery: 1.48, cooldown: 20 }
    ],
    commandRecovery: { [ID.JACARANDAS_EMBRACE]: 1.48 }
  }
});

export function rangerPetAutoProfile(petName: string): PetAutoProfile | null {
  return PET_AUTO_PROFILES[petName] || null;
}
