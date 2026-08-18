export const DEFAULT_TARGET_CONDITIONS: Readonly<Record<string, number | boolean>> = Object.freeze({
  Bleeding: 1,
  Burning: true,
  Torment: 1,
  Confusion: 1,
  Poisoned: true,
  Chilled: true,
  Cripple: true,
  Slow: true,
  Weakness: true,
  Vulnerability: 25
});

export function createDefaultTargetConditions(): Record<string, number | boolean> {
  return { ...DEFAULT_TARGET_CONDITIONS };
}
