import { ENGINEER_INTERNAL_IDS as INTERNAL, ENGINEER_SKILL_IDS as ID } from '../../data/ids.js';

export const ENGINEER_TRIGGERED_MECHANICS = Object.freeze({
  [INTERNAL.MECH_BASIC_ATTACK]: Object.freeze({
    coefficient: 0.84,
    hits: 2,
    interval: 1.575
  })
});

// Rounded Quickness animation durations measured from the mech's EVTC
// activations; command recovery is applied separately before basic attacks resume.
export const MECHANIST_COMMAND_DURATIONS: Readonly<Record<number, number>> = Object.freeze({
  [ID.SPARK_REVOLVER]: 1.4,
  [ID.CORE_REACTOR_SHOT]: 1,
  [ID.JADE_MORTAR]: 1.08
});

export const MECHANIST_ATTACK_TIMING = Object.freeze({
  jadeCannonArmGap: 0.5,
  jadeCannonCycleGap: 1.075,
  meleeChainIntervals: Object.freeze([0.25, 0.5, 0.5]),
  commandRecovery: 0.35
});
