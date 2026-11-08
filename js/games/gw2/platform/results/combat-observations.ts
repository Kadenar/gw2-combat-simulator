/** Share combat-window clipping, ordering, and detachment between editor and batch observations. */
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import { projectResolvedEvents } from '#gw2/platform/results/resolved-events.js';
import type { Gw2ResolverResult } from '#gw2/platform/results/types.js';
import { cloneData } from '#kernel/core/clone.js';

export function projectCombatObservations(
  ctx: Pick<Gw2ResolverRuntime, 'resolved' | 'procRecorder'>,
  end: number
): Pick<Gw2ResolverResult, 'resolvedEvents' | 'procSteps'> {
  return {
    resolvedEvents: projectResolvedEvents(
      ctx.resolved.filter((event) => event.at <= end),
      end
    ).sort((left, right) => left.at - right.at),
    procSteps: cloneData(
      (ctx.procRecorder?.steps ?? [])
        .filter((step) => step.start <= Math.round(end * 1000 + 0.1))
        .sort((left, right) => left.start - right.start)
    )
  };
}
