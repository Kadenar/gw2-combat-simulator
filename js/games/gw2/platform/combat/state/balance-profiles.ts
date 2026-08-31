import type {
  BalanceProfile,
  ConditionEffect,
  ControlEffect,
  CustomEffect,
  SkillEffect,
  SkillId,
  StatusEffect,
  StrikeEffect
} from '#gw2/platform/engine/types.js';

export type SkillEffectByType<TType extends SkillEffect['type']> = TType extends StrikeEffect['type']
  ? StrikeEffect
  : TType extends ConditionEffect['type']
    ? ConditionEffect
    : TType extends ControlEffect['type']
      ? ControlEffect
      : TType extends StatusEffect['type']
        ? StatusEffect
        : TType extends CustomEffect['type']
          ? CustomEffect
          : never;

interface BalanceProfileCatalogLike {
  readonly balanceProfilesById?: ReadonlyMap<SkillId, BalanceProfile>;
}

type BalanceProfileLookup = (id: SkillId) => BalanceProfile | undefined;

export interface BalanceProfileLookupContext {
  readonly balanceProfile?: BalanceProfileLookup;
  readonly catalog?: BalanceProfileCatalogLike;
  readonly helpers?: BalanceProfileCatalogLike;
  readonly profession?: {
    readonly catalog?: BalanceProfileCatalogLike;
  };
  readonly runtime?: {
    readonly profession?: {
      readonly catalog?: BalanceProfileCatalogLike;
    };
  };
}

/** Resolves patched balance data across scheduler, resolver, profession, and application context shapes. */
export function balanceProfileFromContext(context: unknown, id: SkillId): BalanceProfile | undefined {
  if (typeof context === 'function') return (context as BalanceProfileLookup)(id);
  if (!context || typeof context !== 'object') return undefined;

  const source = context as BalanceProfileLookupContext;
  return (
    source.catalog?.balanceProfilesById?.get(id) ||
    source.helpers?.balanceProfilesById?.get(id) ||
    source.profession?.catalog?.balanceProfilesById?.get(id) ||
    source.runtime?.profession?.catalog?.balanceProfilesById?.get(id) ||
    source.balanceProfile?.(id)
  );
}

/** Selects one profile effect by type and optional authored name without changing declaration order. */
export function balanceProfileEffect<TType extends SkillEffect['type']>(
  profile: { readonly effects?: readonly SkillEffect[] } | null | undefined,
  type: TType,
  index = 0,
  name?: string
): SkillEffectByType<TType> | undefined {
  return profile?.effects?.filter((effect) => effect.type === type && (name == null || effect.name === name))[index] as
    SkillEffectByType<TType> | undefined;
}

/** Resolves a profile and selects one authored effect without profession-local lookup wrappers. */
export function balanceProfileEffectFromContext<TType extends SkillEffect['type']>(
  context: unknown,
  id: SkillId,
  type: TType,
  index = 0,
  name?: string
): SkillEffectByType<TType> | undefined {
  return balanceProfileEffect(balanceProfileFromContext(context, id), type, index, name);
}

/** Reads a finite numeric profile field and otherwise returns the caller's domain-specific fallback. */
export function balanceProfileValue(
  profile: Readonly<Record<string, unknown>> | null | undefined,
  field: string,
  fallback: number
): number {
  const value = profile?.[field];
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

/** Resolves a profile and reads one numeric field without profession-local lookup wrappers. */
export function balanceProfileValueFromContext(context: unknown, id: SkillId, field: string, fallback: number): number {
  return balanceProfileValue(balanceProfileFromContext(context, id), field, fallback);
}
