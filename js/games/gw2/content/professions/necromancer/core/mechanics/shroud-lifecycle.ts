import type { NecromancerSchedulerContext, NecromancerSkill } from '#gw2/content/professions/necromancer/types.js';

interface NecromancerShroudLifecycle {
  readonly onEnter?: (context: NecromancerSchedulerContext, skill: NecromancerSkill, at: number) => void;
  readonly onExit?: (context: NecromancerSchedulerContext, at: number, reason: string) => void;
}

type NecromancerResourceAdvance = (context: NecromancerSchedulerContext, start: number, end: number) => void;

const shroudLifecycles = new WeakMap<object, Map<string, NecromancerShroudLifecycle>>();
const resourceAdvanceHandlers = new WeakMap<object, Map<string, NecromancerResourceAdvance>>();

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
export function runNecromancerShroudEnter(
  context: NecromancerSchedulerContext,
  skill: NecromancerSkill,
  at: number
): void {
  for (const lifecycle of shroudLifecycles.get(context.state)?.values() || []) {
    lifecycle.onEnter?.(context, skill, at);
  }
}

/** Notifies every registered module when Core leaves shroud for the supplied reason. */
export function runNecromancerShroudExit(context: NecromancerSchedulerContext, at: number, reason: string): void {
  for (const lifecycle of shroudLifecycles.get(context.state)?.values() || []) {
    lifecycle.onExit?.(context, at, reason);
  }
}

/** Registers specialization-owned resource clocks at Core's single authoritative time-integration point. */
export function registerNecromancerResourceAdvance(
  context: NecromancerSchedulerContext,
  id: string,
  handler: NecromancerResourceAdvance
): void {
  let handlers = resourceAdvanceHandlers.get(context.state);
  if (!handlers) {
    handlers = new Map();
    resourceAdvanceHandlers.set(context.state, handlers);
  }

  handlers.set(id, handler);
}

/** Advances each registered specialization resource clock across the authoritative Core interval. */
export function runNecromancerResourceAdvance(context: NecromancerSchedulerContext, start: number, end: number): void {
  for (const handler of resourceAdvanceHandlers.get(context.state)?.values() || []) {
    handler(context, start, end);
  }
}
