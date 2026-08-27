import { normalizeRotation } from '../../../platform/engine/execution/rotation.js';
import type {
  EngineerSerratedSteelObservation,
  EngineerShrapnelObservation
} from '../../../log-analyzer/evtc/rotation/professions/engineer/proc-observations.js';
import type { MesmerSharperImagesObservation } from '../../../log-analyzer/evtc/rotation/professions/mesmer/sharper-images-observation.js';
import type { NecromancerBarbedPrecisionObservation } from '../../../log-analyzer/evtc/rotation/professions/necromancer/barbed-precision-observation.js';
import type { WarriorBloodlustObservation } from '../../../log-analyzer/evtc/rotation/professions/warrior/bloodlust-observation.js';
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
  readonly initialBlight?: number;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2).replace(/\.00$/, '')}%`;
}

interface ProcRateResult {
  readonly matchedApplications: number;
  readonly observedProcRate: number;
  readonly expectedProcChance: number;
  readonly expectedApplications: number;
}

function durationList(durations: readonly number[]): string {
  return durations.map((duration) => `${duration.toLocaleString()} ms`).join(' or ');
}

/** Presents inferred EVTC roll evidence without feeding it into reconstruction or simulation state. */
function procImportObservation(
  result: ProcRateResult | null,
  title: string,
  eligibleHits: number,
  eligibleHitLabel: string,
  detail: string
): RotationImportObservation[] {
  if (!result) return [];
  return [
    {
      title,
      summary: `${result.matchedApplications} matched applications / ${eligibleHits} ${eligibleHitLabel} = ${percent(result.observedProcRate)}; modeled chance ${percent(result.expectedProcChance)} (${result.expectedApplications.toFixed(2)} expected).`,
      detail: `${detail} EVTC does not name the originating trait, so that attribution is inferred by duration.`
    }
  ];
}

function bloodlustImportObservation(result: WarriorBloodlustObservation | null): RotationImportObservation[] {
  return procImportObservation(
    result,
    'Bloodlust proc rate',
    result?.criticalHits || 0,
    'critical hits',
    result
      ? `ArcDPS marked the outgoing strike packets as critical. The applications are player-to-target Bleeding records matching the active build's ${durationList(result.matchedDurationsMs)} Bloodlust duration.`
      : ''
  );
}

function shrapnelImportObservation(result: EngineerShrapnelObservation | null): RotationImportObservation[] {
  return procImportObservation(
    result,
    'Shrapnel proc rate',
    result?.explosionHits || 0,
    'explosion hits',
    result
      ? `The applications are paired player-to-target Bleeding and Crippled records matching the active build's ${durationList(result.matchedBleedingDurationsMs)} and ${durationList(result.matchedCrippledDurationsMs)} durations.`
      : ''
  );
}

function serratedSteelImportObservation(result: EngineerSerratedSteelObservation | null): RotationImportObservation[] {
  return procImportObservation(
    result,
    'Serrated Steel proc rate',
    result?.criticalHits || 0,
    'critical hits',
    result
      ? `ArcDPS marked the outgoing strike packets as critical. The applications are player-to-target Bleeding records matching the active build's ${durationList(result.matchedDurationsMs)} Serrated Steel duration.`
      : ''
  );
}

/** Explains the clone ownership and timing constraints behind inferred Sharper Images applications. */
function sharperImagesImportObservation(result: MesmerSharperImagesObservation | null): RotationImportObservation[] {
  return procImportObservation(
    result,
    'Sharper Images clone proc rate',
    result?.cloneCriticalHits || 0,
    'owned clone critical hits',
    result
      ? `ArcDPS marked the owned clone strike packets as critical. Each application is a same-clone Bleeding record within 50 ms matching the active build's ${durationList(result.matchedDurationsMs)} Sharper Images duration. Phantasm hits are excluded.`
      : ''
  );
}

function barbedPrecisionImportObservation(
  result: NecromancerBarbedPrecisionObservation | null
): RotationImportObservation[] {
  return procImportObservation(
    result,
    'Barbed Precision proc rate',
    result?.criticalHits || 0,
    'critical hits',
    result
      ? `ArcDPS marked the outgoing strike packets as critical. The applications are player-to-target Bleeding records matching the active build's ${durationList(result.matchedDurationsMs)} Barbed Precision duration.`
      : ''
  );
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
  const playerAddress = BigInt(selected.address);
  const observations: RotationImportObservation[] = [];
  if (selected.professionId === 'warrior') {
    observations.push(
      ...bloodlustImportObservation(
        rotationModule.analyzeWarriorBloodlustObservation(
          log,
          playerAddress,
          app.activeCatalog,
          reconstructionOptions.professionConfig
        )
      )
    );
  }

  if (selected.professionId === 'engineer') {
    observations.push(
      ...shrapnelImportObservation(
        rotationModule.analyzeEngineerShrapnelObservation(
          log,
          playerAddress,
          app.activeCatalog,
          reconstructionOptions.professionConfig
        )
      ),
      ...serratedSteelImportObservation(
        rotationModule.analyzeEngineerSerratedSteelObservation(
          log,
          playerAddress,
          app.activeCatalog,
          reconstructionOptions.professionConfig
        )
      )
    );
  }

  if (selected.professionId === 'mesmer') {
    observations.push(
      ...sharperImagesImportObservation(
        rotationModule.analyzeMesmerSharperImagesObservation(
          log,
          playerAddress,
          app.activeCatalog,
          reconstructionOptions.professionConfig
        )
      )
    );
  }

  if (selected.professionId === 'necromancer') {
    observations.push(
      ...barbedPrecisionImportObservation(
        rotationModule.analyzeNecromancerBarbedPrecisionObservation(
          log,
          playerAddress,
          app.activeCatalog,
          reconstructionOptions.professionConfig
        )
      )
    );
  }

  return {
    // Reconstruction output is an external format; canonicalize it at this boundary.
    rotation: normalizeRotation(result.rotation, app.activeCatalog, {
      strict: true
    }),
    actionCount: result.actions.length,
    warnings: result.warnings,
    observations,
    playerLabel: `${selected.character} (${selected.account || selected.address})`,
    ...(selected.specializationId === 'harbinger'
      ? { initialBlight: rotationModule.initialHarbingerBlight(log, playerAddress) }
      : {})
  };
}
