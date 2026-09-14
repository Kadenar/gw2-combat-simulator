import { isDpsReportData, parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { fetchDpsReport } from '#gw2/integrations/logs/dps-report/url.js';
import { normalizeRotation } from '#gw2/platform/engine/execution/rotation.js';
import type { ParsedDpsReport } from '#gw2/integrations/logs/dps-report/types.js';
import type { RotationCommand } from '#gw2/platform/engine/execution/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import {
  alignImportedRotationWaits,
  appLogReconstructionOptions,
  selectActiveBuildLogPlayer
} from '#gw2/app/build/io/log-rotation-import.js';

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
  const rotationModule = await import('#gw2/integrations/logs/dps-report/rotation/index.js');
  const players = rotationModule.detectDpsReportRotationPlayers(report);
  const selected = selectActiveBuildLogPlayer(players, app, 'report', 'Select a single-player report.');
  const reconstructionOptions = appLogReconstructionOptions(app);
  const waitTargets = new Map<number, number>();
  const result = rotationModule.reconstructDpsReportRotation(report, app.activeCatalog, {
    playerIndex: selected.index,
    ...reconstructionOptions,
    onReplayWait: (index, targetMs) => waitTargets.set(index, targetMs)
  });
  // Normalize before replay so correction uses exactly the commands the application will simulate.
  const aligned = alignImportedRotationWaits(
    normalizeRotation(result.rotation, app.activeCatalog, { strict: true }),
    waitTargets,
    app,
    reconstructionOptions.professionConfig
  );
  return {
    rotation: aligned.rotation,
    actionCount: result.actions.length,
    warnings: [...new Set([...result.warnings, ...aligned.warnings])],
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
