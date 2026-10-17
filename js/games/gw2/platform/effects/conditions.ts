/** Canonical condition names shared by authored effects, combat rules, and presentation. */
export const CONDITION = Object.freeze({
  BLEEDING: 'Bleeding',
  BLINDNESS: 'Blindness',
  BURNING: 'Burning',
  CHILLED: 'Chilled',
  CONFUSION: 'Confusion',
  CRIPPLED: 'Crippled',
  FEAR: 'Fear',
  IMMOBILIZED: 'Immobilized',
  POISONED: 'Poisoned',
  SLOW: 'Slow',
  TAUNT: 'Taunt',
  TORMENT: 'Torment',
  VULNERABILITY: 'Vulnerability',
  WEAKNESS: 'Weakness'
});

export type ConditionName = (typeof CONDITION)[keyof typeof CONDITION];
