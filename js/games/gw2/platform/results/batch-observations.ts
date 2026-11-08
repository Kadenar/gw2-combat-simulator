/** Return detached damage and proc observations while preserving diagnostic locations and combat-window clipping. */
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { projectCombatObservations } from '#gw2/platform/results/combat-observations.js';
import { locateDiagnostics } from '#gw2/platform/results/diagnostics.js';
import type { Gw2SimulationObservations, Gw2SimulationScore } from '#gw2/platform/results/types.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import { cloneData } from '#kernel/core/clone.js';

export function projectBatchObservations<T extends object>(
  runtime: Gw2Runtime<T>,
  score: Gw2SimulationScore,
  executed: readonly Gw2ResolverEvent[]
): Gw2SimulationObservations {
  const end = score.combatEndTime;
  return {
    ...score,
    output: 'observations',
    warnings: locateDiagnostics(score.warnings, runtime.steps),
    events: cloneData(executed.filter((event) => event.type === 'proc' && event.at <= end)),
    ...projectCombatObservations(runtime, end)
  };
}
