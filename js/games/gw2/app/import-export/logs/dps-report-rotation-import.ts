import { isDpsReportData, parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { fetchDpsReport } from '#gw2/integrations/logs/dps-report/url.js';
import { fetchWingmanReport } from '#gw2/integrations/logs/wingman/url.js';
import { normalizeRotation } from '#gw2/platform/builds/rotation.js';
import type { ParsedDpsReport } from '#gw2/integrations/logs/dps-report/types.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import {
  appLogReconstructionOptions,
  selectActiveBuildLogPlayer
} from '#gw2/app/import-export/logs/log-rotation-import.js';

export interface ImportedDpsReportRotation {
  readonly rotation: readonly RotationCommand[];
  readonly actionCount: number;
  readonly warnings: readonly string[];
  readonly playerLabel: string;
  readonly phaseLabel: string;
}

/**
 * Reconstructs the active build's rotation from a report that already crossed the source validation boundary.
 * Kept private so unvalidated JSON cannot bypass `parseDpsReport` by claiming the parsed type.
 */
async function reconstructParsedReport(
  report: ParsedDpsReport,
  app: ProfessionAppState
): Promise<ImportedDpsReportRotation> {
  const rotationModule = await import('#gw2/integrations/logs/dps-report/rotation/index.js');
  const players = rotationModule.detectDpsReportRotationPlayers(report);
  const selected = selectActiveBuildLogPlayer(players, app, 'report', 'Select a single-player report.');
  const result = rotationModule.reconstructDpsReportRotation(report, app.activeCatalog, {
    playerIndex: selected.index,
    ...appLogReconstructionOptions(app)
  });
  return {
    // Reconstruction still emits the interchange shape; normalize before it reaches application state.
    // Waits stay log-derived: replaying an incomplete import would misplace idle time around invalid casts.
    rotation: normalizeRotation(result.rotation, app.activeCatalog, { strict: true }),
    actionCount: result.actions.length,
    warnings: result.warnings,
    playerLabel: `${selected.character} (${selected.account || `player ${selected.index}`})`,
    phaseLabel: result.phase.name
  };
}

/** Validates raw Elite Insights JSON once, then reconstructs it for the active build. */
export async function readDpsReportRotationData(
  input: unknown,
  app: ProfessionAppState
): Promise<ImportedDpsReportRotation> {
  if (!isDpsReportData(input)) {
    throw new Error('The JSON is not an Elite Insights dps.report payload.');
  }

  return reconstructParsedReport(parseDpsReport(input), app);
}

/** Fetches a public dps.report permalink; the fetcher already validated the report it returns. */
export async function readDpsReportRotationUrl(
  input: string,
  app: ProfessionAppState,
  fetchImplementation: typeof fetch = fetch
): Promise<ImportedDpsReportRotation> {
  return reconstructParsedReport(await fetchDpsReport(input, fetchImplementation), app);
}

/** Fetches a public gw2wingman log link and reconstructs its validated report through the same dps.report rules. */
export async function readWingmanRotationUrl(
  input: string,
  app: ProfessionAppState
): Promise<ImportedDpsReportRotation> {
  return reconstructParsedReport(await fetchWingmanReport(input), app);
}
