import { createEffectExpansionBudget } from '#gw2/platform/effects/expansion-budget.js';
import { createGw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import { createGw2ResolverReactionRegistry } from '#gw2/platform/resolver/reaction-registry.js';
import { createCombatExecution } from '#gw2/platform/simulation/combat-execution.js';
import { runRuntime } from '#gw2/platform/simulation/runtime.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

/** Synthetic control notifications use the resolver's live stack counter, including configured ambient conditions. */
export function controlTestDetails(config = {}) {
  const { activeConditionStackCount } = createGw2ConditionResolution({
    config,
    expansionBudget: createEffectExpansionBudget(),
    reactions: createGw2ResolverReactionRegistry()
  });
  return { activeConditionStackCount };
}

/** Synthetic reaction callers use a real resolved noncritical hit instead of an empty damage payload. */
export function resolvedTestHitDetails() {
  let resolved;
  resolveTestGw2Events({
    events: [
      {
        type: 'damage',
        at: 0,
        source: 'Fixture',
        sourceId: 'fixture.hit',
        actorType: 'player',
        coefficient: 1,
        weaponStrength: 1000,
        canCrit: false
      }
    ],
    engineReactions: {
      'damage.resolved'(_runtime, _event, details) {
        resolved = details;
      }
    }
  });

  if (!resolved) throw new Error('The reaction fixture must resolve its hit.');

  return resolved;
}

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
