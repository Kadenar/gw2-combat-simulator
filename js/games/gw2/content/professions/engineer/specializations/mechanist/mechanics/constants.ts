import { ENGINEER_SKILL_IDS as ID } from '../../../data/ids.js';

// Rounded Quickness animation durations measured from the mech's EVTC
// activations; command recovery is applied separately before basic attacks resume.
export const MECHANIST_COMMAND_DURATIONS: Readonly<Record<number, number>> = Object.freeze({
  [ID.SPARK_REVOLVER]: 1.4,
  [ID.CORE_REACTOR_SHOT]: 1,
  [ID.JADE_MORTAR]: 1.08
});

// These gaps control the mech's independent attack lane; command cast durations
// above reserve that lane separately before commandRecovery resumes the chain.
export const MECHANIST_ATTACK_TIMING = Object.freeze({
  jadeCannonArmGap: 0.5,
  jadeCannonCycleGap: 1.075,
  meleeChainIntervals: Object.freeze([0.25, 0.5, 0.5]),
  commandRecovery: 0.35
});
