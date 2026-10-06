import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

// Rounded Quickness animation durations measured from the mech's logged
// activations; command recovery is applied separately before basic attacks resume.
export const MECHANIST_COMMAND_DURATIONS: Readonly<Record<number, number>> = Object.freeze({
  [ID.SPARK_REVOLVER]: 1.4,
  [ID.CORE_REACTOR_SHOT]: 1,
  [ID.JADE_MORTAR]: 1.08,
  [ID.ROLLING_SMASH]: 1.52,
  [ID.BARRIER_BURST]: 4.44
});

// These gaps control the mech's independent attack lane; command cast durations
// above reserve that lane separately before commandRecovery resumes the chain.
export const MECHANIST_ATTACK_TIMING = Object.freeze({
  initialDelay: 1,
  jadeCannonArmGap: 0.5,
  jadeCannonCycleGap: 1.075,
  // Full attack-to-attack gaps include recovery, unlike the tooltip's activation times.
  // Wingman log 56d7f-kotick1746_20260531-181544_StdGolem_kill shows Quickness gaps of 0.32, 0.76, and 1.12 seconds;
  // store their unaccelerated equivalents because the live loop applies the mech's action rate.
  meleeChainIntervals: Object.freeze([0.48, 1.14, 1.68]),
  commandRecovery: 0.35
});
