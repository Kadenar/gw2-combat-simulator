/** Renegade handler profiles owned by the Renegade Revenant module. */
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
} from "../../data/ids.js";

const freeze = <T>(value: T): Readonly<T> => Object.freeze(value);

export const RENEGADE_MECHANICS = freeze({
  legendInvocation: freeze({
    spiritBoon: freeze({
      kind: "resolution",
      duration: 4,
      stacks: 1,
    }),
    song: freeze({
      name: "Call of the Renegade",
      coefficient: 0.5,
      conditions: freeze([freeze(["Bleeding", 2, 8])]),
      boons: freeze([
        freeze(["kallas-fervor", 8, 1]),
        freeze(["kallas-fervor-hit", 8, 1]),
      ]),
    }),
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
});
