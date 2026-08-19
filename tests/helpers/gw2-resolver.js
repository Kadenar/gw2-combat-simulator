import { createGw2ConditionResolution } from '../../js/platform/gw2/resolver/condition-resolution.js';
import { createGw2ResolverEventHandlers } from '../../js/platform/gw2/resolver/event-handlers.js';
import { createGw2HitResolution } from '../../js/platform/gw2/resolver/hit-resolution.js';
import { createGw2ResolverExtensions } from '../../js/platform/gw2/resolver/extensions.js';
import { resolveGw2Timeline } from '../../js/platform/gw2/resolver/resolve-timeline.js';
import { createGw2ResolverRuntimeState } from '../../js/platform/gw2/resolver/runtime-state.js';

/**
 * Resolves a hand-built canonical stream in architecture tests without a
 * profession-specific resolver wrapper.
 */
export function resolveTestGw2Stream({ stream, config, traits, query, helpers }) {
  const extensions = createGw2ResolverExtensions({
    config,
    events: stream.events
  });
  const hits = createGw2HitResolution({
    strikeMultiplier: extensions.strikeMultiplier
  });
  const conditions = createGw2ConditionResolution({
    reactions: extensions.reactions
  });
  const commonHandlers = createGw2ResolverEventHandlers({
    hitResolution: {
      buildContext: hits.buildHitResolutionContext,
      apply: hits.applyResolvedHit
    },
    conditions: {
      activeStackCount: conditions.activeConditionStackCount,
      apply: conditions.applyCondition,
      tick: conditions.handleConditionTick
    },
    reactions: extensions.reactions
  });

  return resolveGw2Timeline({
    stream,
    config,
    traits,
    query,
    helpers,
    createRuntimeState: (options) =>
      createGw2ResolverRuntimeState({
        ...options,
        createEquipmentState: extensions.createEquipmentState
      }),
    commonHandlers,
    beforeResolveTimeline: extensions.beforeResolveTimeline
  });
}
