export const DEFAULT_TARGET_CONDITIONS = Object.freeze({
  Bleeding: 1,
  Burning: true,
  Torment: 1,
  Confusion: 1,
  Poisoned: true,
  Chilled: true,
  Cripple: true,
  Slow: true,
  Weakness: true,
  Vulnerability: 25,
});

export function createDefaultTargetConditions() {
  return { ...DEFAULT_TARGET_CONDITIONS };
}
