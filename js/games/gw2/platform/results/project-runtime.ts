/** Selects output projection after combat settles; detailed runs must provide their damage report owner. */
import { ACTOR } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { projectBatchObservations } from '#gw2/platform/results/batch-observations.js';
import { buildCombatResult, buildSimulationScore } from '#gw2/platform/results/combat-result.js';
import type { DamageReportProjection } from '#gw2/platform/results/damage-report.js';
import { locateDiagnostics } from '#gw2/platform/results/diagnostics.js';
import { projectInputTrace } from '#gw2/platform/results/input-trace.js';
import { observeRuntimeEffects } from '#gw2/platform/results/observe-effects.js';
import { planningState } from '#gw2/platform/results/planning-state.js';
import { projectResolvedEvents } from '#gw2/platform/results/resolved-events.js';
import { rotationApm } from '#gw2/platform/results/rotation-apm.js';
import type {
  Gw2SimulationObservations,
  Gw2SimulationResult,
  Gw2SimulationScore
} from '#gw2/platform/results/types.js';
import type { DamageRuntimeResult, RuntimeExecution } from '#gw2/platform/simulation/run-contract.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Project settled combat and planning facts without dispatching work or advancing time. */
export function projectRuntimeResult<T extends object>(
  runtime: Gw2Runtime<T>,
  profession: RuntimeProfession<T>,
  execution: RuntimeExecution<T>,
  {
    output,
    executed,
    damageCompletionTime,
    projectDamageReport
  }: {
    output: 'detailed' | 'score' | 'damage' | 'observations';
    executed: Gw2ResolverEvent[];
    damageCompletionTime?: () => number;
    projectDamageReport?: (dpsWindow: number) => DamageReportProjection;
  }
): DamageRuntimeResult | Gw2SimulationResult | Gw2SimulationScore | Gw2SimulationObservations {
  if (runtime.rotationEndTime == null) throw new Error('Results require settled command execution.');

  // Resolution retained only the measurement's owned packets.
  if (output === 'damage') {
    return {
      events: projectResolvedEvents(runtime.resolved, runtime.deathTime ?? runtime.horizon!),
      castSeconds: runtime.steps.length ? (runtime.steps[0].end - runtime.steps[0].start) / 1000 : 0,
      // Pending damage stays incomplete until its actual canonical deadline.
      complete: damageCompletionTime!() <= runtime.time
    };
  }

  const score = buildSimulationScore(runtime, runtime.rotationEndTime);

  if (output === 'score') {
    return score;
  }

  // Include passive proc rows so observations and detailed output retain the same proc timeline.
  if (output === 'observations') {
    execution.report?.(runtime, score.combatEndTime);
    return projectBatchObservations(runtime, score, executed);
  }

  if (!projectDamageReport) throw new Error('Detailed results require a damage report projector.');

  execution.report?.(runtime, score.combatEndTime);
  // Queued companion commands can start later with a different speed; report the executed animation, not its reservation.
  const companionActions = new Map(
    executed
      .filter(
        (event) =>
          event.type === 'action' &&
          event.actorType === ACTOR.SUMMON &&
          event.activationId &&
          event.skillId != null &&
          profession.catalog.skillsById.get(event.skillId)?.independentCast
      )
      .map((event) => [event.activationId, event])
  );
  // Keep actual equipment transitions on authored steps beyond the combat event window; bar refreshes are excluded.
  const weaponSwaps = new Map(
    executed
      .filter(
        (event) =>
          event.type === 'weapon_set' &&
          event.skillId != null &&
          profession.catalog.skillsById.get(event.skillId)?.inputCategory === 'weapon-swap'
      )
      .map((event) => [event.activationId, event.weaponSet])
  );
  const steps = runtime.steps.map((step) => {
    const weaponSwapTo = weaponSwaps.get(step.activationId);

    if (weaponSwapTo != null) step = { ...step, weaponSwapTo };

    const action = companionActions.get(step.activationId);

    if (step.invalid || !action || typeof action.endsAt !== 'number' || typeof action.fullEndsAt !== 'number')
      return step;

    return {
      ...step,
      start: Math.round(action.at * 1000),
      end: Math.round(action.endsAt * 1000),
      fullCastMs: Math.round((action.fullEndsAt - action.at) * 1000),
      interrupted: canonicalTime(action.endsAt) < canonicalTime(action.fullEndsAt)
    };
  });
  // Project accepted commands once so APM and binding activity share the same action population.
  const inputTrace = projectInputTrace(
    runtime.inputActions,
    runtime.engagement.startTime ?? 0,
    runtime.rotationEndTime
  );
  const combat = buildCombatResult(runtime, score, executed, projectDamageReport(score.dpsWindow));
  const result = {
    ...combat,
    ...(runtime.encounter ? { encounter: runtime.encounter.result(score.combatEndTime) } : {}),
    // Delayed notices name their activation; reported steps map it to the authored input once, for every consumer.
    warnings: locateDiagnostics(combat.warnings, steps),
    output: 'detailed' as const,
    // Output consumers may edit their observations without changing accepted command history.
    steps: structuredClone(steps),
    inputTrace,
    rotationApm: rotationApm(
      {
        steps,
        events: executed,
        inputTrace
      },
      execution.driver.cursor.commands,
      profession.catalog
    ),
    planningState: planningState(
      { ...runtime, combatActive: runtime.engagement.active, catalog: profession.catalog },
      profession.projectPlanningState,
      (skill) => {
        const resolved = profession.resolveCastSkill?.(runtime.mechanicQueries, skill) ?? skill;
        return (
          profession.availability?.(runtime.mechanicQueries, resolved, { type: 'cast', skillId: resolved.id }) ?? {
            ready: true
          }
        );
      },
      observeRuntimeEffects(runtime, profession)
    )
  };
  return result;
}
