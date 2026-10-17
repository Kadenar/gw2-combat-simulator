import { BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profile-ids.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/profile-authoring.js';

/** Keep core balance tuning together; skill and mechanic owners resolve these profiles from the active catalog. */
export const RANGER_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: PROFILE.resources,
    name: 'Ranger Endurance',
    profileKind: 'mechanic',
    resourceCost: 50,
    enduranceRegenerationPerSecond: 5,
    vigorRegenerationMultiplier: 1.5,
    effects: []
  },
  variant(ID.ENDURING_SWING, 'Enduring Swing', { resourceGain: 15, effects: [] }),
  variant(PROFILE.attackOfOpportunity, ID.MAUL_SOULBEAST, 'Attack of Opportunity', {
    duration: 10
  }),
  variant(PROFILE.stalkersStrikeImpaired, ID.STALKERS_STRIKE, "Stalker's Strike - Movement-Impaired Target", {
    damageMultiplier: 2,
    effects: [{ name: CONDITION.POISONED, type: 'condition', condition: CONDITION.POISONED, stacks: 2, duration: 8 }]
  }),
  variant(PROFILE.sicEm, ID.SIC_EM, '"Sic \'Em!"', {
    duration: 10
  }),
  variant(PROFILE.signetOfTheWild, ID.SIGNET_OF_THE_WILD, 'Signet of the Wild - Passive', {
    attributeBonus: 180
  }),
  variant(PROFILE.strengthOfThePack, ID.STRENGTH_OF_THE_PACK, '"Strength of the Pack!" - Triggered Might', {
    effects: [{ name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, duration: 8, stacks: 1 }]
  }),
  variant(PROFILE.paralyzingVenom, ID.PARALYZING_VENOM, 'Paralyzing Venom - Immobilized', {
    effects: [{ type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 3 }]
  }),
  variant(PROFILE.petSharpenSpines, ID.BRISTLEBACK_SHARPEN_SPINES, 'Sharpen Spines - Bleeding', {
    effects: [{ type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 5 }]
  }),
  variant(PROFILE.narcoticSporesAutonomous, ID.NARCOTIC_SPORES_PET, 'Narcotic Spores - Autonomous Recharge', {
    cooldown: 16.5
  }),
  variant(PROFILE.cripplingAnguishAutonomous, ID.CRIPPLING_ANGUISH_PET, 'Crippling Anguish - Autonomous Recharge', {
    cooldown: 14
  }),
  variant(PROFILE.cripplingAnguishQuickness, ID.CRIPPLING_ANGUISH_PET, 'Crippling Anguish - Quickness Recharge', {
    cooldown: 12
  }),
  variant(PROFILE.sharpeningStone, ID.SHARPENING_STONE, 'Sharpening Stone - Triggered Bleeding', {
    charges: 10,
    duration: 30,
    effects: [{ name: CONDITION.BLEEDING, type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 8 }]
  }),
  variant(PROFILE.poisonousStrikes, ID.DOUBLE_ARC, 'Poisonous Strikes', {
    charges: 2,
    // Unused charges last ten seconds; the poison they deliver retains its separate six-second base duration.
    duration: 10,
    effects: [{ name: CONDITION.POISONED, type: 'condition', condition: CONDITION.POISONED, stacks: 1, duration: 6 }]
  }),
  variant(PROFILE.bloodThirst, ID.CRIPPLING_SHOT, 'Blood Thirst', {
    charges: 3,
    duration: 12,
    // The log grants a 12-second charge window; each triggered bleed lasts 15 seconds.
    effects: [{ name: CONDITION.BLEEDING, type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 15 }]
  })
]);
