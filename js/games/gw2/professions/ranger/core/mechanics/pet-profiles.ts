import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

interface RangerPetAttributes {
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
  }
});

/** Returns the selected pet's level-80 base attributes before Ranger traits are inherited. */
export function rangerPetBaseAttributes(petName: string): RangerPetAttributes {
  return PET_BASE_ATTRIBUTES[petName] || DEFAULT_PET_BASE_ATTRIBUTES;
}

// Measured pet timelines override the generic action-rate model; recovery includes the next-action gap.
// Tiger, Wallow, and Hawk have measured unbuffed timelines; Wallow/Hawk Quickness uses standard action-rate scaling.
export const RANGER_PET_SKILL_TIMINGS: Readonly<
  Record<
    string,
    {
      castTimeMs: number;
      quicknessCastTimeMs: number;
      recoveryMs: number;
      quicknessRecoveryMs: number;
      unbuffedImpactMs: Readonly<Record<number, number>>;
    }
  >
> = Object.freeze({
  // 20260930-154237: stop records include the full animation; impacts occur well before the next AI decision.
  [ID.BIRD_SLASH]: {
    castTimeMs: 2600,
    quicknessCastTimeMs: 1760,
    recoveryMs: 2680,
    quicknessRecoveryMs: 1800,
    unbuffedImpactMs: { 280: 400, 320: 480 }
  },
  [ID.LACERATING_SLASH]: {
    castTimeMs: 2600,
    quicknessCastTimeMs: 1760,
    recoveryMs: 2720,
    quicknessRecoveryMs: 1840,
    unbuffedImpactMs: { 280: 400, 320: 480 }
  },
  [ID.BIRD_SWOOP]: {
    castTimeMs: 2280,
    quicknessCastTimeMs: 1520,
    recoveryMs: 2360,
    quicknessRecoveryMs: 1600,
    unbuffedImpactMs: { 520: 760 }
  },
  [ID.QUICKENING_SCREECH_PET]: {
    castTimeMs: 2280,
    quicknessCastTimeMs: 1520,
    recoveryMs: 2360,
    quicknessRecoveryMs: 1600,
    unbuffedImpactMs: { 520: 760 }
  },
  // The focused Wallow log separates early impacts from animation stops and the next AI decision.
  [ID.VAMPIRIC_BITE]: {
    castTimeMs: 1400,
    quicknessCastTimeMs: 960,
    recoveryMs: 1480,
    quicknessRecoveryMs: 1000,
    unbuffedImpactMs: { 240: 360 }
  },
  [ID.WALLOW_MAUL]: {
    castTimeMs: 2560,
    quicknessCastTimeMs: 1720,
    recoveryMs: 2640,
    quicknessRecoveryMs: 1760,
    unbuffedImpactMs: { 680: 1000 }
  },
  [ID.UNDEAD_PLAGUE_PET]: {
    castTimeMs: 1200,
    quicknessCastTimeMs: 800,
    recoveryMs: 1280,
    quicknessRecoveryMs: 880,
    // Quickness changes the windup; the emitted cloud still pulses once per second.
    unbuffedImpactMs: { 640: 920, 1640: 1920, 2640: 2920, 3640: 3920, 4640: 4920 }
  },
  [ID.BLOODTHIRSTY_CHARGE]: {
    castTimeMs: 2480,
    quicknessCastTimeMs: 1680,
    recoveryMs: 3880,
    quicknessRecoveryMs: 2600,
    unbuffedImpactMs: { 400: 560 }
  },
  [ID.FELINE_SLASH]: {
    castTimeMs: 1200,
    quicknessCastTimeMs: 840,
    recoveryMs: 1280,
    quicknessRecoveryMs: 920,
    unbuffedImpactMs: { 280: 400 }
  },
  [ID.FELINE_BITE]: {
    castTimeMs: 1080,
    quicknessCastTimeMs: 760,
    recoveryMs: 1200,
    quicknessRecoveryMs: 840,
    unbuffedImpactMs: { 400: 560 }
  },
  [ID.FELINE_MAUL]: {
    castTimeMs: 1200,
    quicknessCastTimeMs: 880,
    recoveryMs: 1280,
    quicknessRecoveryMs: 960,
    unbuffedImpactMs: { 360: 520, 560: 760 }
  },
  [ID.FURIOUS_POUNCE]: {
    // The input completes at impact; the pet's separate recovery includes the rest of its animation.
    castTimeMs: 1560,
    quicknessCastTimeMs: 1080,
    // Unquickened log activations resume attacks at 2600 ms; impact remains earlier at 1560 ms.
    recoveryMs: 2600,
    quicknessRecoveryMs: 1760,
    unbuffedImpactMs: { 1080: 1560 }
  }
});

const PET_AUTO_PROFILES: Readonly<Record<string, PetAutoProfile>> = Object.freeze({
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
