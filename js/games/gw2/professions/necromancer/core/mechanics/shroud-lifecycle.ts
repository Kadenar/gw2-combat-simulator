import type { NecromancerSchedulerContext, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

interface NecromancerShroudLifecycle {
  readonly onEnter?: (context: NecromancerSchedulerContext, skill: NecromancerSkill) => void;
  readonly onExit?: (context: NecromancerSchedulerContext) => void;
}

const shroudLifecycles = new WeakMap<object, Map<string, NecromancerShroudLifecycle>>();

/** Registers specialization-owned shroud behavior while keeping Core unaware of active module identities. */
export function registerNecromancerShroudLifecycle(
  context: NecromancerSchedulerContext,
  id: string,
  lifecycle: NecromancerShroudLifecycle
): void {
  let registrations = shroudLifecycles.get(context.state);
  if (!registrations) {
    registrations = new Map();
    shroudLifecycles.set(context.state, registrations);
  }

  registrations.set(id, lifecycle);
}

/** Notifies every registered module after Core has established the entered shroud state. */
export function runNecromancerShroudEnter(context: NecromancerSchedulerContext, skill: NecromancerSkill): void {
  for (const lifecycle of shroudLifecycles.get(context.state)?.values() || []) {
    lifecycle.onEnter?.(context, skill);
  }
}

/** Notifies every registered module when Core leaves shroud for the supplied reason. */
export function runNecromancerShroudExit(context: NecromancerSchedulerContext): void {
  for (const lifecycle of shroudLifecycles.get(context.state)?.values() || []) {
    lifecycle.onExit?.(context);
  }
}
