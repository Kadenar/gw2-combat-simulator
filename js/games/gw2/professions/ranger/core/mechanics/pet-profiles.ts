import { rangerPetSkillTiming } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { isRangerPetName, rangerPetByName } from '#gw2/professions/ranger/data/pets.js';
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

/** Natural skill priority: the basic attack first, then specials in the order the AI prefers them when ready. */
function profile(petName: string, actions: readonly SkillId[]): PetAutoProfile {
  const skills = actions.map((id) => measured(petName, id));
  return {
    ...(skills[0]!.id === ID.WYVERN_WING_SWIPE ? { weaponStrength: 2615.5 } : {}),
    openingDelay: 0.44,
    basic: skills[0]!,
    specials: skills.slice(1),
    commandRecovery: {}
  };
}

// Measured pets derive recovery from the timing table, including their commanded skills. Only unmeasured attacks
// and commands declare a recovery here.
const PET_AUTO_PROFILES: Readonly<Record<string, PetAutoProfile>> = Object.freeze({
  // Untamed commands the specials; other specializations use the shared ready-special scheduler.
  Boar: profile('Boar', [ID.PORCINE_JAB, ID.PORCINE_MAUL, ID.PORCINE_BRUTAL_CHARGE]),
  'Aether Hunter': profile('Aether Hunter', [
    ID.AETHER_HUNTER_BITE,
    ID.AETHER_HUNTER_LUNGE,
    ID.AETHER_HUNTER_LEY_LINE_VORTEX
  ]),
  'Raptor Swiftwing': profile('Raptor Swiftwing', [
    ID.RAPTOR_SWIFTWING_CLAW,
    ID.RAPTOR_SWIFTWING_SAURIAN_MIGHT,
    ID.RAPTOR_SWIFTWING_LEAPING_LIZARD
  ]),
  // The command-controlled log measures cadence; autonomous pets use the existing ready-special priority.
  Hawk: profile('Hawk', [ID.BIRD_SLASH, ID.BIRD_SWOOP, ID.QUICKENING_SCREECH_PET]),
  Wallow: profile('Wallow', [ID.VAMPIRIC_BITE, ID.WALLOW_MAUL, ID.UNDEAD_PLAGUE_PET]),
  'Carrion Devourer': {
    openingDelay: 0.44,
    openingRecoveryDelay: 0.8,
    basic: { id: ID.TWIN_DARTS, recovery: 1.88 },
    specials: [{ id: ID.PET_TAIL_LASH, recovery: 2.4 }],
    commandRecovery: { [ID.POISONOUS_CLOUD]: 2.08 }
  },
  'Fanged Iboga': {
    openingDelay: 0.44,
    quicknessOpeningRecoveryDelay: 0.8,
    basic: { id: ID.CONSUMING_BITE, recovery: 1.8 },
    // Autonomous recharge exceptions live with the Iboga skills. Fang Grapple remains an explicit command.
    specials: [
      { id: ID.NARCOTIC_SPORES_PET, recovery: 1.56 },
      { id: ID.CRIPPLING_ANGUISH_PET, recovery: 1.8 }
    ],
    commandRecovery: { [ID.FANG_GRAPPLE]: 2.4 }
  },
  // The Tiger opens with Bite and ignores Alacrity on its autonomous recharges.
  Tiger: {
    ...profile('Tiger', [ID.FELINE_SLASH, ID.FELINE_MAUL, ID.FELINE_BITE]),
    ignoresAlacrity: true,
    openingDelay: 0.48,
    opening: measured('Tiger', ID.FELINE_BITE)
  },
  Jacaranda: {
    openingDelay: 0.44,
    // Root Slap repeats every 1.64 s in the unbuffed pet-only and benchmark logs.
    basic: { id: ID.JACARANDA_ROOT_SLAP, recovery: 1.64 },
    // Damage-only AI has no healing demand; Photosynthesize remains available to explicit pet commands.
    // Call Lightning shares the 12 s recharge an Untamed command shows (9.6 s with Pack Alpha).
    specials: [{ id: ID.JACARANDA_CALL_LIGHTNING, recovery: 1.48 }],
    commandRecovery: { [ID.JACARANDAS_EMBRACE]: 1.48 }
  },
  'Jungle Stalker': profile('Jungle Stalker', [ID.FELINE_SLASH, ID.FELINE_BITE, ID.FELINE_MAUL]),
  Lynx: profile('Lynx', [ID.FELINE_SLASH, ID.FELINE_BITE, ID.FELINE_MAUL]),
  'Krytan Drakehound': profile('Krytan Drakehound', [
    ID.CANINE_BITE,
    ID.CANINE_CRIPPLING_LEAP,
    ID.CANINE_BRUTAL_CHARGE
  ]),
  'Brown Bear': profile('Brown Bear', [ID.URSINE_SLASH]),
  'Salamander Drake': profile('Salamander Drake', [ID.DRAKE_BITE, ID.DRAKE_TAIL_SWIPE]),
  'Alpine Wolf': profile('Alpine Wolf', [ID.CANINE_BITE, ID.CANINE_CRIPPLING_LEAP, ID.CANINE_BRUTAL_CHARGE]),
  'Snow Leopard': profile('Snow Leopard', [ID.FELINE_SLASH, ID.FELINE_BITE, ID.FELINE_MAUL]),
  Raven: profile('Raven', [ID.BIRD_SLASH, ID.BIRD_SWOOP, ID.QUICKENING_SCREECH_PET]),
  Jaguar: profile('Jaguar', [ID.FELINE_SLASH, ID.FELINE_BITE, ID.FELINE_MAUL]),
  'Marsh Drake': profile('Marsh Drake', [ID.DRAKE_BITE, ID.DRAKE_TAIL_SWIPE]),
  'Blue Moa': profile('Blue Moa', [ID.MOA_PECK, ID.MOA_FRENZIED_ATTACK]),
  'Pink Moa': profile('Pink Moa', [ID.MOA_PECK, ID.MOA_FRENZIED_ATTACK]),
  'Black Moa': profile('Black Moa', [ID.MOA_PECK, ID.MOA_FRENZIED_ATTACK]),
  'Red Moa': profile('Red Moa', [ID.MOA_PECK, ID.MOA_FRENZIED_ATTACK]),
  'Ice Drake': profile('Ice Drake', [ID.DRAKE_BITE, ID.DRAKE_TAIL_SWIPE]),
  'River Drake': profile('River Drake', [ID.DRAKE_BITE, ID.DRAKE_TAIL_SWIPE]),
  Murellow: profile('Murellow', [ID.URSINE_SLASH]),
  'Fern Hound': profile('Fern Hound', [ID.CANINE_BITE, ID.CANINE_CRIPPLING_LEAP, ID.CANINE_BRUTAL_CHARGE]),
  'Black Bear': profile('Black Bear', [ID.URSINE_SLASH]),
  'Polar Bear': profile('Polar Bear', [ID.URSINE_SLASH]),
  Arctodus: profile('Arctodus', [ID.URSINE_SLASH]),
  'Whiptail Devourer': profile('Whiptail Devourer', [ID.TWIN_DARTS]),
  'Lashtail Devourer': profile('Lashtail Devourer', [ID.TWIN_DARTS]),
  Hyena: profile('Hyena', [ID.CANINE_BITE, ID.CANINE_CRIPPLING_LEAP, ID.CANINE_BRUTAL_CHARGE]),
  Wolf: profile('Wolf', [ID.CANINE_BITE, ID.CANINE_CRIPPLING_LEAP, ID.CANINE_BRUTAL_CHARGE]),
  Owl: profile('Owl', [ID.BIRD_SLASH, ID.BIRD_SWOOP, ID.QUICKENING_SCREECH_PET]),
  Eagle: profile('Eagle', [ID.BIRD_SLASH, ID.BIRD_SWOOP, ID.QUICKENING_SCREECH_PET]),
  'White Raven': profile('White Raven', [ID.BIRD_SLASH, ID.BIRD_SWOOP, ID.QUICKENING_SCREECH_PET]),
  'Forest Spider': profile('Forest Spider', [ID.SPIT, ID.SPIDER_POISON_GAS, ID.SPIDER_ENTANGLING_WEB]),
  'Jungle Spider': profile('Jungle Spider', [ID.SPIT, ID.SPIDER_POISON_GAS, ID.SPIDER_ENTANGLING_WEB]),
  'Cave Spider': profile('Cave Spider', [ID.SPIT, ID.SPIDER_POISON_GAS, ID.SPIDER_ENTANGLING_WEB]),
  'Black Widow Spider': profile('Black Widow Spider', [ID.SPIT, ID.SPIDER_POISON_GAS, ID.SPIDER_ENTANGLING_WEB]),
  Warthog: profile('Warthog', [ID.PORCINE_JAB, ID.PORCINE_MAUL, ID.PORCINE_BRUTAL_CHARGE]),
  Siamoth: profile('Siamoth', [ID.PORCINE_JAB, ID.PORCINE_MAUL, ID.PORCINE_BRUTAL_CHARGE]),
  Pig: profile('Pig', [ID.PORCINE_JAB, ID.PORCINE_MAUL, ID.PORCINE_BRUTAL_CHARGE]),
  'Reef Drake': profile('Reef Drake', [ID.DRAKE_BITE, ID.DRAKE_TAIL_SWIPE]),
  Smokescale: profile('Smokescale', [ID.SMOKESCALE_BITE, ID.SMOKESCALE_TAKEDOWN, ID.SMOKESCALE_SMOKE_ASSAULT]),
  'Electric Wyvern': profile('Electric Wyvern', [ID.WYVERN_WING_SWIPE, ID.WYVERN_TAIL_LASH, ID.WYVERN_WING_BUFFET]),
  'Fire Wyvern': profile('Fire Wyvern', [ID.WYVERN_WING_SWIPE, ID.WYVERN_TAIL_LASH, ID.WYVERN_WING_BUFFET]),
  Bristleback: profile('Bristleback', [
    ID.BRISTLEBACK_SPIKE_SHOOT,
    ID.BRISTLEBACK_SHARPEN_SPINES,
    ID.BRISTLEBACK_RAIN_OF_SPIKES
  ]),
  Cheetah: profile('Cheetah', [ID.FELINE_SLASH, ID.FELINE_BITE, ID.FELINE_MAUL]),
  'Sand Lion': profile('Sand Lion', [ID.FELINE_SLASH, ID.FELINE_BITE, ID.FELINE_MAUL]),
  'Rock Gazelle': profile('Rock Gazelle', [ID.ROCK_GAZELLE_HEADBUTT, ID.ROCK_GAZELLE_KICK, ID.ROCK_GAZELLE_CHARGE]),
  'White Tiger': profile('White Tiger', [ID.FELINE_SLASH, ID.FELINE_BITE, ID.FELINE_PHASE_POUNCE]),
  Phoenix: profile('Phoenix', [ID.PHOENIX_WICKED_BITE, ID.PHOENIX_DASH, ID.PHOENIX_WING_BUFFET]),
  'Siege Turtle': profile('Siege Turtle', [ID.TURTLE_JADE_CANNON, ID.TURTLE_HEAVY_SHOT, ID.TURTLE_SLAM]),
  'Sky-Chak Striker': profile('Sky-Chak Striker', [ID.CHAK_UNLEASH_ENERGY, ID.CHAK_ELECTROCUTE, ID.CHAK_SPIT_GOOP]),
  Spinegazer: profile('Spinegazer', [
    ID.SPINEGAZER_EVIL_EYE,
    ID.SPINEGAZER_TORMENTING_VISIONS,
    ID.SPINEGAZER_STARING_VOID
  ]),
  Warclaw: profile('Warclaw', [ID.WARCLAW_SLASH, ID.WARCLAW_BATTLE_MAUL, ID.WARCLAW_BOP]),
  'Janthiri Bee': profile('Janthiri Bee', [
    ID.JANTHIRI_BEE_NIBBLE,
    ID.JANTHIRI_BEE_BUMBLE,
    ID.JANTHIRI_BEE_STINGING_SORROW
  ])
});

export function rangerPetAutoProfile(petName: string): PetAutoProfile | null {
  return PET_AUTO_PROFILES[petName] || null;
}
