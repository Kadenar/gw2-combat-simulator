import { simulateDeclarativeGw2, simulateDeclarativeGw2Score } from '#gw2/platform/simulation/pipeline.js';
import { runCombatEngine } from '#gw2/platform/combat-engine/run.js';
import { rejectPreviewInput } from '#gw2/platform/simulation/combat-engine-adapter/input.js';
import type {
  CombatPreviewInput,
  CombatPreviewCompiler
} from '#gw2/platform/simulation/combat-engine-adapter/input.js';
import { adaptObservation } from '#gw2/platform/simulation/combat-engine-adapter/observation.js';
import { adaptResult } from '#gw2/platform/simulation/combat-engine-adapter/result.js';
import type { CombatPreviewOutcome } from '#gw2/platform/simulation/combat-engine-adapter/result.js';
import { runCombatPrefix } from '#gw2/platform/simulation/combat-engine-adapter/prefix.js';
import type { CombatPrefixOutcome } from '#gw2/platform/simulation/combat-engine-adapter/prefix.js';
import type { Gw2SimulationScore } from '#gw2/platform/simulation/types.js';
import type { Gw2DeclarativeSimulationOptions, Gw2SimulationResult } from '#gw2/platform/simulation/types.js';

/** Preview pairs UI reporting with the unchanged engine's reference result. */
export type CombatPreviewOptions = CombatPreviewInput &
  Pick<Gw2DeclarativeSimulationOptions, 'profession'> & {
    readonly output?: 'score' | 'detailed';
    readonly seed?: number;
  };

/** Canonical GW2 boundary selects the runtime once, preserving legacy behavior for unselected callers. */
export function simulateGw2(
  options: CombatPreviewOptions & { operation: 'prefix'; insertionIndex: number }
): CombatPrefixOutcome;
export function simulateGw2(options: CombatPreviewOptions): CombatPreviewOutcome | CombatPrefixOutcome;
export function simulateGw2(options: Gw2DeclarativeSimulationOptions & { output: 'score' }): Gw2SimulationScore;
export function simulateGw2(options: Gw2DeclarativeSimulationOptions & { output?: 'detailed' }): Gw2SimulationResult;
export function simulateGw2(
  options: (Gw2DeclarativeSimulationOptions & { output?: 'detailed' | 'score' }) | CombatPreviewOptions
): Gw2SimulationResult | Gw2SimulationScore | CombatPreviewOutcome | CombatPrefixOutcome {
  // Select before execution, including score requests; unsupported previews never retry through the legacy pipeline.
  if (options.selection?.engine === 'preview') {
    const allowed = [
      'profession',
      'selection',
      'rotation',
      'operation',
      'insertionIndex',
      'output',
      'seed',
      'gameId',
      'contentId',
      'observationPolicy'
    ];
    for (const key of Object.keys(options)) {
      if (!allowed.includes(key))
        rejectPreviewInput(key, 'This option is not supported by the preview request contract.');
    }

    const preview = options as CombatPreviewOptions;
    if (preview.output !== undefined && preview.output !== 'score' && preview.output !== 'detailed')
      rejectPreviewInput('output', 'Unknown output mode.');
    if (preview.seed !== undefined && !Number.isSafeInteger(preview.seed))
      rejectPreviewInput('seed', 'Expected an integer seed.');
    if (preview.operation !== undefined && preview.operation !== 'baseline' && preview.operation !== 'prefix')
      rejectPreviewInput('operation', `The preview does not support ${preview.operation}.`);
    const compile = preview.profession.simulation?.compileCombatPreview as CombatPreviewCompiler | undefined;
    if (typeof compile !== 'function') rejectPreviewInput('profession', 'This profession has no preview content.');
    if (preview.operation === 'prefix') {
      const index = preview.insertionIndex;
      if (
        !Array.isArray(preview.rotation) ||
        !Number.isSafeInteger(index) ||
        index! < 0 ||
        index! > preview.rotation.length
      )
        rejectPreviewInput('insertionIndex', 'Expected an insertion index within the rotation.');
      if (preview.output === 'score') rejectPreviewInput('output', 'Prefix requests return state, not a score.');
      // Observation tails belong to damage reports; prefix state always ends at its own command boundary.
      return runCombatPrefix(
        compile({ ...preview, operation: 'baseline', rotation: preview.rotation.slice(0, index) }),
        index!,
        preview.seed
      );
    }

    if (preview.insertionIndex !== undefined)
      rejectPreviewInput('insertionIndex', 'An insertion index requires a prefix request.');
    const compiled = adaptObservation(compile(preview), preview.observationPolicy);
    // ponytail: window accounting needs audits; a generic compact engine observer can remove score-mode history cost later.
    const result = runCombatEngine({ ...compiled, output: 'detailed', seed: preview.seed });
    // Generated keys retain the responsible UI command even when validation fails during live engine execution.
    if (!result.ok) {
      const sourceIndex = /adapter\.command\.(\d+):/.exec(result.message)?.[1];
      if (sourceIndex !== undefined) return { ...result, path: `rotation[${sourceIndex}]` };
    }

    return result.ok ? adaptResult(result, compiled, preview, preview.profession.catalog, preview.output) : result;
  }

  if (options.selection && options.selection.engine !== 'legacy')
    rejectPreviewInput('selection.engine', 'Unknown simulation engine.');
  const legacy = options as Gw2DeclarativeSimulationOptions & { output?: 'detailed' | 'score' };
  if (legacy.config?.engineSelection && legacy.config.engineSelection.engine !== 'legacy') {
    rejectPreviewInput('config.engineSelection', 'This operation requires the explicit preview request contract.');
  }

  return legacy.output === 'score' ? simulateDeclarativeGw2Score(legacy) : simulateDeclarativeGw2(legacy);
}
