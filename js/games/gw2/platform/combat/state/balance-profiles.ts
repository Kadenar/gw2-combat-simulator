import type { BalanceProfile, SkillEffect, SkillId } from '#gw2/platform/engine/types.js';

interface BalanceProfileCatalogLike {
  readonly balanceProfilesById?: ReadonlyMap<SkillId, BalanceProfile>;
}

export interface BalanceProfileLookupContext {
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
  if (!context || typeof context !== 'object') return undefined;

  const source = context as BalanceProfileLookupContext;
  return (
    source.catalog?.balanceProfilesById?.get(id) ||
    source.helpers?.balanceProfilesById?.get(id) ||
    source.profession?.catalog?.balanceProfilesById?.get(id) ||
    source.runtime?.profession?.catalog?.balanceProfilesById?.get(id)
  );
}

/** Selects one profile effect by type and optional authored name without changing declaration order. */
export function balanceProfileEffect(
  profile: { readonly effects?: readonly SkillEffect[] } | null | undefined,
  type: string,
  index = 0,
  name?: string
): SkillEffect | undefined {
  return profile?.effects?.filter((effect) => effect.type === type && (name == null || effect.name === name))[index];
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
