import type { BalanceProfile, SkillEffect, SkillId } from '../../../../platform/engine/types.js';
import {
  defineSkillVariantProfile as variant,
  defineTraitProfile as trait
} from '../../../../integrations/patches/authoring/balance-profiles.js';
import {
  balanceProfileEffect,
  balanceProfileFromContext,
  balanceProfileValue
} from '../../../../platform/combat/state/balance-profiles.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '../data/ids.js';

export const RANGER_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'ranger.core.resources',
  poisonousStrikes: 'ranger.core.poisonous-strikes',
  sharpeningStone: 'ranger.core.sharpening-stone',
  sunSpirit: 'ranger.core.sun-spirit',
  sicEm: 'ranger.core.sic-em',
  bloodThirst: 'ranger.core.blood-thirst',
  signetOfTheWild: 'ranger.core.signet-of-the-wild',
  lightOnYourFeet: TRAIT.LIGHT_ON_YOUR_FEET,
  childOfEarth: TRAIT.CHILD_OF_EARTH,
  wellspring: TRAIT.WELLSPRING,
  windborneNotes: TRAIT.WINDBORNE_NOTES,
  rejuvenation: TRAIT.REJUVENATION,
  poisonMaster: TRAIT.POISON_MASTER,
  wolfsong: TRAIT.WOLFSONG,
  tailWind: TRAIT.TAIL_WIND,
  quickDraw: TRAIT.QUICK_DRAW,
  furiousGrip: TRAIT.FURIOUS_GRIP,
  spiritedArrival: TRAIT.SPIRITED_ARRIVAL,
  clarionBond: TRAIT.CLARION_BOND,
  resoundingTimbre: TRAIT.RESOUNDING_TIMBRE,
  openingStrike: TRAIT.OPENING_STRIKE,
  alphaFocus: TRAIT.ALPHA_FOCUS,
  huntersGaze: TRAIT.HUNTERS_GAZE,
  arachnophobia: TRAIT.ARACHNOPHOBIA,
  strengthOfThePack: 'ranger.core.strength-of-the-pack-proc',
  goForTheThroat: TRAIT.GO_FOR_THE_THROAT,
  sharpenedEdges: TRAIT.SHARPENED_EDGES,
  trappersExpertise: TRAIT.TRAPPERS_EXPERTISE,
  carnivore: TRAIT.CARNIVORE,
  naturalVigor: TRAIT.NATURAL_VIGOR,
  fangAndClaw: TRAIT.FANG_AND_CLAW,
  stridersStrength: TRAIT.STRIDERS_STRENGTH,
  honedAxes: TRAIT.HONED_AXES,
  viciousQuarry: TRAIT.VICIOUS_QUARRY,
  packAlpha: TRAIT.PACK_ALPHA,
  petsProwess: TRAIT.PETS_PROWESS,
  lingeringMagic: TRAIT.LINGERING_MAGIC,
  ambidexterity: TRAIT.AMBIDEXTERITY
});

