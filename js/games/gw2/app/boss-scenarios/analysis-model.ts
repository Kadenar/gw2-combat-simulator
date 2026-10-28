import type { EncounterPhaseDefinition } from '#gw2/app/boss-scenarios/phases.js';
import type { ChartEncounterPhase } from '#gw2/app/results/charts/time-series-model.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';

export interface EncounterAnalysisPhase extends ChartEncounterPhase {
  readonly detail: string;
  readonly complete: boolean;
  readonly duration: number;
  readonly playerDamage: number;
  readonly groupDamage: number;
  readonly playerDps: number;
  readonly groupDps: number;
  readonly overallDps: number;
}

/** Project observed stages onto the encounter clock; downtime stays in cumulative DPS and repeats remain distinct. */
export function encounterAnalysisPhases(
  result: Pick<Gw2SimulationResult, 'encounter' | 'dpsStartTime' | 'combatEndTime'>,
  definitions: readonly Pick<EncounterPhaseDefinition, 'id' | 'label' | 'phaseNumber'>[]
): EncounterAnalysisPhase[] {
  let damage = 0;
  let bossIndex = 0;
  let splitIndex = 0;
  return (result.encounter?.phases ?? []).map((phase, index) => {
    const startMs = Math.max(0, phase.start - result.dpsStartTime) * 1000;
    const endMs = Math.max(startMs, (phase.end ?? result.combatEndTime) * 1000 - result.dpsStartTime * 1000);
    const duration = (endMs - startMs) / 1000;
    const startDamage = damage;
    damage += phase.playerDamage;
    const definition = definitions.find((definition) => definition.id === phase.id);
    // Fixed mechanic intermissions retain their name; authored after-split pauses have no definition.
    const detail = phase.kind === 'intermission' ? (definition?.label ?? 'No damage') : definition!.label;
    return {
      id: `encounter-${index}`,
      kind: phase.kind,
      label:
        phase.kind === 'boss'
          ? // Internal health windows need distinct controls while retaining their platform number.
            definition?.phaseNumber !== undefined
            ? `Phase ${definition.phaseNumber} · ${detail}`
            : `Phase ${++bossIndex}`
          : phase.kind === 'intermission'
            ? definition
              ? `Intermission: ${detail}`
              : `Intermission ${splitIndex}`
            : `Split ${++splitIndex}: ${detail}`,
      detail,
      complete: phase.end !== null,
      startMs,
      endMs,
      duration,
      startDamage,
      endDamage: damage,
      playerDamage: phase.playerDamage,
      groupDamage: phase.groupDamage,
      playerDps: duration > 0 ? phase.playerDamage / duration : 0,
      groupDps: duration > 0 ? phase.groupDamage / duration : 0,
      overallDps: endMs > 0 ? damage / (endMs / 1000) : 0
    };
  });
}

/** Damage-phase snapshots belong to the DPS strip; splits remain downtime in the full encounter clock. */
export function encounterDpsSnapshots(phases: readonly EncounterAnalysisPhase[]) {
  return phases
    .filter((phase) => phase.kind === 'boss')
    .map((phase) => ({
      label: phase.label,
      detail: `${phase.detail}${phase.complete ? '' : ' (in progress)'}`,
      dps: phase.playerDps,
      elapsed: phase.endMs / 1000
    }));
}
