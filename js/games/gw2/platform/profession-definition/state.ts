import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { DynamicFields } from '#kernel/core/dynamic-fields.js';
import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';

/**
 * Profession state ownership helpers. Keeps Core and active-specialization
 * state explicitly separated while providing stable public projections.
 */

/**
 * Flattens Core plus the active specialization solely for stable public
 * projections and event snapshots. Runtime mechanics use the nested state.
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

/** Flattens and deeply clones a family runtime for detached public observations. */
export function snapshotProfessionState(professionState: unknown): object {
  return structuredClone(flattenProfessionState(professionState));
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

/** Declares public fields and display defaults for the owning module, separate from live state initialization. */
export function definePublicStateDefaults<TDefaults extends object>(defaults: TDefaults) {
  return Object.freeze({
    keys: Object.freeze(Object.keys(defaults) as Extract<keyof TDefaults, string>[]),
    defaults: Object.freeze(defaults)
  });
}

/** Selects and clones the declared public fields while supplying defaults only for missing state. */
export function projectPublicProfessionState<TState extends object, TKey extends keyof TState>(
  flatState: TState,
  keys: readonly TKey[],
  defaults?: Readonly<Partial<TState>>
): UnvalidatedFields & Pick<TState, TKey> {
  const state = flatState as UnvalidatedFields;
  const fallback = (defaults || {}) as UnvalidatedFields;
  return Object.fromEntries(
    keys.map((key) => {
      const name = String(key);
      return [name, structuredClone(Object.hasOwn(state, name) ? state[name] : fallback[name])];
    })
  ) as UnvalidatedFields & Pick<TState, TKey>;
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

/** Projects only a module's declared public fields; inactive modules contribute no fields or defaults. */
export function createPublicStateProjector<const TKey extends string>(projection: {
  readonly keys: readonly TKey[];
  readonly defaults: Readonly<Partial<Record<TKey, unknown>>>;
}): (input: Gw2PlanningStateInput) => Record<TKey, unknown> {
  return ({ profession }) =>
    projectPublicProfessionState(
      flattenProfessionState(profession) as Record<TKey, unknown>,
      projection.keys,
      projection.defaults
    );
}
