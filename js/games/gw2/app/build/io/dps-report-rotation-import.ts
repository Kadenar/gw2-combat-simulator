import { isDpsReportData, parseDpsReport } from '../../../integrations/logs/dps-report/parser.js';
import { fetchDpsReport } from '../../../integrations/logs/dps-report/url.js';
import { normalizeRotation } from '../../../platform/engine/execution/rotation.js';
import type { ParsedDpsReport } from '../../../integrations/logs/dps-report/types.js';
import type { RotationCommand } from '../../../platform/engine/types.js';
import type { ProfessionAppState } from '../../types.js';
import { appLogReconstructionOptions, selectActiveBuildLogPlayer } from './log-rotation-import.js';

export interface ImportedDpsReportRotation {
  readonly rotation: readonly RotationCommand[];
  readonly actionCount: number;
  readonly warnings: readonly string[];
  readonly playerLabel: string;
  readonly phaseLabel: string;
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
  const rotationModule = await import('../../../integrations/logs/dps-report/rotation/index.js');
  const players = rotationModule.detectDpsReportRotationPlayers(report);
  const selected = selectActiveBuildLogPlayer(players, app, 'report', 'Select a single-player report.');
  const result = rotationModule.reconstructDpsReportRotation(report, app.activeCatalog, {
    playerIndex: selected.index,
    ...appLogReconstructionOptions(app)
  });
  return {
    // Reconstruction still emits the interchange shape; normalize before it reaches application state.
    rotation: normalizeRotation(result.rotation, app.activeCatalog, { strict: true }),
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
