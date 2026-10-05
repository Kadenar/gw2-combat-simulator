import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/balance-profiles.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  cripplingAnguishQuickness: 'ranger.pet.crippling-anguish-quickness',
  resources: 'ranger.core.resources',
  attackOfOpportunity: 'ranger.core.attack-of-opportunity',
  poisonousStrikes: 'ranger.core.poisonous-strikes',
  paralyzingVenom: 'ranger.pet.paralyzing-venom',
  sharpeningStone: 'ranger.core.sharpening-stone',
  sunSpirit: 'ranger.core.sun-spirit',
  sicEm: 'ranger.core.sic-em',
  stalkersStrikeImpaired: 'ranger.core.stalkers-strike-impaired',
  bloodThirst: 'ranger.core.blood-thirst',
  signetOfTheWild: 'ranger.core.signet-of-the-wild',

  strengthOfThePack: 'ranger.core.strength-of-the-pack-proc'
});

export const RANGER_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  // The spider owns the next-hit condition and its PvE duration independently of the venom buff.
  variant(RANGER_CORE_BALANCE_PROFILE_IDS.paralyzingVenom, ID.PARALYZING_VENOM, 'Paralyzing Venom - Immobilized', {
    effects: [{ type: 'condition', condition: 'Immobilized', stacks: 1, duration: 3 }]
  }),
  // The observed quickness-specific pet recharge remains independently patchable.
  variant(
    RANGER_CORE_BALANCE_PROFILE_IDS.cripplingAnguishQuickness,
    ID.CRIPPLING_ANGUISH_PET,
    'Crippling Anguish - Quickness Recharge',
    { cooldown: 12 }
  ),
  // Enduring Swing's completed-chain endurance reward is independent of its strike packet.
  variant(ID.ENDURING_SWING, 'Enduring Swing', { resourceGain: 15, effects: [] }),
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
  variant(
    RANGER_CORE_BALANCE_PROFILE_IDS.strengthOfThePack,
    ID.STRENGTH_OF_THE_PACK,
    '"Strength of the Pack!" - Triggered Might',
    {
      effects: [{ name: 'might', type: 'boon', boon: 'might', duration: 8, stacks: 1 }]
    }
  )
]);
