import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';

/** Queue focused packets in the production runtime; formula tests can replace query facts at initialization. */
export function resolveTestGw2Events({
  events = [],
  endTime = 0,
  combatStartTime,
  warnings = [],
  profession,
  professionReactions = {},
  query = {},
  helpers = {},
  traits,
  ...options
}) {
  const native =
    profession?.liveRuntimeFor(options.config ?? {}) ??
    defineProfession({ id: 'event-fixture', name: 'Event fixture' }).liveRuntimeFor({});
  return runGw2Runtime({
    ...options,
    combatStartTime,
    rotation: [{ type: 'wait', durationMs: endTime * 1000 }],
    profession: {
      ...native,
      reactions: { ...native.reactions, ...professionReactions },
      initialize(runtime) {
        native.initialize?.(runtime);
        runtime.query = { ...runtime.query, ...query };
        runtime.helpers = { ...runtime.helpers, ...helpers };
        if (traits) runtime.traits = traits;
        runtime.warnings.push(...warnings);
        for (const event of events) runtime.emit(event);
      }
    }
  });
}
