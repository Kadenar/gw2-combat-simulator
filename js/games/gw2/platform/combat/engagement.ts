/** Preparation gates autonomous producers, while implicit combat lets companions initiate the fight. */
export function autonomousActionsAllowed(runtime: {
  readonly deathTime: number | null;
  readonly hasExplicitCombatStart: boolean;
  readonly combatActive: boolean;
}): boolean {
  return runtime.deathTime == null && (!runtime.hasExplicitCombatStart || runtime.combatActive);
}