export const RANGER_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: RANGER_CORE_BALANCE_PROFILE_IDS.resources,
    name: 'Ranger Endurance',
    profileKind: 'mechanic',
    resourceCost: 50,
    enduranceRegenerationPerSecond: 5,
    vigorRegenerationMultiplier: 1.5,
    effects: []
  },
  variant(RANGER_CORE_BALANCE_PROFILE_IDS.poisonousStrikes, ID.DOUBLE_ARC, 'Poisonous Strikes', {
    playerStacks: 2,
    durationMultiplier: 10,
    effects: [{ type: 'condition', condition: 'Poisoned', stacks: 1, duration: 6 }]
  }),
  variant(
    RANGER_CORE_BALANCE_PROFILE_IDS.sharpeningStone,
    ID.SHARPENING_STONE,
    'Sharpening Stone - Triggered Bleeding',
    {
      playerStacks: 10,
      durationMultiplier: 30,
      effects: [{ type: 'condition', condition: 'Bleeding', stacks: 1, duration: 8 }]
    }
  ),
  variant(RANGER_CORE_BALANCE_PROFILE_IDS.sunSpirit, ID.SUN_SPIRIT, 'Sun Spirit - Solar Flare', {
    effects: [{ type: 'condition', condition: 'Burning', stacks: 3, duration: 6 }]
  }),
  variant(RANGER_CORE_BALANCE_PROFILE_IDS.sicEm, ID.SIC_EM, '"Sic \'Em!"', {
    durationMultiplier: 10
  }),
  variant(RANGER_CORE_BALANCE_PROFILE_IDS.bloodThirst, ID.CRIPPLING_SHOT, 'Blood Thirst', {
    playerStacks: 3,
    effects: [{ type: 'condition', condition: 'Bleeding', stacks: 1, duration: 12 }]
  }),
  variant(RANGER_CORE_BALANCE_PROFILE_IDS.signetOfTheWild, ID.SIGNET_OF_THE_WILD, 'Signet of the Wild - Passive', {
    attributeBonus: 180
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.lightOnYourFeet, 'Light on Your Feet', {
    durationPerTier: 2,
    minimumStacks: 1,
    rechargeMultiplier: 0.8,
    effects: [
      { type: 'buff', kind: 'light-on-your-feet', duration: 6, stacks: 1 },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 1,
        stacks: 10
      }
    ]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.childOfEarth, 'Child of Earth', {
    internalCooldown: 20,
    pulseInterval: 2,
    maximumStacks: 5,
    effects: [
      {
        type: 'condition',
        condition: 'Immobilized',
        duration: 1,
        stacks: 1
      },
      { type: 'condition', condition: 'Crippled', duration: 2, stacks: 1 },
      { type: 'condition', condition: 'Slow', duration: 1, stacks: 1 }
    ]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.wellspring, 'Wellspring', {
    attributeConversion: 0.07,
    effects: [{ type: 'boon', boon: 'regeneration', duration: 6, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.windborneNotes, 'Windborne Notes', {
    effects: [{ type: 'boon', boon: 'regeneration', duration: 6, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.rejuvenation, 'Rejuvenation', {
    internalCooldown: 20,
    effects: [{ type: 'boon', boon: 'regeneration', duration: 10, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.poisonMaster, 'Poison Master', {
    effects: [{ type: 'condition', condition: 'Poisoned', duration: 8, stacks: 2 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.wolfsong, 'Wolfsong', {
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 6,
        stacks: 6
      }
    ]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.tailWind, 'Tail Wind', {
    internalCooldown: 9,
    effects: [{ type: 'boon', boon: 'swiftness', duration: 9, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.quickDraw, 'Quick Draw', {
    internalCooldown: 9,
    durationMultiplier: 5,
    rechargeMultiplier: 0.34,
    effects: [{ type: 'boon', boon: 'quickness', duration: 3, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.furiousGrip, 'Furious Grip', {
    internalCooldown: 9,
    effects: [{ type: 'boon', boon: 'fury', duration: 5, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.spiritedArrival, 'Spirited Arrival', {
    effects: [
      { type: 'boon', boon: 'might', duration: 12, stacks: 6 },
      { type: 'boon', boon: 'fury', duration: 8, stacks: 1 }
    ]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.clarionBond, 'Clarion Bond', {
    internalCooldown: 15,
    effects: [
      { type: 'boon', boon: 'fury', duration: 5, stacks: 1 },
      { type: 'boon', boon: 'might', duration: 5, stacks: 6 },
      { type: 'boon', boon: 'swiftness', duration: 5, stacks: 1 },
      { type: 'condition', condition: 'Weakness', duration: 5, stacks: 1 }
    ]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.resoundingTimbre, 'Resounding Timbre', {
    durationMultiplier: 2
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.openingStrike, 'Opening Strike', {
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 5,
        stacks: 5
      }
    ]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.alphaFocus, 'Alpha Focus', {
    effects: [{ type: 'condition', condition: 'Crippled', duration: 2, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.huntersGaze, "Hunter's Gaze", {
    internalCooldown: 1,
    maximumStacks: 3,
    effects: [{ type: 'boon', boon: 'might', duration: 5, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.arachnophobia, 'Arachnophobia', {
    attributeBonus: 150,
    weaponAttributeBonus: 225,
    effects: [{ type: 'condition', condition: 'Torment', duration: 3, stacks: 1 }]
  }),
  variant(
    RANGER_CORE_BALANCE_PROFILE_IDS.strengthOfThePack,
    ID.STRENGTH_OF_THE_PACK,
    '"Strength of the Pack!" - Triggered Might',
    {
      effects: [{ type: 'boon', boon: 'might', duration: 8, stacks: 1 }]
    }
  ),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.goForTheThroat, 'Go for the Throat', {
    internalCooldown: 10,
    effects: [
      {
        type: 'buff',
        kind: 'lesser-sic-em-pet',
        duration: 8,
        stacks: 1
      },
      { type: 'buff', kind: 'lesser-sic-em', duration: 5, stacks: 1 }
    ]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.sharpenedEdges, 'Sharpened Edges', {
    criticalChance: 0.33,
    effects: [{ type: 'condition', condition: 'Bleeding', duration: 3, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.trappersExpertise, "Trapper's Expertise", {
    durationMultiplier: 1.6,
    coefficientMultiplier: 1.66,
    effects: [
      {
        type: 'condition',
        condition: 'Crippled',
        duration: 3,
        stacks: 1
      }
    ]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.carnivore, 'Carnivore', {
    internalCooldown: 0.25,
    effects: [{ type: 'strike', coefficient: 0.05, hits: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.naturalVigor, 'Natural Vigor', {
    vigorRegenerationMultiplier: 0.25
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.fangAndClaw, 'Fang and Claw', {
    attributeBonus: 420,
    weaponAttributeBonus: 450
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.stridersStrength, "Strider's Strength", {
    attributeBonus: 120
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.honedAxes, 'Honed Axes', {
    attributeBonus: 120,
    rechargeMultiplier: 0.8
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.viciousQuarry, 'Vicious Quarry', {
    attributeBonus: 250
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.packAlpha, 'Pack Alpha', {
    attributeBonus: 150,
    weaponAttributeBonus: 300,
    rechargeMultiplier: 0.8
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.petsProwess, "Pet's Prowess", {
    attributeBonus: 300
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.lingeringMagic, 'Lingering Magic', {
    attributeBonus: 240
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.ambidexterity, 'Ambidexterity', {
    attributeBonus: 120,
    rechargeMultiplier: 0.8
  })
]);

export function rangerBalanceProfile(context: unknown, id: SkillId): BalanceProfile | undefined {
  return balanceProfileFromContext(context, id);
}

export function rangerBalanceValue(context: unknown, id: SkillId, field: string, fallback: number): number {
  return balanceProfileValue(rangerBalanceProfile(context, id), field, fallback);
}

export function rangerBalanceProfileEffect(
  profile: { readonly effects?: readonly SkillEffect[] } | null | undefined,
  type: string,
  index = 0
): SkillEffect | undefined {
  return balanceProfileEffect(profile, type, index);
}
