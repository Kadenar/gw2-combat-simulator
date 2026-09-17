/** Owns selection and validation at the application-to-engine boundary; engine configuration stays unchanged. */
import { ConfigurationError } from '#gw2/platform/combat-engine/configuration.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { EngineRequest } from '#gw2/platform/combat-engine/types.js';
import type { ObservationPolicy } from '#gw2/platform/engine/execution/types.js';

export type EngineSelection = { readonly engine: 'legacy' } | CombatPreviewSelection;
export interface CombatPreviewSelection {
  readonly engine: 'preview';
  readonly contentRevision: string;
  readonly patchId: 'reference';
  readonly build: Gw2CanonicalBuild;
}

export interface CombatPreviewInput {
  readonly selection: CombatPreviewSelection;
  readonly rotation: readonly unknown[];
  readonly operation?: string;
  readonly insertionIndex?: number;
  readonly observationPolicy?: ObservationPolicy | { readonly kind: 'active-skills' };
}

export interface AdaptedEngineRequest extends EngineRequest {
  /** Unique generated skill keys identify accepted commands without adding UI metadata to the engine. */
  readonly commandSkills: readonly {
    readonly sourceIndex: number;
    readonly skillId?: number;
    readonly skillKey: string;
    readonly type: string;
    readonly fullCastMs: number;
    readonly interrupted: boolean;
    readonly cancelledBeforeCommit: boolean;
  }[];
  readonly damageSources: Readonly<
    Record<
      string,
      { readonly name: string; readonly skillId?: number; readonly sourceIndex?: number; readonly parentSkill?: string }
    >
  >;
}
export type CombatPreviewCompiler = (input: CombatPreviewInput) => AdaptedEngineRequest;

export function rejectPreviewInput(path: string, message: string): never {
  throw new ConfigurationError('preview.unsupported-input', path, message);
}

/** Validate without normalizing away unsupported fields or losing their source indices. */
export function readCommands(rotation: readonly unknown[]): Record<string, unknown>[] {
  if (!Array.isArray(rotation)) rejectPreviewInput('rotation', 'Expected an array of commands.');
  let combatStart = false;
  return rotation.map((value, sourceIndex) => {
    const path = `rotation[${sourceIndex}]`;
    if (!value || typeof value !== 'object' || Array.isArray(value)) rejectPreviewInput(path, 'Expected a command.');
    const command = value as Record<string, unknown>;
    const allowed =
      command.type === 'cast'
        ? ['type', 'skillId', 'offTarget', 'concurrentOffsetMs', 'interruptAfterMs']
        : command.type === 'wait'
          ? ['type', 'durationMs']
          : command.type === 'combat-start'
            ? ['type', 'concurrentOffsetMs']
            : [];
    if (!allowed.length) rejectPreviewInput(`${path}.type`, `Unsupported command ${String(command.type)}.`);
    for (const key of Object.keys(command)) {
      if (!allowed.includes(key))
        rejectPreviewInput(`${path}.${key}`, 'This command option is not supported by the preview.');
    }

    for (const key of ['durationMs', 'concurrentOffsetMs', 'interruptAfterMs']) {
      if (
        command[key] !== undefined &&
        (!Number.isSafeInteger(command[key]) || (key !== 'concurrentOffsetMs' && Number(command[key]) < 0))
      ) {
        rejectPreviewInput(`${path}.${key}`, 'Expected an integral millisecond value.');
      }
    }

    if (command.type === 'wait' && command.durationMs === undefined)
      rejectPreviewInput(`${path}.durationMs`, 'A wait needs a duration.');
    if (command.offTarget !== undefined && typeof command.offTarget !== 'boolean')
      rejectPreviewInput(`${path}.offTarget`, 'Expected a boolean.');
    if (command.type === 'combat-start') {
      if (combatStart) rejectPreviewInput(path, 'Only one combat-start marker is allowed.');
      combatStart = true;
    }

    return command;
  });
}
