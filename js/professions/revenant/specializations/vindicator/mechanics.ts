/** Vindicator handler profiles owned by the Vindicator Revenant module. */
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
} from "../../data/ids.js";

const freeze = <T>(value: T): Readonly<T> => Object.freeze(value);

export const VINDICATOR_MECHANICS = freeze({
  legendInvocation: freeze({
    spiritBoon: freeze({
      kind: "vigor",
      duration: 4,
      stacks: 1,
    }),
    song: freeze({
      name: "Call of the Alliance",
      coefficient: 0.93,
      conditions: freeze([]),
      boons: freeze([]),
      enduranceOnCast: 5,
      endurancePerHit: 3,
    }),
  }),
  endurance: freeze({
    regenerationPerSecond: 5,
    dodgeCost: 50,
    vigorRegenerationMultiplier: 1.5,
    vindicatorDodgeCost: 50,
    vindicatorDodgeCastTime: 0.2,
    dodgeStrikeDelay: 0.16,
    energyMeld: freeze({
      endurance: 25,
      songOfArboreumEndurance: 40,
      songOfArboreumVigorDuration: 9,
      angsiyansTrustEnergy: 25,
      reaversCurseDuration: 6,
      reaversCurseRechargeMultiplier: 0.5,
      reaversCurseDodgeDamageMultiplier: 2,
    }),
    dodgeByName: freeze({
      "Death Drop": freeze({
        coefficient: 3.3,
        hits: 1,
      }),
      "Imperial Impact": freeze({
        coefficient: 2,
        hits: 1,
      }),
    }),
    leviathanStrengthStrikeMultiplier: 1.1,
    forerunnerOfDeathStrikeBonus: 0.25,
    forerunnerOfDeathDuration: 10,
    empireDividedPower: 240,
    empireDividedHealthThreshold: 0.5,
  }),
});
