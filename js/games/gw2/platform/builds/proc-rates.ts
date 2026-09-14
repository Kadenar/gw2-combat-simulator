import type { BalanceProfile, CanonicalCatalog, SkillId } from '#gw2/platform/engine/skills/types.js';

/** Validate saved/API rates as fractions; absent entries inherit current balance data, including patch previews. */
export function normalizeProcRateOverrides(value: unknown): Record<string, number> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('procRateOverrides must be an object.');
  }

  const entries = Object.entries(value);
  for (const [id, rate] of entries) {
    if (
      !/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(id) ||
      typeof rate !== 'number' ||
      !Number.isFinite(rate) ||
      rate < 0 ||
      rate > 1
    ) {
      throw new TypeError(`procRateOverrides.${id} must be a finite number between 0 and 1 with a namespaced proc ID.`);
    }
  }

  return Object.fromEntries(entries);
}

/** Active runtime composition scopes elite procs; selected traits scope the controls within that runtime. */
export function availableProcRateProfiles(
  catalog: Pick<CanonicalCatalog, 'balanceProfiles'>,
  selectedTraitIds: readonly SkillId[]
): BalanceProfile[] {
  const selected = new Set(selectedTraitIds.map(String));
  return catalog.balanceProfiles.filter(
    (profile) => profile.procRate && selected.has(String(profile.procRate.traitId))
  );
}
