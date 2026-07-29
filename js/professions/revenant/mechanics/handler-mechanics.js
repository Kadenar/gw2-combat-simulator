/**
 * Formula and profile data consumed by Revenant-specific handlers.
 *
 * Direct cast packets belong in skill-mechanics.js. This module owns
 * triggered effects, state-machine constants, legend-dependent profiles, and
 * replacement-handler packets that cannot use the declarative effect schema.
 */
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
} from "../data/ids.js";

const freeze = (value) => Object.freeze(value);

export const REVENANT_HANDLER_MECHANICS = freeze({
  energy: freeze({
    regenerationPerSecond: 5,
    legendSwap: 50,
    chargedMistsSwap: 75,
    chargedMistsThreshold: 10,
    highCostThreshold: 25,
    highCostAffinity: 2,
    standardAffinity: 1,
  }),
  endurance: freeze({
    regenerationPerSecond: 5,
    dodgeCost: 50,
    vindicatorDodgeCost: 100,
    dodgeStrikeDelay: 0.8,
    dodgeByName: freeze({
      "Death Drop": freeze({
        coefficient: 3,
        hits: 1,
      }),
      "Imperial Impact": freeze({
        coefficient: 1,
        hits: 1,
      }),
    }),
  }),
  enchantedDaggers: freeze({
    charges: 6,
    duration: 15,
    interval: 0.5,
    siphon: freeze({
      flatStrikeBase: 1028,
      flatStrikePowerCoeff: 0.06,
    }),
  }),
  impossibleOdds: freeze({
    coefficient: 0.65,
    interval: 0.25,
    delay: 0.25,
  }),
  soulcleave: freeze({
    interval: 1,
    coefficient: 0.8,
    siphon: freeze({
      flatStrikeBase: 325,
      flatStrikePowerCoeff: 0.1,
    }),
  }),
  bandTogether: freeze({
    duration: 4,
    darkrazor: freeze({
      casterStabilityDuration: 1,
      alliedStabilityDuration: 6,
      enhancedBreakbar: 600,
      bonusDefianceBreak: 400,
      resistance: 4,
      protection: 4,
    }),
    icerazor: freeze({
      enhancedChill: 1.5,
      packetInterval: 0.161,
      normalImpactDelay: 0.5,
      enhancedImpactDelay: 0.322,
    }),
    razorclaw: freeze({
      charges: 4,
      duration: 5,
      interval: 1,
      bleedDuration: 3,
      enhancedTormentStacks: 3,
      enhancedTormentDuration: 6,
    }),
  }),
  renegade: freeze({
    kallasFervor: freeze({
      maximumStacks: 5,
      duration: 8,
      improvedDuration: 12,
      strikeDamagePerStack: 0.03,
      conditionDamagePerStack: 0.02,
      lifeSiphonDamagePerStack: 0.02,
      improvedStrikeDamagePerStack: 0.05,
      improvedConditionDamagePerStack: 0.03,
      improvedLifeSiphonDamagePerStack: 0.05,
    }),
    heroicCommand: freeze({
      mightDuration: 8,
      mightPerFervor: 2,
      improvedMightPerFervor: 3,
    }),
    ordersFromAbove: freeze({
      alacrityDuration: 2,
      pulses: 4,
      improvedPulses: 6,
      interval: 1,
    }),
    endlessEnmity: freeze({
      furyDuration: 4,
      interval: 8,
    }),
    bloodFury: freeze({
      interval: 3,
      bleedingDurationMultiplier: 1.25,
    }),
    allForOne: freeze({
      energy: 10,
      enhancedRechargeMultiplier: 0.5,
    }),
    vindication: freeze({
      dazeDuration: 1,
    }),
  }),
  battleScars: freeze({
    duration: 10,
    limit: 25,
    interval: 1,
    healSkillStacks: 5,
    flatStrikeBase: 117,
    flatStrikePowerCoeff: 0.006,
  }),
  traitProcs: freeze({
    abyssalChill: freeze({
      tormentDuration: 3,
    }),
    assassinsPresence: freeze({
      furyDuration: 3,
      interval: 10,
    }),
    brutality: freeze({
      quicknessDuration: 3,
      interval: 9,
    }),
    dwarvenBattleTraining: freeze({
      weaknessDuration: 5,
    }),
    exposeDefenses: freeze({
      vulnerabilityStacks: 5,
      vulnerabilityDuration: 5,
    }),
    viciousReprisal: freeze({
      mightDuration: 10,
      interval: 1,
    }),
    notoriety: freeze({
      mightStacks: 2,
      mightDuration: 10,
      professionSkillIds: freeze([
        ID.ANCIENT_ECHO,
        ID.TRUE_NATURE,
        ID.TRUE_NATURE_ID_51675,
        ID.TRUE_NATURE_ID_51696,
        ID.TRUE_NATURE_ID_51713,
        ID.TRUE_NATURE_ID_51714,
        ID.HEROIC_COMMAND,
        ID.CITADEL_BOMBARDMENT,
        ID.ORDERS_FROM_ABOVE,
      ]),
    }),
    mistfire: freeze({
      interval: 1,
      coefficient: 0.6,
      burningStacks: 1,
      burningDuration: 6,
    }),
  }),
  legendInvocation: freeze({
    lingeringDeterminationAffinity: 2,
    enhancedEmbodimentExtension: 1,
    invokingTorment: freeze({
      delay: 0.75,
      coefficient: 1,
      tormentStacks: 1,
      tormentDuration: 10,
      poisonStacks: 1,
      poisonDuration: 10,
      burningStacks: 1,
      burningDuration: 4,
    }),
    spiritBoons: freeze({
      [LEGEND.ASSASSIN]: freeze({
        kind: "might",
        duration: 10,
        stacks: 2,
      }),
      [LEGEND.DEMON]: freeze({
        kind: "resistance",
        duration: 2,
        stacks: 1,
      }),
      [LEGEND.DWARF]: freeze({
        kind: "stability",
        duration: 3,
        stacks: 1,
      }),
      [LEGEND.CENTAUR]: freeze({
        kind: "regeneration",
        duration: 5,
        stacks: 1,
      }),
      [LEGEND.DRAGON]: freeze({
        kind: "protection",
        duration: 3,
        stacks: 1,
      }),
      [LEGEND.RENEGADE]: freeze({
        kind: "resolution",
        duration: 4,
        stacks: 1,
      }),
      [LEGEND.ALLIANCE]: freeze({
        kind: "vigor",
        duration: 4,
        stacks: 1,
      }),
    }),
    songs: freeze({
      [LEGEND.ASSASSIN]: freeze({
        name: "Call of the Assassin",
        coefficient: 0.93,
        conditions: freeze([freeze(["Vulnerability", 8, 5])]),
        boons: freeze([freeze(["quickness", 2, 1])]),
      }),
      [LEGEND.DWARF]: freeze({
        name: "Call of the Dwarf",
        coefficient: 0.75,
        conditions: freeze([freeze(["Weakness", 1, 5])]),
        boons: freeze([]),
      }),
      [LEGEND.DEMON]: freeze({
        name: "Call of the Demon",
        coefficient: 0.9,
        conditions: freeze([freeze(["Slow", 1, 3]), freeze(["Torment", 2, 8])]),
        boons: freeze([]),
      }),
      [LEGEND.DRAGON]: freeze({
        name: "Call of the Dragon",
        coefficient: 0.75,
        conditions: freeze([
          freeze(["Burning", 2, 3]),
          freeze(["Chilled", 1, 3]),
        ]),
        boons: freeze([]),
      }),
      [LEGEND.RENEGADE]: freeze({
        name: "Call of the Renegade",
        coefficient: 0.5,
        conditions: freeze([freeze(["Bleeding", 2, 8])]),
        boons: freeze([
          freeze(["kallas-fervor", 8, 1]),
          freeze(["kallas-fervor-hit", 8, 1]),
        ]),
      }),
      [LEGEND.ALLIANCE]: freeze({
        name: "Call of the Alliance",
        coefficient: 0.93,
        conditions: freeze([]),
        boons: freeze([]),
        endurance: 8,
      }),
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
      demonShatterCoefficient: 0.4,
      demonConfusionStacks: 3,
      demonConfusionDuration: 3,
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
    ancientEchoEnergy: 25,
    cosmicWisdomDuration: 7,
    formOfTheDervishCoefficient: 0.8,
  }),
  upkeep: freeze({
    defaultPulseInterval: 1,
    facetPulseInterval: 3,
    vengefulHammersPulseInterval: 1 / 3,
    facetPulseBySkillId: freeze({
      [ID.FACET_OF_LIGHT]: freeze({
        kind: "regeneration",
        duration: 4,
        stacks: 1,
      }),
      [ID.FACET_OF_STRENGTH]: freeze({
        kind: "might",
        duration: 12,
        stacks: 1,
      }),
      [ID.FACET_OF_ELEMENTS]: freeze({
        kind: "swiftness",
        duration: 3,
        stacks: 1,
      }),
      [ID.FACET_OF_DARKNESS]: freeze({
        kind: "fury",
        duration: 3,
        stacks: 1,
      }),
      [ID.FACET_OF_CHAOS]: freeze({
        kind: "protection",
        duration: 3,
        stacks: 1,
      }),
    }),
    facetConsumeBySkillId: freeze({
      [ID.FACET_OF_LIGHT]: ID.INFUSE_LIGHT,
      [ID.FACET_OF_STRENGTH]: ID.BURST_OF_STRENGTH,
      [ID.FACET_OF_ELEMENTS]: ID.ELEMENTAL_BLAST,
      [ID.FACET_OF_DARKNESS]: ID.GAZE_OF_DARKNESS,
      [ID.FACET_OF_CHAOS]: ID.CHAOTIC_RELEASE,
      [ID.FACET_OF_NATURE]: ID.TRUE_NATURE,
    }),
    facetSkillByConsumeId: freeze({
      [ID.INFUSE_LIGHT]: ID.FACET_OF_LIGHT,
      [ID.BURST_OF_STRENGTH]: ID.FACET_OF_STRENGTH,
      [ID.ELEMENTAL_BLAST]: ID.FACET_OF_ELEMENTS,
      [ID.GAZE_OF_DARKNESS]: ID.FACET_OF_DARKNESS,
      [ID.CHAOTIC_RELEASE]: ID.FACET_OF_CHAOS,
      [ID.TRUE_NATURE]: ID.FACET_OF_NATURE,
      [ID.TRUE_NATURE_ID_51675]: ID.FACET_OF_NATURE,
      [ID.TRUE_NATURE_ID_51696]: ID.FACET_OF_NATURE,
      [ID.TRUE_NATURE_ID_51713]: ID.FACET_OF_NATURE,
      [ID.TRUE_NATURE_ID_51714]: ID.FACET_OF_NATURE,
    }),
    inspiringReinforcement: freeze({
      coefficient: 1.5,
      weaknessStacks: 1,
      weaknessDuration: 6,
      stabilityStacks: 1,
      stabilityDuration: 3,
      pulses: 5,
      firstPulseDelay: 0.5,
      pulseInterval: 1,
    }),
    elementalBlast: freeze({
      coefficientPerPulse: 0.5,
      pulseInterval: 1,
      conditions: freeze([
        freeze(["Weakness", 1, 5]),
        freeze(["Chilled", 1, 3]),
        freeze(["Burning", 2, 4]),
      ]),
    }),
    embraceTheDarkness: freeze({
      coefficient: 0.3,
      tormentStacks: 1,
      empoweredTormentStacks: 2,
      tormentDuration: 5,
    }),
    vengefulHammers: freeze({
      hammers: 3,
      coefficientPerHammer: 0.2,
    }),
    enigmaticUpkeep: freeze({
      interval: 3,
      affinity: 1,
    }),
  }),
});
