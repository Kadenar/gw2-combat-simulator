// These gaps control the mech's independent attack lane; command cast durations
// reserve that lane separately before commandRecovery resumes the chain.
export const MECHANIST_ATTACK_TIMING = Object.freeze({
  initialDelay: 1,
  // The first arm chains immediately; the second completes its animation before the next pair begins.
  jadeCannonRecovery: Object.freeze([0, 0.08]),
  // The next melee animation follows its measured cast plus a short AI recovery.
  // Hard Strike chains immediately; the later steps typically wait two 40 ms ticks in either boon state.
  meleeChainRecovery: Object.freeze([0, 0.08, 0.08]),
  // Recovery ends at the next windup, whose damage offset is scheduled separately.
  commandRecovery: 0.08
});
