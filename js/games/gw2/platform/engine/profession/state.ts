import type { DynamicFields, UnvalidatedFields } from '#kernel/core/unvalidated.js';
/**
 * Profession state ownership helpers. Keeps Core and active-specialization
 * state explicitly separated while providing stable public projections.
 */

/**
 * Flattens Core plus the active specialization solely for stable public
 * projections and event snapshots. Runtime mechanics use the nested state.
 */
export function flattenProfessionState<TState extends object = UnvalidatedFields>(professionState: unknown): TState {
  if (!professionState || typeof professionState !== 'object') return {} as TState;
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
    } as TState;
  }

  return { ...runtime } as TState;
}

/** Flattens and deeply clones a family runtime for detached public observations. */
export function snapshotProfessionState<TState extends object = UnvalidatedFields>(professionState: unknown): TState {
  return structuredClone(flattenProfessionState<TState>(professionState));
}

/** Reads only the owned Core runtime slice; public projections are read by their presentation consumers. */
export function readProfessionCoreState<TCoreState extends object = DynamicFields>(
  professionState: unknown
): Partial<TCoreState> {
  if (!professionState || typeof professionState !== 'object') return {};
  const state = professionState as UnvalidatedFields;
  return state.core && typeof state.core === 'object' ? (state.core as Partial<TCoreState>) : {};
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

  return specialization.state as Partial<TState>;
}

/** Declares inactive public fallbacks, never live state initialization or private runtime fields. */
export function definePublicStateDefaults<TDefaults extends object>(defaults: TDefaults) {
  return Object.freeze({
    keys: Object.freeze(Object.keys(defaults) as Extract<keyof TDefaults, string>[]),
    defaults: Object.freeze(defaults)
  });
}

/** Composes slice metadata in order, retaining duplicate keys and letting later defaults win. */
export function composePublicStateProjections<
  const TSlices extends readonly { readonly keys: readonly string[]; readonly defaults: object }[]
>(slices: TSlices) {
  return Object.freeze({
    keys: Object.freeze(slices.flatMap((slice) => slice.keys) as TSlices[number]['keys'][number][]),
    defaults: Object.freeze(Object.assign({}, ...slices.map((slice) => slice.defaults))) as Readonly<
      TSlices[number]['defaults']
    >
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

type RuntimeSpecialization<TRuntimeState> = TRuntimeState extends {
  readonly specialization: infer TSpecialization;
}
  ? TSpecialization
  : never;

type RuntimeSpecializationKind<TRuntimeState> =
  RuntimeSpecialization<TRuntimeState> extends { readonly kind: infer TKind } ? TKind & string : never;

type RuntimeSpecializationState<TRuntimeState, TKind extends string> =
  Extract<RuntimeSpecialization<TRuntimeState>, { readonly kind: TKind }> extends { readonly state: infer TState }
    ? TState
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
function specializationStateForKind<
  TContext,
  TRuntimeState = ProfessionRuntimeFromContext<TContext>,
  TKind extends RuntimeSpecializationKind<TRuntimeState> = RuntimeSpecializationKind<TRuntimeState>
>(context: TContext, expectedKind: TKind): RuntimeSpecializationState<TRuntimeState, TKind> {
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

  return active.state as RuntimeSpecializationState<TRuntimeState, TKind>;
}

export interface ProfessionSpecializationStateDefinition<
  TKind extends string,
  TState extends object,
  TArguments extends readonly unknown[]
> {
  readonly kind: TKind;
  readonly create: (...args: TArguments) => TState;
  readonly from: <TContext>(context: TContext) => TState;
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
    from<TContext>(context: TContext): TState {
      return specializationStateForKind(
        context,
        kind as unknown as RuntimeSpecializationKind<ProfessionRuntimeFromContext<TContext>>
      ) as TState;
    }
  });
}
