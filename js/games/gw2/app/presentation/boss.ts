import type { BossScenarioDraft } from '#gw2/app/boss-scenarios/model.js';
import { encounterPhasePlan, encounterExecutionPhases } from '#gw2/app/boss-scenarios/phases.js';
import { encounterAnalysisPhases, encounterDpsSnapshots } from '#gw2/app/boss-scenarios/analysis-model.js';
import { mountEncounterAnalysis } from '#gw2/app/boss-scenarios/analysis-view.js';
import { encounterTimelineMarkers } from '#gw2/app/rotation/timeline/encounter.js';
import { presentationMetrics, type WorkspacePresentation } from '#gw2/app/presentation/model.js';

/** Boss presentation owns phase interpretation and excludes Golem health assumptions and patch comparison. */
export function createBossPresentation(scenario: BossScenarioDraft): WorkspacePresentation {
  // Resolve only when a result needs projection, so empty and pending scenarios need no phase interpretation.
  const definitions = () =>
    encounterExecutionPhases(encounterPhasePlan(scenario.encounterId, scenario.difficulty).phases);
  return {
    analysisTitle: `${scenario.encounter} analysis`,
    authoringLink: { href: '#bosses', label: 'Bosses' },
    timeline(_app, build, result) {
      return {
        healthMarkers: [],
        encounterMarkers: result?.encounter
          ? encounterTimelineMarkers(result, build.rotation.length, definitions())
          : [],
        downtimePhases: result?.encounter?.phases ?? []
      };
    },
    results(app, result) {
      // A pending scenario must not borrow another encounter's results or Golem health snapshots.
      if (!result.encounter || app.resultRevision !== app.buildRevision) return null;

      const encounter = result.encounter;
      const phases = encounterAnalysisPhases(result, definitions());
      const metrics = presentationMetrics(result).map((metric) =>
        metric.label === 'Environment Damage'
          ? {
              ...metric,
              label: 'Group Damage',
              details: [{ label: 'Group DPS', value: Math.round(result.environmentDps).toLocaleString() }]
            }
          : metric.label === 'Target Damage'
            ? { ...metric, label: 'Encounter Damage' }
            : metric
      );
      return {
        summary: { metrics, breakpoints: [], phaseSnapshots: encounterDpsSnapshots(phases) },
        chartOptions: {
          healthBreakpoints: [],
          encounterPhases: phases,
          targetStartingHealthPercent: 100,
          targetDied: result.deathTime != null
        },
        analysisPanels: [
          { kind: 'extension', mount: (container) => mountEncounterAnalysis(container, encounter, phases) }
        ]
      };
    }
  };
}
