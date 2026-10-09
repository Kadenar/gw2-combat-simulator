import { canonicalTime } from '#kernel/core/clock.js';

/** Preparation gates autonomous producers, while implicit combat lets companions initiate the fight. */
export function autonomousActionsAllowed(runtime: {
  readonly deathTime: number | null;
  combatStartedAt(): boolean;
}): boolean {
  return runtime.deathTime == null && runtime.combatStartedAt();
}

/** Authored setup ends only after its marker is consumed, even if a same-time hostile packet lands first. */
export function combatStartedAt(
  runtime: {
    readonly time: number;
    readonly hasExplicitCombatStart: boolean;
    readonly combatActive: boolean;
    readonly combatStartTime?: number | null;
    readonly combatStartPending?: boolean;
    readonly cursor: { readonly command?: { readonly type: string } | null };
  },
  at = runtime.time
): boolean {
  if (!runtime.hasExplicitCombatStart) return true;
  return (
    !runtime.combatStartPending &&
    runtime.cursor.command?.type !== 'combat-start' &&
    runtime.combatActive &&
    runtime.combatStartTime != null &&
    canonicalTime(at) >= runtime.combatStartTime
  );
}
