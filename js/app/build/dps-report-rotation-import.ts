import { isDpsReportData, parseDpsReport } from '../../dps-report-analyzer/parser.js';
import { fetchDpsReport } from '../../dps-report-analyzer/url.js';
import type { ParsedDpsReport } from '../../dps-report-analyzer/types.js';
import type { LegacyRotationItem } from '../../platform/engine/types.js';
import type { ProfessionAppState } from '../profession/types.js';

export interface ImportedDpsReportRotation {
  readonly rotation: readonly LegacyRotationItem[];
  readonly actionCount: number;
  readonly warnings: readonly string[];
  readonly playerLabel: string;
  readonly phaseLabel: string;
}

function reconstructionOptions(app: ProfessionAppState): {
  readonly selectedSkillNames: readonly string[];
  readonly selectedSkillIds: readonly number[];
  readonly professionConfig: Readonly<Record<string, unknown>>;
} {
  return {
    selectedSkillNames: Object.values(app.build.selectedSkills || {}),
    selectedSkillIds: [
      ...((app.build as { selectedMorphSkillIds?: readonly number[] }).selectedMorphSkillIds || [])
    ],
    professionConfig: app.adapter.simulationConfig?.(app) || {}
  };
}

/** Reconstructs the active build's rotation from validated Elite Insights report data. */
export async function readDpsReportRotationData(
  input: unknown,
  app: ProfessionAppState
): Promise<ImportedDpsReportRotation> {
  if (!isDpsReportData(input)) {
    throw new Error('The JSON is not an Elite Insights dps.report payload.');
  }
  const report = parseDpsReport(input);
  const rotationModule = await import('../../dps-report-analyzer/rotation/index.js');
  const activeSpecialization = app.adapter.eliteSpecialization(app.build).trim().toLowerCase();
  const players = rotationModule.detectDpsReportRotationPlayers(report);
  const matchingPlayers = players.filter(
    (player) =>
      player.professionId === app.profession.id && player.specializationId === activeSpecialization
  );
  if (!matchingPlayers.length) {
    const recorded = players
      .map((player) => `${player.character} (${player.professionName} ${player.specializationName})`)
      .join(', ');
    throw new Error(
      `This report has no ${app.profession.name} ${app.adapter.eliteSpecialization(app.build)} player.` +
        (recorded ? ` Recorded players: ${recorded}.` : '')
    );
  }
  if (
    matchingPlayers.length > 1 &&
    matchingPlayers[0].recordedActionCount === matchingPlayers[1].recordedActionCount
  ) {
    throw new Error('Multiple matching players have the same recorded action count. Select a single-player report.');
  }
  const selected = matchingPlayers[0];
  const result = rotationModule.reconstructDpsReportRotation(report, app.activeCatalog, {
    playerIndex: selected.index,
    ...reconstructionOptions(app)
  });
  return {
    rotation: result.rotation as readonly LegacyRotationItem[],
    actionCount: result.actions.length,
    warnings: result.warnings,
    playerLabel: `${selected.character} (${selected.account || `player ${selected.index}`})`,
    phaseLabel: result.phase.name
  };
}

/** Fetches a public dps.report permalink and reconstructs it for the active build. */
export async function readDpsReportRotationUrl(
  input: string,
  app: ProfessionAppState,
  fetchImplementation: typeof fetch = fetch
): Promise<ImportedDpsReportRotation> {
  const report: ParsedDpsReport = await fetchDpsReport(input, fetchImplementation);
  return readDpsReportRotationData(report, app);
}
