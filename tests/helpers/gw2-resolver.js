import { runRuntime } from '#gw2/platform/simulation/runtime.js';
import { createCombatExecution } from '#gw2/platform/simulation/combat-execution.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

/** Queue focused packets in the production runtime; formula tests can replace query facts at initialization. */
export function resolveTestGw2Events({
  events = [],
  endTime = 0,
  combatStartTime,
  warnings = [],
  profession,
  professionReactions = {},
  engineReactions = {},
  engineInitialize,
  buffPolicies = [],
  query = {},
  helpers = {},
  traits,
  ...options
}) {
  const native =
    profession?.runtimeFor(options.config ?? {}) ??
    defineTestProfession({ id: 'event-fixture', name: 'Event fixture' }).runtimeFor({});
  let owner;
  // Engine formula fixtures override query collaborators through execution setup, outside author callbacks.
  const selected = {
    ...native,
    buffPolicies: (context) => [...(native.buffPolicies?.(context) ?? []), ...buffPolicies],
    // Engine observations close over the execution owner; gameplay callbacks retain their normal capability.
    reactions: {
      ...native.reactions,
      ...professionReactions,
      ...Object.fromEntries(
        Object.entries(engineReactions).map(([stage, handler]) => [
          stage,
          (_context, event, details) => handler(owner, event, details)
        ])
      )
    }
  };
  const execution = createCombatExecution(selected, [{ type: 'wait', durationMs: endTime * 1000 }]);
  return runRuntime({
    ...options,
    combatStartTime,
    profession: selected,
    execution: {
      ...execution,
      initialize(runtime) {
        owner = runtime;
        runtime.query = { ...runtime.query, ...query };
        runtime.helpers = { ...runtime.helpers, ...helpers };
        if (traits) runtime.traits = traits;
        runtime.warnings.push(...warnings);
        engineInitialize?.(runtime);
        for (const event of events) runtime.effects.emit({ kind: 'packet', event: event });
      }
    }
  });
}
