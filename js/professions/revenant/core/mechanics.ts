/** Core handler profiles owned by the Core Revenant module. */
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
} from "../data/ids.js";

const freeze = <T>(value: T): Readonly<T> => Object.freeze(value);

export const REVENANT_CORE_MECHANICS = freeze({
  endurance: freeze({
    regenerationPerSecond: 5,
    dodgeCost: 50,
    vigorRegenerationMultiplier: 1.5,
  }),
  energy: freeze({
    regenerationPerSecond: 5,
    legendSwap: 50,
    chargedMistsSwap: 75,
    chargedMistsThreshold: 10,
    ancientEchoEnergy: 25,
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
  battleScars: freeze({
    duration: 10,
    limit: 25,
    interval: 1,
    healSkillStacks: 5,
    flatStrikeBase: 117,
    flatStrikePowerCoeff: 0.006,
  }),
  spear: freeze({
    abyssalRaze: freeze({
      coefficient: 1,
      impactDelay: 0.559,
      damageIncreasePerStack: 0.33,
      baseTormentStacks: 1,
      baseTormentDuration: 5,
      tormentStacksPerCrushingAbyss: 2,
      empoweredTormentDuration: 5,
      crushingAbyssDuration: 10,
      crushingAbyssMaximum: 3,
      crushingAbyssEffect: freeze({
        id: 72962,
        name: "Crushing Abyss",
        icon: "https://wiki.guildwars2.com/images/5/52/Abyssal_Raze.png",
      }),
    }),
    rechargeReductionBySkillId: freeze({
      [ID.ABYSSAL_FIRE]: 1,
      [ID.ABYSSAL_STRIKE]: 1,
      [ID.ABYSSAL_FORCE]: 5,
      [ID.ABYSSAL_BLITZ]: 3,
      [ID.ABYSSAL_BLOT]: 2,
    }),
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
    }),
  }),
  legendInvocation: freeze({
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
    }),
  }),
  upkeep: freeze({
    defaultPulseInterval: 1,
    vengefulHammersPulseInterval: 1 / 3,
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
    embraceTheDarkness: freeze({
      coefficient: 0.3,
      initialStrikeDelay: 0.362,
      tormentStacks: 1,
      empoweredTormentStacks: 2,
      tormentDuration: 5,
    }),
    vengefulHammers: freeze({
      hammers: 3,
      coefficientPerHammer: 0.2,
    }),
  }),
});
