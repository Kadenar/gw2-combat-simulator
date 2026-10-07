import { projectResolvedEvents } from '#gw2/platform/results/resolved-events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { buildCombatResult, buildSimulationScore } from '#gw2/platform/results/combat-result.js';
import { planningState } from '#gw2/platform/results/planning-state.js';
import { observeRuntimeEffects } from '#gw2/platform/results/observe-effects.js';
import { rotationApm } from '#gw2/platform/results/rotation-apm.js';
import type { DamageRuntimeResult, RuntimeExecution } from '#gw2/platform/simulation/run-contract.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2SimulationResult, Gw2SimulationScore } from '#gw2/platform/results/types.js';
import { EPSILON } from '#kernel/core/clock.js';

import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';

/** Project settled combat and planning facts without dispatching work or advancing time. */
export function projectRuntimeResult<T extends object>(
  runtime: Gw2Runtime<T>,
  profession: RuntimeProfession<T>,
  execution: RuntimeExecution<T>,
  {
    output,
    explicitCombat,
    executed,
    ownsEffect,
    damageCompletionTime
  }: {
    output: 'detailed' | 'score' | 'damage';
    explicitCombat: boolean;
    executed: Gw2ResolverEvent[];
    ownsEffect?: (event: SimulationEventBase) => boolean;
    damageCompletionTime?: () => number;
  }
): DamageRuntimeResult | Gw2SimulationResult | Gw2SimulationScore {
  if (runtime.rotationEndTime == null) throw new Error('Results require settled command execution.');

  if (ownsEffect) {
    return {
      events: projectResolvedEvents(runtime.resolved.filter(ownsEffect), runtime.deathTime ?? runtime.horizon!),
      castSeconds: runtime.steps.length ? (runtime.steps[0].end - runtime.steps[0].start) / 1000 : 0,
      complete: damageCompletionTime!() <= runtime.time + EPSILON
    };
  }

  const score = buildSimulationScore(runtime, runtime.rotationEndTime, explicitCombat);
  if (output === 'score') {
    return score;
  }

  execution.report?.(runtime, score.combatEndTime);
  // Queued companion commands can start later with a different speed; report the executed animation, not its reservation.
  const companionActions = new Map(
    executed
      .filter(
        (event) =>
          event.type === 'action' &&
          event.actorType === 'summon' &&
          event.activationId &&
          event.skillId != null &&
          profession.catalog.skillsById.get(event.skillId)?.independentCast
      )
      .map((event) => [event.activationId, event])
  );
  const steps = runtime.steps.map((step) => {
    const action = companionActions.get(step.activationId);
    if (step.invalid || !action || typeof action.endsAt !== 'number' || typeof action.fullEndsAt !== 'number')
      return step;
    return {
      ...step,
      start: Math.round(action.at * 1000),
      end: Math.round(action.endsAt * 1000),
      fullCastMs: Math.round((action.fullEndsAt - action.at) * 1000),
      interrupted: action.endsAt < action.fullEndsAt - EPSILON
    };
  });
  const result = {
    ...buildCombatResult(runtime, score, executed),
    output: 'detailed' as const,
    // Output consumers may edit their observations without changing accepted command history.
    steps: structuredClone(steps),
    rotationApm: rotationApm(
      {
        steps,
        events: executed,
        rotationEndTime: runtime.rotationEndTime,
        combatStartTime: explicitCombat ? (runtime.combatStartTime ?? null) : null
      },
      execution.driver.cursor.commands,
      profession.catalog
    ),
    planningState: planningState(
      { ...runtime, catalog: profession.catalog },
      profession.projectPlanningState,
      (skill) =>
        profession.availability?.(runtime.mechanicQueries, skill, { type: 'cast', skillId: skill.id }) ?? {
          ready: true
        },
      observeRuntimeEffects(runtime, profession)
    )
  };
  return result;
}
