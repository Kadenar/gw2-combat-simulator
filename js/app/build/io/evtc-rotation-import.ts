import { normalizeRotation } from '../../../platform/engine/execution/rotation.js';
import type { RotationCommand } from '../../../platform/engine/types.js';
import type { ProfessionAppState } from '../../profession/types.js';
import { appLogReconstructionOptions, selectActiveBuildLogPlayer } from './log-rotation-import.js';

export interface ImportedEvtcRotation {
  readonly rotation: readonly RotationCommand[];
  readonly actionCount: number;
  readonly warnings: readonly string[];
  readonly playerLabel: string;
}

/** True when a selected rotation file should use the existing JSON importer. */
export function isJsonRotationFile(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type.toLowerCase() === 'application/json' || file.name.toLowerCase().endsWith('.json');
}

/** Reads EVTC/ZIP bytes and reconstructs the matching active build's rotation. */
export async function readEvtcRotationFile(file: File, app: ProfessionAppState): Promise<ImportedEvtcRotation> {
  const [{ decompressEvtcInput }, { parseEvtc }, rotationModule] = await Promise.all([
    import('../../../log-analyzer/evtc/decompression.js'),
    import('../../../log-analyzer/evtc/parser.js'),
    import('../../../log-analyzer/evtc/rotation/index.js')
  ]);
  const expanded = await decompressEvtcInput(await file.arrayBuffer());
  const log = parseEvtc(expanded);
  const players = rotationModule.detectEvtcRotationPlayers(log);
  const selected = selectActiveBuildLogPlayer(
    players,
    app,
    'log',
    'Use the EVTC reconstruction CLI with --player=<address>.'
  );
  // Forward active build mechanics when the full app adapter is available;
  // lightweight parser consumers can still use the build's resource default.
  const reconstructionOptions = appLogReconstructionOptions(app, {
    initialTomePages: (
      app.build as ProfessionAppState['build'] & {
        readonly initialTomePages?: number;
      }
    ).initialTomePages
  });
  const result = rotationModule.reconstructEvtcRotation(log, app.activeCatalog, {
    playerAddress: selected.address,
    ...reconstructionOptions
  });
  return {
    // Reconstruction output is an external format; canonicalize it at this boundary.
    rotation: normalizeRotation(result.rotation, app.activeCatalog, {
      strict: true
    }),
    actionCount: result.actions.length,
    warnings: result.warnings,
    playerLabel: `${selected.character} (${selected.account || selected.address})`
  };
}
