/** Base endurance rules are shared game constants, not profession balance-authoring targets. */
export const ENDURANCE = Object.freeze({
  maximum: 100,
  dodgeCost: 50,
  regenerationPerSecond: 5,
  vigorMultiplier: 1.5,
  maximumRegenerationPerSecond: 10
});

/** Profession bonuses add to Vigor; callers retain any profession-specific regeneration cap. */
export function enduranceRegenerationRate(vigor: boolean, bonus = 0): number {
  return ENDURANCE.regenerationPerSecond * ((vigor ? ENDURANCE.vigorMultiplier : 1) + bonus);
}
