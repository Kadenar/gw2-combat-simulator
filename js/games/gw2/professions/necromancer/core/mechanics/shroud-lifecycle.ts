import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

interface NecromancerShroudLifecycle {
  readonly onEnter?: (skill: NecromancerSkill) => void;
  readonly onExit?: () => void;
  readonly onDepletion?: () => void;
}

// Runtime ownership keeps selected-module subscriptions isolated between simulations.
const shroudLifecycles = new WeakMap<NecromancerRuntime, Map<string, NecromancerShroudLifecycle>>();

/** Registers specialization-owned shroud behavior while keeping Core unaware of active module identities. */
export function registerNecromancerShroudLifecycle(
  owner: NecromancerRuntime,
  id: string,
  lifecycle: NecromancerShroudLifecycle
): void {
  let registrations = shroudLifecycles.get(owner);
  if (!registrations) {
    registrations = new Map();
    shroudLifecycles.set(owner, registrations);
  }

  registrations.set(id, lifecycle);
}

/** Notifies every registered module after Core has established the entered shroud state. */
export function runNecromancerShroudEnter(owner: NecromancerRuntime, skill: NecromancerSkill): void {
  for (const lifecycle of shroudLifecycles.get(owner)?.values() || []) {
    lifecycle.onEnter?.(skill);
  }
}

/** Notifies every registered module when Core leaves shroud for the supplied reason. */
export function runNecromancerShroudExit(owner: NecromancerRuntime): void {
  for (const lifecycle of shroudLifecycles.get(owner)?.values() || []) {
    lifecycle.onExit?.();
  }
}

/** Resource exhaustion also ends specialization-owned lifetimes that can survive an ordinary shroud exit. */
export function runNecromancerLifeForceDepletion(owner: NecromancerRuntime): void {
  for (const lifecycle of shroudLifecycles.get(owner)?.values() || []) lifecycle.onDepletion?.();
}
