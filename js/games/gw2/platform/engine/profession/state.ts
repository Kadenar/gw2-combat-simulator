/**
 * Profession state ownership helpers. Keeps Core and active-specialization
 * state explicitly separated while providing stable public projections.
 */
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';

/**
 * Flattens Core plus the active specialization solely for stable public
 * projections and event snapshots. Runtime mechanics use the nested state.
 */
export function flattenProfessionState<TState extends object = SchedulerRecord>(professionState: unknown): TState {
  if (!professionState || typeof professionState !== 'object') return {} as TState;
  const runtime = professionState as SchedulerRecord;
  const specialization = runtime.specialization as { readonly state?: unknown } | undefined;
  if (
    runtime.core &&
    typeof runtime.core === 'object' &&
    specialization?.state &&
    typeof specialization.state === 'object'
  ) {
    return {
      ...(runtime.core as SchedulerRecord),
      ...(specialization.state as SchedulerRecord)
    } as TState;
  }

  return { ...runtime } as TState;
}

/** Flattens and deeply clones a family runtime at the scheduler/resolver boundary. */
export function snapshotProfessionState<TState extends object = SchedulerRecord>(professionState: unknown): TState {
  return structuredClone(flattenProfessionState<TState>(professionState));
}

/** Restores flat snapshot fields to the specialization that declares them, otherwise Core. */
export function restoreFlatProfessionState(coreState: object, specializationState: object, snapshot: unknown): void {
  if (!snapshot || typeof snapshot !== 'object') return;
  const core = coreState as SchedulerRecord;
  const specialization = specializationState as SchedulerRecord;
  for (const [key, value] of Object.entries(snapshot)) {
    const owner = Object.hasOwn(specialization, key) ? specialization : core;
    owner[key] = structuredClone(value);
  }
}

/** Reads Core state from either the nested family runtime or its legacy flat compatibility shape. */
export function readProfessionCoreState<TCoreState extends object = SchedulerRecord>(
  professionState: unknown
): Partial<TCoreState> {
  if (!professionState || typeof professionState !== 'object') return {};
  const state = professionState as SchedulerRecord;
  if (!Object.hasOwn(state, 'core')) return state as Partial<TCoreState>;
  return state.core && typeof state.core === 'object' ? (state.core as Partial<TCoreState>) : {};
}

/** Reads one active specialization without exposing another specialization's state shape. */
export function readProfessionSpecializationState<TState extends object = SchedulerRecord>(
  professionState: unknown,
  expectedKind: string
): Partial<TState> | undefined {
  if (!professionState || typeof professionState !== 'object') return undefined;
  const state = professionState as SchedulerRecord;
  if (!Object.hasOwn(state, 'specialization')) return state as Partial<TState>;
  const specialization = state.specialization as SchedulerRecord | undefined;
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

/** Selects and clones the declared public fields while supplying defaults only for missing state. */
export function projectPublicProfessionState<TState extends object, TKey extends keyof TState>(
  flatState: TState,
  keys: readonly TKey[],
  defaults?: Readonly<Partial<TState>>
): SchedulerRecord & Pick<TState, TKey> {
  const state = flatState as SchedulerRecord;
  const fallback = (defaults || {}) as SchedulerRecord;
  return Object.fromEntries(
    keys.map((key) => {
      const name = String(key);
      return [name, structuredClone(Object.hasOwn(state, name) ? state[name] : fallback[name])];
    })
  ) as SchedulerRecord & Pick<TState, TKey>;
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

export function cloneProfessionState(value: unknown): unknown {
  return structuredClone(value);
}
