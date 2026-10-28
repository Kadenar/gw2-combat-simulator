import type { EncounterExecutionPhaseDefinition } from '#gw2/app/boss-scenarios/phases.js';
import type { Gw2SimulationResult, SimulationStep } from '#gw2/platform/results/types.js';

export interface EncounterTimelineMarker {
  readonly label: string;
  readonly kind: 'boss' | 'split' | 'intermission' | 'defeated';
  readonly start: number;
  readonly end: number | null;
  readonly insertionIndex: number;
  readonly duringAction: boolean;
}

/** Project observed encounter transitions onto command boundaries without changing the authored rotation. */
export function encounterTimelineMarkers(
  result: Gw2SimulationResult | null | undefined,
  rotationLength: number,
  definitions: readonly EncounterExecutionPhaseDefinition[]
): EncounterTimelineMarker[] {
  if (!result?.encounter) return [];

  const steps = result.steps
    .filter((step) => step.ri >= 0 && !step.invalid)
    .sort((left, right) => left.start - right.start || left.ri - right.ri);
  const placement = (start: number) => ({
    insertionIndex: steps.find((step) => step.start >= start)?.ri ?? rotationLength,
    duringAction: steps.some((step) => step.start < start && step.end > start)
  });
  let boss = 0;
  let split = 0;
  const markers: EncounterTimelineMarker[] = result.encounter.phases.map((phase) => {
    const start = Math.round(phase.start * 1000);
    const definition = definitions.find((entry) => entry.id === phase.id);
    return {
      // Resolve names by stable phase ID so repeated mechanics keep their correct observed boundary.
      label:
        phase.kind === 'boss'
          ? definition?.phaseNumber !== undefined
            ? `Phase ${definition.phaseNumber} · ${definition.label}`
            : `Phase ${++boss}`
          : phase.kind === 'intermission'
            ? definition
              ? `Intermission: ${definition.label}`
              : `Intermission ${split}`
            : `Split ${++split}: ${definition!.label}`,
      kind: phase.kind,
      start,
      end: phase.end === null ? null : Math.round(phase.end * 1000),
      ...placement(start)
    };
  });
  const end = markers.at(-1)?.end;

  if (result.encounter.defeated && end != null)
    markers.push({ label: 'Boss defeated', kind: 'defeated', start: end, end, ...placement(end) });

  return markers;
}

/** Attribute a command by its start while retaining boundaries crossed inside a long cast or wait. */
export function encounterStepContext(step: SimulationStep | undefined, markers: readonly EncounterTimelineMarker[]) {
  if (!step || step.invalid || !markers.length) return { phase: undefined, crossings: [] };

  return {
    phase: markers.filter((marker) => marker.start <= step.start).at(-1),
    crossings: markers.filter((marker) => marker.start > step.start && marker.start < step.end)
  };
}
