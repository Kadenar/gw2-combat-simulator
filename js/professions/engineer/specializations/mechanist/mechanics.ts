import {
  ENGINEER_INTERNAL_IDS as INTERNAL,
  ENGINEER_SKILL_IDS as ID,
} from "../../data/ids.js";

export const ENGINEER_TRIGGERED_MECHANICS = Object.freeze({
  [INTERNAL.MECH_BASIC_ATTACK]: Object.freeze({
    coefficient: 0.84,
    hits: 2,
    interval: 1.575,
  }),
});

export const MECHANIST_COMMAND_DURATIONS:
Readonly<Record<number, number>> = Object.freeze({
  [ID.SPARK_REVOLVER]: 1.401 + 0.35,
  [ID.CORE_REACTOR_SHOT]: 1 + 0.35,
  [ID.JADE_MORTAR]: 1.085 + 0.35,
});

export const MECHANIST_ATTACK_TIMING = Object.freeze({
  jadeCannonArmGap: 0.5,
  jadeCannonCycleGap: 1.075,
  meleeChainIntervals: Object.freeze([0.25, 0.5, 0.5]),
  commandRecovery: 0.35,
});
