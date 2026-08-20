import type { BalanceProfile, SkillEffect, SkillId } from '../../../platform/engine/types.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '../data/ids.js';

export const WARRIOR_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'warrior.core.resources',
  burstTiers: 'warrior.core.burst-tiers',
  eviscerateTier1: 'warrior.core.eviscerate.tier-1',
  eviscerateTier2: 'warrior.core.eviscerate.tier-2',
  eviscerateTier3: 'warrior.core.eviscerate.tier-3',
  bloodthirsterTiers: 'warrior.core.bloodthirster-tiers',
  combustiveShot: 'warrior.core.combustive-shot',
  dragonsRoar: 'warrior.core.dragons-roar',
  signetMastery: TRAIT.SIGNET_MASTERY,
  burstPrecision: TRAIT.BURST_PRECISION,
  burstMastery: TRAIT.BURST_MASTERY,
  berserkersPower: TRAIT.BERSERKERS_POWER,
  recklessDodge: TRAIT.RECKLESS_DODGE,
  braveStride: TRAIT.BRAVE_STRIDE,
  peakPerformance: TRAIT.PEAK_PERFORMANCE,
  bloodlust: TRAIT.BLOODLUST,
  furious: TRAIT.FURIOUS,
  sunderingBurst: TRAIT.SUNDERING_BURST,
  opportunist: TRAIT.OPPORTUNIST,
  mercilessHammer: TRAIT.MERCILESS_HAMMER,
  stalwartStrength: TRAIT.STALWART_STRENGTH,
  bodyBlow: TRAIT.BODY_BLOW,
  aggressiveOnslaught: TRAIT.AGGRESSIVE_ONSLAUGHT,
  legSpecialist: TRAIT.LEG_SPECIALIST,
  marchingOrders: TRAIT.MARCHING_ORDERS,
  soldiersComfort: TRAIT.SOLDIERS_COMFORT,
  martialCadence: TRAIT.MARTIAL_CADENCE,
  buildingMomentum: TRAIT.BUILDING_MOMENTUM,
  empowerAllies: TRAIT.EMPOWER_ALLIES,
  furiousBurst: TRAIT.FURIOUS_BURST,
  pinnacleOfStrength: TRAIT.PINNACLE_OF_STRENGTH,
  forcefulGreatsword: TRAIT.FORCEFUL_GREATSWORD,
  roaringReveille: TRAIT.ROARING_REVEILLE,
  greatFortitude: TRAIT.GREAT_FORTITUDE,
  vigorousShouts: TRAIT.VIGOROUS_SHOUTS,
  deepStrikes: TRAIT.DEEP_STRIKES,
  blademaster: TRAIT.BLADEMASTER,
  signetPassives: 'warrior.core.signet-passives',
  signetOfFuryActive: 'warrior.core.signet-of-fury-active'
});

const trait = (id: SkillId, name: string, fields: Readonly<Record<string, unknown>> = {}): BalanceProfile => ({
  id,
  name,
  profileKind: 'trait',
  categories: ['Trait'],
  skillFamily: 'Trait',
  effects: [],
  ...fields
});

