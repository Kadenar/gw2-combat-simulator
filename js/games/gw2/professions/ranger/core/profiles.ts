import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import {
  defineSkillVariantProfile as variant,
  defineTraitProfile as trait
} from '#gw2/platform/profession-definition/balance-profiles.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'ranger.core.resources',
  attackOfOpportunity: 'ranger.core.attack-of-opportunity',
  poisonousStrikes: 'ranger.core.poisonous-strikes',
  sharpeningStone: 'ranger.core.sharpening-stone',
  sunSpirit: 'ranger.core.sun-spirit',
  sicEm: 'ranger.core.sic-em',
  stalkersStrikeImpaired: 'ranger.core.stalkers-strike-impaired',
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
  leadTheWind: TRAIT.LEAD_THE_WIND,
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
  variant(RANGER_CORE_BALANCE_PROFILE_IDS.attackOfOpportunity, ID.MAUL_SOULBEAST, 'Attack of Opportunity', {
    durationMultiplier: 10
  }),
  variant(RANGER_CORE_BALANCE_PROFILE_IDS.poisonousStrikes, ID.DOUBLE_ARC, 'Poisonous Strikes', {
    playerStacks: 2,
    durationMultiplier: 7,
    effects: [{ name: 'Poisoned', type: 'condition', condition: 'Poisoned', stacks: 1, duration: 6 }]
  }),
  variant(
    RANGER_CORE_BALANCE_PROFILE_IDS.sharpeningStone,
    ID.SHARPENING_STONE,
    'Sharpening Stone - Triggered Bleeding',
    {
      playerStacks: 10,
      durationMultiplier: 30,
      effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 8 }]
    }
  ),
  variant(RANGER_CORE_BALANCE_PROFILE_IDS.sunSpirit, ID.SUN_SPIRIT, 'Sun Spirit - Solar Flare', {
    effects: [{ name: 'Burning', type: 'condition', condition: 'Burning', stacks: 3, duration: 6 }]
  }),
  // Movement-impaired targets double the strike and receive extra Poison on top of the skill's own packet.
  variant(
    RANGER_CORE_BALANCE_PROFILE_IDS.stalkersStrikeImpaired,
    ID.STALKERS_STRIKE,
    "Stalker's Strike - Movement-Impaired Target",
    {
      damageMultiplier: 2,
      effects: [{ name: 'Poisoned', type: 'condition', condition: 'Poisoned', stacks: 2, duration: 8 }]
    }
  ),
  variant(RANGER_CORE_BALANCE_PROFILE_IDS.sicEm, ID.SIC_EM, '"Sic \'Em!"', {
    durationMultiplier: 10
  }),
  variant(RANGER_CORE_BALANCE_PROFILE_IDS.bloodThirst, ID.CRIPPLING_SHOT, 'Blood Thirst', {
    playerStacks: 3,
    durationMultiplier: 12,
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 12 }]
  }),
  variant(RANGER_CORE_BALANCE_PROFILE_IDS.signetOfTheWild, ID.SIGNET_OF_THE_WILD, 'Signet of the Wild - Passive', {
    attributeBonus: 180
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.lightOnYourFeet, 'Light on Your Feet', {
    conditionDurationBonus: 0.1,
    durationPerTier: 2,
    minimumStacks: 1,
    rechargeMultiplier: 0.8,
    effects: [
      { name: 'light-on-your-feet', type: 'buff', kind: 'light-on-your-feet', duration: 6, stacks: 1 },
      {
        name: 'Vulnerability',
        type: 'condition',
        condition: 'Vulnerability',
        duration: 10,
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
        name: 'Immobilized',
        type: 'condition',
        condition: 'Immobilized',
        duration: 1,
        stacks: 1
      },
      { name: 'Crippled', type: 'condition', condition: 'Crippled', duration: 2, stacks: 1 },
      { name: 'Slow', type: 'condition', condition: 'Slow', duration: 1, stacks: 1 }
    ]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.wellspring, 'Wellspring', {
    attributeConversion: 0.07,
    effects: [{ name: 'regeneration', type: 'boon', boon: 'regeneration', duration: 6, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.windborneNotes, 'Windborne Notes', {
    effects: [{ name: 'regeneration', type: 'boon', boon: 'regeneration', duration: 6, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.rejuvenation, 'Rejuvenation', {
    internalCooldown: 20,
    effects: [{ name: 'regeneration', type: 'boon', boon: 'regeneration', duration: 10, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.poisonMaster, 'Poison Master', {
    effects: [{ name: 'Poisoned', type: 'condition', condition: 'Poisoned', duration: 8, stacks: 2 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.wolfsong, 'Wolfsong', {
    effects: [
      {
        name: 'Vulnerability',
        type: 'condition',
        condition: 'Vulnerability',
        duration: 6,
        stacks: 6
      }
    ]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.tailWind, 'Tail Wind', {
    internalCooldown: 9,
    effects: [{ name: 'swiftness', type: 'boon', boon: 'swiftness', duration: 9, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.quickDraw, 'Quick Draw', {
    internalCooldown: 9,
    durationMultiplier: 5,
    rechargeMultiplier: 0.34,
    effects: [{ name: 'quickness', type: 'boon', boon: 'quickness', duration: 3, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.furiousGrip, 'Furious Grip', {
    internalCooldown: 9,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', duration: 5, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.spiritedArrival, 'Spirited Arrival', {
    effects: [
      { name: 'might', type: 'boon', boon: 'might', duration: 12, stacks: 6 },
      { name: 'fury', type: 'boon', boon: 'fury', duration: 8, stacks: 1 }
    ]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.clarionBond, 'Clarion Bond', {
    internalCooldown: 15,
    effects: [
      { name: 'fury', type: 'boon', boon: 'fury', duration: 5, stacks: 1 },
      { name: 'might', type: 'boon', boon: 'might', duration: 5, stacks: 6 },
      { name: 'swiftness', type: 'boon', boon: 'swiftness', duration: 5, stacks: 1 },
      { name: 'Weakness', type: 'condition', condition: 'Weakness', duration: 5, stacks: 1 }
    ]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.resoundingTimbre, 'Resounding Timbre', {
    durationMultiplier: 2
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.openingStrike, 'Opening Strike', {
    effects: [
      {
        name: 'Vulnerability',
        type: 'condition',
        condition: 'Vulnerability',
        duration: 5,
        stacks: 5
      }
    ]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.alphaFocus, 'Alpha Focus', {
    effects: [{ name: 'Crippled', type: 'condition', condition: 'Crippled', duration: 2, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.huntersGaze, "Hunter's Gaze", {
    internalCooldown: 1,
    maximumStacks: 3,
    effects: [{ name: 'might', type: 'boon', boon: 'might', duration: 5, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.leadTheWind, 'Lead the Wind', {
    rechargeMultiplier: 0.8,
    effects: [
      { name: 'swiftness', type: 'boon', boon: 'swiftness', duration: 10, stacks: 1 },
      { name: 'quickness', type: 'boon', boon: 'quickness', duration: 5, stacks: 1 }
    ]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.arachnophobia, 'Arachnophobia', {
    attributeBonus: 150,
    weaponAttributeBonus: 225,
    effects: [{ name: 'Torment', type: 'condition', condition: 'Torment', duration: 3, stacks: 1 }]
  }),
  variant(
    RANGER_CORE_BALANCE_PROFILE_IDS.strengthOfThePack,
    ID.STRENGTH_OF_THE_PACK,
    '"Strength of the Pack!" - Triggered Might',
    {
      effects: [{ name: 'might', type: 'boon', boon: 'might', duration: 8, stacks: 1 }]
    }
  ),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.goForTheThroat, 'Go for the Throat', {
    internalCooldown: 10,
    effects: [
      {
        name: 'lesser-sic-em-pet',
        type: 'buff',
        kind: 'lesser-sic-em-pet',
        duration: 8,
        stacks: 1
      },
      { name: 'lesser-sic-em', type: 'buff', kind: 'lesser-sic-em', duration: 5, stacks: 1 }
    ]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.sharpenedEdges, 'Sharpened Edges', {
    criticalChance: 0.33,
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', duration: 3, stacks: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.trappersExpertise, "Trapper's Expertise", {
    durationMultiplier: 1.6,
    coefficientMultiplier: 1.66,
    effects: [
      {
        name: 'Crippled',
        type: 'condition',
        condition: 'Crippled',
        duration: 3,
        stacks: 1
      }
    ]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.carnivore, 'Carnivore', {
    internalCooldown: 0.25,
    effects: [{ name: 'Strike', type: 'strike', coefficient: 0.05, hits: 1 }]
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.naturalVigor, 'Natural Vigor', {
    vigorRegenerationMultiplier: 0.25
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.fangAndClaw, 'Fang and Claw', {
    attributeBonus: 420,
    weaponAttributeBonus: 450
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.stridersStrength, "Strider's Strength", {
    weaponAttributeBonus: 240,
    attributeBonus: 120
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.honedAxes, 'Honed Axes', {
    weaponAttributeBonus: 240,
    attributeBonus: 120,
    rechargeMultiplier: 0.8
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.viciousQuarry, 'Vicious Quarry', {
    criticalChance: 0.15,
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

  trait(TRAIT.HUNTERS_TACTICS, "Hunter's Tactics", {
    criticalChance: 0.1
  }),

  trait(TRAIT.PRECISE_STRIKE, 'Precise Strike', {
    criticalChance: 1
  }),
  trait(RANGER_CORE_BALANCE_PROFILE_IDS.ambidexterity, 'Ambidexterity', {
    weaponAttributeBonus: 240,
    attributeBonus: 120,
    rechargeMultiplier: 0.8
  })
]);
