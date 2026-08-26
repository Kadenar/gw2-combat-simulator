import { normalizeRotation } from '../../../platform/engine/execution/rotation.js';
import { analyzeWarriorBloodlustObservation } from '../../../log-analyzer/evtc/rotation/professions/warrior/bloodlust-observation.js';
import type { RotationCommand } from '../../../platform/engine/types.js';
import type { ProfessionAppState } from '../../profession/types.js';
import { appLogReconstructionOptions, selectActiveBuildLogPlayer } from './log-rotation-import.js';
import type { RotationImportObservation } from './rotation-import-model.js';

export interface ImportedEvtcRotation {
  readonly rotation: readonly RotationCommand[];
  readonly actionCount: number;
  readonly warnings: readonly string[];
  readonly observations: readonly RotationImportObservation[];
  readonly playerLabel: string;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2).replace(/\.00$/, '')}%`;
}

/** Presents inferred EVTC roll evidence without feeding it into reconstruction or simulation state. */
function bloodlustImportObservation(
  result: ReturnType<typeof analyzeWarriorBloodlustObservation>
): RotationImportObservation[] {
  if (!result) return [];
  const durations = result.matchedDurationsMs.map((duration) => `${duration.toLocaleString()} ms`).join(' or ');
  return [
    {
      title: 'Bloodlust proc rate',
      summary: `${result.matchedApplications} matched applications / ${result.criticalHits} critical hits = ${percent(result.observedProcRate)}; configured chance ${percent(result.expectedProcChance)} (${result.expectedApplications.toFixed(2)} expected).`,
      detail: `ArcDPS marked the outgoing strike packets as critical. The applications are player-to-target Bleeding records matching the active build's ${durations} Bloodlust duration. EVTC does not name the originating trait, so that attribution is inferred by duration.`
    }
  ];
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
  const bloodlust =
    selected.professionId === 'warrior'
      ? analyzeWarriorBloodlustObservation(
          log,
          BigInt(selected.address),
          app.activeCatalog,
          reconstructionOptions.professionConfig
        )
      : null;
  return {
    // Reconstruction output is an external format; canonicalize it at this boundary.
    rotation: normalizeRotation(result.rotation, app.activeCatalog, {
      strict: true
    }),
    actionCount: result.actions.length,
    warnings: result.warnings,
    observations: bloodlustImportObservation(bloodlust),
    playerLabel: `${selected.character} (${selected.account || selected.address})`
  };
}