export const WARRIOR_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: WARRIOR_CORE_BALANCE_PROFILE_IDS.resources,
    name: 'Warrior Core Resources',
    profileKind: 'mechanic',
    maximumStacks: 30,
    threshold: 10,
    resourceGain: 1,
    resourceCost: 50,
    pulseInterval: 0.2,
    enduranceRegenerationPerSecond: 5,
    vigorRegenerationMultiplier: 1.5,
    effects: []
  },
  {
    id: WARRIOR_CORE_BALANCE_PROFILE_IDS.burstTiers,
    name: 'Warrior Burst Tiers',
    profileKind: 'mechanic',
    minimumStacks: 10,
    threshold: 20,
    maximumStacks: 30,
    effects: []
  },
  ...([2, 2.5, 3] as const).map((coefficient, index) => ({
    id: [
      WARRIOR_CORE_BALANCE_PROFILE_IDS.eviscerateTier1,
      WARRIOR_CORE_BALANCE_PROFILE_IDS.eviscerateTier2,
      WARRIOR_CORE_BALANCE_PROFILE_IDS.eviscerateTier3
    ][index],
    name: `Eviscerate - Level ${index + 1}`,
    profileKind: 'skill-variant' as const,
    parentId: ID.EVISCERATE,
    effects: [{ type: 'strike' as const, coefficient, hits: 1 }]
  })),
  {
    id: WARRIOR_CORE_BALANCE_PROFILE_IDS.bloodthirsterTiers,
    name: 'Bloodthirster Burst Tiers',
    profileKind: 'skill-variant',
    parentId: ID.BLOODTHIRSTER,
    effects: [
      { type: 'condition', condition: 'Bleeding', stacks: 3, duration: 6 },
      { type: 'condition', condition: 'Bleeding', stacks: 6, duration: 6 },
      { type: 'condition', condition: 'Bleeding', stacks: 9, duration: 6 }
    ]
  },
  {
    id: WARRIOR_CORE_BALANCE_PROFILE_IDS.combustiveShot,
    name: 'Combustive Shot Burst Tiers',
    profileKind: 'skill-variant',
    parentId: ID.COMBUSTIVE_SHOT,
    pulseInterval: 3,
    durationPerTier: 3,
    effects: [
      { type: 'strike', coefficient: 0.5, hits: 1 },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 5 }
    ]
  },
  {
    id: WARRIOR_CORE_BALANCE_PROFILE_IDS.dragonsRoar,
    name: "Dragon's Roar - Ammo Packet",
    profileKind: 'skill-variant',
    parentId: ID.DRAGONS_ROAR,
    firstPacketRatio: 6 / 7,
    packetIntervalRatio: 2 / 7,
    effects: [{ type: 'strike', coefficient: 0.75, hits: 1 }]
  },
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.signetMastery, 'Signet Mastery', {
    internalCooldown: 20,
    maximumStacks: 5,
    attributeBonus: 100,
    effects: [
      { type: 'boon', boon: 'might', stacks: 10, duration: 6 },
      { type: 'buff', kind: 'signet-mastery', stacks: 1, duration: 60 }
    ]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.burstPrecision, 'Burst Precision', {
    minimumStacks: 2,
    maximumStacks: 4,
    attributeBonus: 250
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.burstMastery, 'Burst Mastery', {
    resourceGain: 0.33,
    effects: [{ type: 'boon', boon: 'swiftness', stacks: 1, duration: 3 }]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.berserkersPower, "Berserker's Power", {
    maximumStacks: 4,
    damageIncreasePerStack: 0.0375,
    effects: [{ type: 'buff', kind: 'berserkers-power', stacks: 1, duration: 15 }]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.recklessDodge, 'Reckless Dodge', {
    effects: [
      { type: 'strike', coefficient: 1.5, hits: 1 },
      { type: 'boon', boon: 'might', stacks: 2, duration: 5 }
    ]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.braveStride, 'Brave Stride', {
    resourceGain: 5,
    effects: [{ type: 'boon', boon: 'stability', stacks: 1, duration: 5 }]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.peakPerformance, 'Peak Performance', {
    damageIncrease: 0.05,
    activeDamageIncrease: 0.1,
    effects: [{ type: 'buff', kind: 'peak-performance', stacks: 1, duration: 6 }]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.bloodlust, 'Bloodlust', {
    procChance: 0.33,
    effects: [{ type: 'condition', condition: 'Bleeding', stacks: 1, duration: 3 }]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.furious, 'Furious', {
    resourceGain: 1,
    maximumStacks: 25,
    attributeBonus: 15,
    effects: [{ type: 'buff', kind: 'furious-surge', stacks: 1, duration: 10 }]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.sunderingBurst, 'Sundering Burst', {
    internalCooldown: 5,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 8
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 8
      }
    ]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.opportunist, 'Opportunist', {
    internalCooldown: 1,
    resourceGain: 5,
    effects: [{ type: 'boon', boon: 'fury', stacks: 1, duration: 3 }]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.mercilessHammer, 'Merciless Hammer', {
    resourceGain: 7
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.stalwartStrength, 'Stalwart Strength', {
    internalCooldown: 0.25,
    effects: [{ type: 'boon', boon: 'stability', stacks: 1, duration: 5 }]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.bodyBlow, 'Body Blow', {
    effects: [
      { type: 'condition', condition: 'Weakness', stacks: 1, duration: 3 },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 6
      }
    ]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.aggressiveOnslaught, 'Aggressive Onslaught', {
    internalCooldown: 0.25,
    effects: [{ type: 'boon', boon: 'quickness', stacks: 1, duration: 3 }]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.legSpecialist, 'Leg Specialist', {
    effects: [{ type: 'condition', condition: 'Immobilized', stacks: 1, duration: 1 }]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.marchingOrders, 'Marching Orders', {
    internalCooldown: 10,
    effects: [{ type: 'boon', boon: 'might', stacks: 3, duration: 15 }]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.soldiersComfort, "Soldier's Comfort", {
    effects: [{ type: 'boon', boon: 'protection', stacks: 1, duration: 4 }]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.martialCadence, 'Martial Cadence', {
    effects: [{ type: 'boon', boon: 'stability', stacks: 1, duration: 3 }]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.buildingMomentum, 'Building Momentum', {
    resourceGain: 15
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.empowerAllies, 'Empower Allies', {
    pulseInterval: 10,
    effects: [{ type: 'boon', boon: 'might', stacks: 5, duration: 10 }]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.furiousBurst, 'Furious Burst', {
    internalCooldown: 4,
    effects: [{ type: 'boon', boon: 'fury', stacks: 1, duration: 2.5 }]
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.pinnacleOfStrength, 'Pinnacle of Strength', {
    attributeBonus: 10
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.forcefulGreatsword, 'Forceful Greatsword', {
    attributeBonus: 120,
    weaponAttributeBonus: 120
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.roaringReveille, 'Roaring Reveille', {
    attributeBonus: 120
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.greatFortitude, 'Great Fortitude', {
    attributeConversion: 0.1
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.vigorousShouts, 'Vigorous Shouts', {
    attributeConversion: 0.13
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.deepStrikes, 'Deep Strikes', {
    attributeBonus: 180
  }),
  trait(WARRIOR_CORE_BALANCE_PROFILE_IDS.blademaster, 'Blademaster', {
    attributeBonus: 120
  }),
  {
    id: WARRIOR_CORE_BALANCE_PROFILE_IDS.signetPassives,
    name: 'Warrior Signet Passives',
    profileKind: 'mechanic',
    attributeBonus: 180,
    effects: []
  },
  {
    id: WARRIOR_CORE_BALANCE_PROFILE_IDS.signetOfFuryActive,
    name: 'Signet of Fury - Active',
    profileKind: 'skill-variant',
    parentId: ID.SIGNET_OF_FURY,
    attributeBonus: 360,
    effects: []
  }
]);

type ProfileContext = {
  readonly catalog?: {
    readonly balanceProfilesById?: ReadonlyMap<SkillId, BalanceProfile>;
  };
  readonly helpers?: {
    readonly balanceProfilesById?: ReadonlyMap<SkillId, BalanceProfile>;
  };
  readonly profession?: {
    readonly catalog?: {
      readonly balanceProfilesById?: ReadonlyMap<SkillId, BalanceProfile>;
    };
  };
  readonly runtime?: {
    readonly profession?: {
      readonly catalog?: {
        readonly balanceProfilesById?: ReadonlyMap<SkillId, BalanceProfile>;
      };
    };
  };
};

export function warriorBalanceProfile(context: unknown, id: SkillId): BalanceProfile | undefined {
  const source = context as ProfileContext;
  return (
    source.catalog?.balanceProfilesById?.get(id) ||
    source.helpers?.balanceProfilesById?.get(id) ||
    source.profession?.catalog?.balanceProfilesById?.get(id) ||
    source.runtime?.profession?.catalog?.balanceProfilesById?.get(id)
  );
}

export function warriorBalanceProfileEffect(
  profile: { readonly effects?: readonly SkillEffect[] } | null | undefined,
  type: string,
  index = 0
): SkillEffect | undefined {
  return profile?.effects?.filter((effect) => effect.type === type)[index];
}
