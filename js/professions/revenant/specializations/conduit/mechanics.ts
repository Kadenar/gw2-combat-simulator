/** Conduit handler profiles owned by the Conduit Revenant module. */
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
} from "../../data/ids.js";

const freeze = <T>(value: T): Readonly<T> => Object.freeze(value);

export const CONDUIT_MECHANICS = freeze({
  legendInvocation: freeze({
    lingeringDeterminationAffinity: 2,
    enhancedEmbodimentExtension: 1,
  }),
  traitProcs: freeze({
    mistfire: freeze({
      interval: 1,
      coefficient: 0.6,
      burningStacks: 1,
      burningDuration: 6,
    }),
  }),
  conduit: freeze({
    affinityMaximum: 5,
    allReleaseEffectsAffinity: 3,
    expandedConsciousnessEnergy: 15,
    sharedWisdomSwiftness: 5,
    numinousGift: freeze({
      mightStacks: 5,
      mightDuration: 10,
      boons: freeze({
        [LEGEND.ASSASSIN]: freeze(["fury", 10]),
        [LEGEND.DEMON]: freeze(["resistance", 5]),
        [LEGEND.DWARF]: freeze(["stability", 5]),
        [LEGEND.CENTAUR]: freeze(["protection", 5]),
        [LEGEND.ENTITY]: freeze(["quickness", 5]),
      }),
    }),
    beguilingHaze: freeze({
      mainCoefficient: 2.2,
      followUpCoefficient: 0.6,
      followUpCharges: 2,
      sharedWisdomFury: 5,
    }),
    hexEaterVortex: freeze({
      maximumProjectiles: 6,
      projectileCoefficient: 0.2,
      tormentStacks: 1,
      tormentDuration: 1.5,
      sharedWisdomResolution: 3,
    }),
    gladiatorsDefense: freeze({
      coefficient: 1.5,
      weaknessDuration: 5,
      resolutionDuration: 3,
      resistanceDuration: 3,
      sharedWisdomStability: 3,
    }),
    twinMoonSweep: freeze({
      playerCoefficient: 2.5,
      fragmentCoefficient: 2.5,
      packets: 2,
      bleedStacks: 2,
      bleedDuration: 3,
      mightStacks: 2,
      mightDuration: 8,
      assassinImmobilize: 2,
      demonShatterCoefficient: 0.2,
      demonConfusionStacks: 3,
      demonConfusionDuration: 3,
      burningBolts: 2,
      burningBoltDuration: 1,
      burningBoltDelay: 0.04,
      sharedWisdomMightStacks: 5,
      sharedWisdomMightDuration: 10,
    }),
    releasePotential: freeze({
      [ID.RELEASE_POTENTIAL_MONK]: freeze({
        resistanceDuration: 2,
        regenerationDuration: 6,
      }),
      [ID.RELEASE_POTENTIAL_DERVISH]: freeze({
        coefficient: 1.98,
        demonBleedStacks: 3,
        demonBleedDuration: 6,
        centaurMightStacks: 10,
        centaurMightDuration: 8,
        centaurFuryDuration: 8,
      }),
      [ID.RELEASE_POTENTIAL_MESMER]: freeze({
        coefficient: 1.98,
        tormentStacks: 2,
        tormentBaseDuration: 3,
        tormentDurationPerAffinity: 0.1,
        selfTormentBaseDuration: 8,
        selfDurationReductionPerAffinity: 0.15,
        dazeDuration: 2,
      }),
      [ID.RELEASE_POTENTIAL_ASSASSIN]: freeze({
        coefficientPerHit: 0.6,
        hits: 3,
        conditionBaseDuration: 2,
        conditionDurationPerAffinity: 0.2,
      }),
      [ID.RELEASE_POTENTIAL_WARRIOR]: freeze({
        coefficient: 1.649,
      }),
    }),
    cosmicWisdomDuration: 7,
    formOfTheMesmer: freeze({
      banishEnchantmentEnergyCost: 5,
      banishEnchantmentCooldown: 5,
      callToAnguishEnergyCost: 10,
      unyieldingImpactEnergyCost: 0,
      embraceTheDarknessEnergyCost: 0,
    }),
    formOfTheAssassin: freeze({
      lesserEnchantedDaggersCoefficient: 0.06,
      impossibleOddsInterval: 1,
    }),
    formOfTheDervishCoefficient: 0.8,
  }),
});
