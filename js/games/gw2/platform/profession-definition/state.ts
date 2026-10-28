import type { DynamicFields } from '#kernel/core/dynamic-fields.js';
import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';

/** Clone only selected live fields so projection normalization cannot mutate owners or copy private bookkeeping. */
export function cloneStateFields<TState extends object, const TKey extends keyof TState>(
  state: TState,
  keys: readonly TKey[]
): Pick<TState, TKey> {
  return structuredClone(Object.fromEntries(keys.map((key) => [key, state[key]]))) as Pick<TState, TKey>;
}

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

/**
 * Profession state ownership helpers. Keeps Core and active-specialization
 * state explicitly separated while providing stable public projections.
 */

/**
 * Flattens runtime slices for generic observations and internal test snapshots.
 * Native profession planning projectors select their own fields under registered IDs.
 */
export function flattenProfessionState(professionState: unknown): UnvalidatedFields {
  if (!professionState || typeof professionState !== 'object') return {};

  const runtime = professionState as UnvalidatedFields;
  const specialization = runtime.specialization as { readonly state?: unknown } | undefined;

  if (
    runtime.core &&
    typeof runtime.core === 'object' &&
    specialization?.state &&
    typeof specialization.state === 'object'
  ) {
    return {
      ...(runtime.core as UnvalidatedFields),
      ...(specialization.state as UnvalidatedFields)
    };
  }

  return { ...runtime };
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

type ProfessionStateContext<TRuntimeState> = {
  readonly state: {
    readonly profession: TRuntimeState;
  };
};

type DirectProfessionContext<TRuntimeState> = {
  readonly profession: TRuntimeState;
};

type ProfessionRuntimeFromContext<TContext> =
  TContext extends ProfessionStateContext<infer TRuntimeState>
    ? TRuntimeState
    : TContext extends DirectProfessionContext<infer TRuntimeState>
      ? TRuntimeState
      : never;

type RuntimeCoreState<TRuntimeState> = TRuntimeState extends {
  readonly core: infer TCoreState;
}
  ? TCoreState
  : never;

/**
 * Returns the explicitly owned Core state slice for a family runtime.
 */
export function professionCoreState<TContext>(
  context: TContext
): RuntimeCoreState<ProfessionRuntimeFromContext<TContext>> {
  const candidate = context as {
    readonly state?: { readonly profession?: unknown };
    readonly runtime?: { readonly profession?: unknown };
    readonly profession?: unknown;
  };
  const runtime = (candidate.state?.profession ?? candidate.runtime?.profession ?? candidate.profession) as {
    readonly core: unknown;
  };
  return runtime.core as RuntimeCoreState<ProfessionRuntimeFromContext<TContext>>;
}

/**
 * Returns the active specialization state after validating its discriminant.
 * Module mechanics use this accessor instead of a flat family-state view.
 */
function specializationStateForKind(context: unknown, expectedKind: string): object {
  const candidate = context as {
    readonly state?: { readonly profession?: unknown };
    readonly runtime?: { readonly profession?: unknown };
    readonly profession?: unknown;
  };
  const runtime = (candidate.state?.profession ?? candidate.runtime?.profession ?? candidate.profession) as {
    readonly specialization: {
      readonly kind: string;
      readonly state: object;
    };
  };
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
  readonly from: (context: unknown) => TState;
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
    from(context: unknown): TState {
      // The owning factory determines the state type; the shared accessor only checks the active kind.
      return specializationStateForKind(context, kind) as TState;
    }
  });
}
