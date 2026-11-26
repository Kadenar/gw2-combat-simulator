import type { SkillId } from '#gw2/platform/skills/types.js';
import { rangerPetSkillTiming } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { isRangerPetName, rangerPetByName } from '#gw2/professions/ranger/data/pets.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import type { RangerPetDefinition } from '#gw2/professions/ranger/types.js';

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

// Pets share level-80 attributes by family, so supporting another family member is a data-only change. Families
// absent here (Fanged Iboga, River Otter) use the defaults above.
const FAMILY_BASE_ATTRIBUTES: Readonly<Record<string, Partial<RangerPetAttributes>>> = Object.freeze({
  feline: { precision: 2211, toughness: 1524, vitality: 2211 },
  porcine: { precision: 1180, toughness: 2211, vitality: 3585, conditionDamage: 700, healingPower: 600 },
  canine: { power: 1868, toughness: 2211, vitality: 2211, conditionDamage: 400 },
  ursine: { toughness: 2211, vitality: 4959, conditionDamage: 400, healingPower: 1200 },
  devourer: { toughness: 2898, vitality: 2211 },
  drake: { power: 1868, toughness: 2211, vitality: 3585, conditionDamage: 700, healingPower: 600 },
  avian: { precision: 2211, toughness: 1524, vitality: 2211, conditionDamage: 700 },
  moa: { toughness: 1524, vitality: 3585, conditionDamage: 400, healingPower: 1200 },
  spider: { toughness: 1524, vitality: 3585 },
  smokescale: { toughness: 2211, vitality: 3585, conditionDamage: 400 },
  wyvern: { power: 1868, toughness: 2211, vitality: 2898, conditionDamage: 700 },
  bristleback: { power: 1868, toughness: 2898, vitality: 2211 },
  jacaranda: { power: 1868, toughness: 2211, vitality: 2211, conditionDamage: 400, healingPower: 1200 },
  'rock gazelle': { power: 1661, toughness: 2898, vitality: 3242, conditionDamage: 400 },
  phoenix: { power: 1868, precision: 2211, toughness: 1524, vitality: 2898, conditionDamage: 700 },
  turtle: { toughness: 2211, vitality: 4959, conditionDamage: 400 },
  'aether hunter': { power: 1868, toughness: 1524, vitality: 3585, conditionDamage: 1800 },
  chak: { precision: 2211, toughness: 1524, vitality: 2211, conditionDamage: 400 },
  spinegazer: { power: 1868, toughness: 2898, vitality: 2211 },
  warclaw: { precision: 2211, toughness: 1524, vitality: 2211 },
  'janthiri bee': { toughness: 1524, vitality: 3585 },
  'raptor swiftwing': { power: 1868, precision: 2211, toughness: 1524, vitality: 2898, conditionDamage: 1500 }
});

// Individual pets whose attributes differ from their family.
const PET_BASE_ATTRIBUTE_OVERRIDES: Readonly<Record<string, Partial<RangerPetAttributes>>> = Object.freeze({
  // The October pet logs directly confirm this independent condition baseline.
  Boar: { conditionDamage: 1500 },
  Wallow: { precision: 1524, vitality: 2898, healingPower: 0 }
});

/** Returns the selected pet's level-80 base attributes before Ranger traits are inherited. */
export function rangerPetBaseAttributes(petName: string): RangerPetAttributes {
  const family = isRangerPetName(petName) ? rangerPetByName(petName).family : '';
  return {
    ...DEFAULT_PET_BASE_ATTRIBUTES,
    ...FAMILY_BASE_ATTRIBUTES[family],
    ...PET_BASE_ATTRIBUTE_OVERRIDES[petName]
  };
}

/** Measured skills take their recovery from the timing table; recharge stays catalog-owned. */
function measured(petName: string, id: SkillId): PetAutoSkill {
  const timing = rangerPetSkillTiming(petName, id);

  if (!timing) throw new Error(`Missing pet skill timing: ${petName} / ${id}`);

  return { id, recovery: timing.recoveryMs / 1000 };
}

/** Keep the remaining catalog order when a pet prefers one special over the others. */
function preferSpecial(specials: readonly SkillId[], preferred: SkillId): readonly SkillId[] {
  return specials.includes(preferred) ? [preferred, ...specials.filter((id) => id !== preferred)] : specials;
}

/** Use each pet's natural attacks in catalog order unless its AI has a different priority or recovery. */
function buildPetAutoProfile(pet: RangerPetDefinition): PetAutoProfile | null {
  const basicId = pet.basicSkillId;

  if (basicId === null) return null;

  const profile = (
    specials = pet.specialSkillIds,
    recovery: Readonly<Partial<Record<SkillId, number>>> = {}
  ): PetAutoProfile => {
    const action = (id: SkillId): PetAutoSkill => {
      const seconds = recovery[id];
      return seconds === undefined ? measured(pet.name, id) : { id, recovery: seconds };
    };

    return {
      ...(pet.family === 'wyvern' ? { weaponStrength: 2615.5 } : {}),
      openingDelay: 0.44,
      basic: action(basicId),
      specials: specials.map(action),
      commandRecovery: {}
    };
  };

  switch (pet.name) {
    case 'Tiger': {
      const tiger = profile(preferSpecial(pet.specialSkillIds, ID.FELINE_MAUL));
      return {
        ...tiger,
        opening: tiger.specials.find((skill) => skill.id === ID.FELINE_BITE) ?? tiger.basic,
        openingDelay: 0.48,
        ignoresAlacrity: true
      };
    }

    case 'Carrion Devourer':
      return {
        ...profile(pet.specialSkillIds, { [ID.TWIN_DARTS]: 1.88, [ID.PET_TAIL_LASH]: 2.4 }),
        openingRecoveryDelay: 0.8,
        commandRecovery: { [ID.POISONOUS_CLOUD]: 2.08 }
      };
    case 'Fanged Iboga':
      return {
        ...profile(preferSpecial(pet.specialSkillIds, ID.NARCOTIC_SPORES_PET), {
          [ID.CONSUMING_BITE]: 1.8,
          [ID.NARCOTIC_SPORES_PET]: 1.56,
          [ID.CRIPPLING_ANGUISH_PET]: 1.8
        }),
        quicknessOpeningRecoveryDelay: 0.8,
        commandRecovery: { [ID.FANG_GRAPPLE]: 2.4 }
      };
    case 'Jacaranda':
      // The damage-only AI skips Photosynthesize. Untamed can still command the heal.
      return {
        ...profile(
          pet.specialSkillIds.filter((id) => id !== ID.JACARANDA_PHOTOSYNTHESIZE),
          {
            [ID.JACARANDA_ROOT_SLAP]: 1.64,
            [ID.JACARANDA_CALL_LIGHTNING]: 1.48
          }
        ),
        commandRecovery: { [ID.JACARANDAS_EMBRACE]: 1.48 }
      };
    default:
      return profile();
  }
}

const PET_AUTO_PROFILES = new Map(RANGER_PETS.map((pet) => [pet.name, buildPetAutoProfile(pet)]));

export function rangerPetAutoProfile(petName: string): PetAutoProfile | null {
  return PET_AUTO_PROFILES.get(petName) ?? null;
}
