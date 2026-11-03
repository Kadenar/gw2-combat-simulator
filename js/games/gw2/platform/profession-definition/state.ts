import type { DynamicFields } from '#kernel/core/dynamic-fields.js';
import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';

/** Reject overlapping public identities so module order cannot silently replace another owner's observation. */
export function composePlanningState(projections: readonly object[]): object {
  const result: Record<string, unknown> = {};
  for (const projection of projections) {
    for (const [id, value] of Object.entries(projection)) {
      if (Object.hasOwn(result, id)) throw new TypeError(`Duplicate planning state ID: ${id}`);

      result[id] = value;
    }
  }

  return result;
}

/** Reads only the owned Core runtime slice; public projections are read by their presentation consumers. */
export function readProfessionCoreState<TCoreState extends object = DynamicFields>(
  professionState: unknown
): Partial<TCoreState> {
  if (!professionState || typeof professionState !== 'object') return {};

  const state = professionState as UnvalidatedFields;
  return state.core && typeof state.core === 'object' ? state.core : {};
}

/** Reads one active specialization without exposing another specialization's state shape. */
export function readProfessionSpecializationState<TState extends object = DynamicFields>(
  professionState: unknown,
  expectedKind: string
): Partial<TState> | undefined {
  if (!professionState || typeof professionState !== 'object') return undefined;

  const state = professionState as UnvalidatedFields;
  const specialization = state.specialization as UnvalidatedFields | undefined;

  if (
    !specialization ||
    specialization.kind !== expectedKind ||
    !specialization.state ||
    typeof specialization.state !== 'object'
  ) {
    return undefined;
  }

  return specialization.state;
}

/**
 * Reads the explicitly supplied runtime state, so callers choose their owner without context-shape dispatch.
 */
export function professionCoreState<TState extends { readonly core: object }>(state: TState): TState['core'] {
  return state.core;
}

/** Explicit active-specialization ownership shared by mechanics and planning observations. */
export interface SpecializationRuntimeState {
  readonly specialization: { readonly kind: string; readonly state: object };
}

/**
 * Returns the active specialization state after validating its discriminant.
 * Module mechanics use this accessor instead of a flat family-state view.
 */
function specializationStateForKind(runtime: SpecializationRuntimeState, expectedKind: string): object {
  const active = runtime.specialization;

  if (active.kind !== expectedKind) {
    throw new TypeError(`Expected active specialization ${expectedKind}, received ${active.kind}.`);
  }

  return active.state;
}

interface ProfessionSpecializationStateDefinition<
  TKind extends string,
  TState extends object,
  TArguments extends readonly unknown[]
> {
  readonly kind: TKind;
  readonly create: (...args: TArguments) => TState;
  readonly from: (runtime: SpecializationRuntimeState) => TState;
}

/**
 * Defines the state owned by one specialization and returns its only accessor.
 * Keeping the factory and accessor together makes the returned fragment type
 * owner-local instead of deriving it from the profession-wide runtime union.
 */
export function defineProfessionSpecializationState<
  const TKind extends string,
  TArguments extends readonly unknown[],
  TState extends object
>(
  kind: TKind,
  create: ((...args: TArguments) => TState) & (TState extends readonly unknown[] ? never : unknown)
): ProfessionSpecializationStateDefinition<TKind, TState, TArguments> {
  return Object.freeze({
    kind,
    create,
    from(runtime: SpecializationRuntimeState): TState {
      // The owning factory determines the state type; the shared accessor only checks the active kind.
      return specializationStateForKind(runtime, kind) as TState;
    }
  });
}
