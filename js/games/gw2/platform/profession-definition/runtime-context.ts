import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import { requireBalanceProfile } from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile, CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';

/** Skill identity selection depends only on selected traits, before any cast or recharge state is consulted. */
export interface TraitSelectionContext {
  readonly hasTrait: (id: SkillId) => boolean;
}

/** Content-only policies resolve required tuning from the selected catalog without receiving its mutable maps. */
export interface SelectedContentContext extends TraitSelectionContext {
  readonly requireBalanceProfile: (id: SkillId) => BalanceProfile;
}

function createTraitSelectionContext(traits: ReadonlySet<SkillId>): TraitSelectionContext {
  return Object.freeze({ hasTrait: (id: SkillId) => hasTrait(traits, id) });
}

/** Skill variants depend on the normalized trait selection, without access to mutable profession state. */
export function createSkillSelectionContext(traits: ReadonlySet<SkillId>): TraitSelectionContext {
  return createTraitSelectionContext(traits);
}

/** Shared read-only content queries keep duration and capacity decisions isolated from combat services. */
export function createSelectedContentContext(
  traits: ReadonlySet<SkillId>,
  catalog: CanonicalCatalog
): SelectedContentContext {
  return Object.freeze({
    ...createTraitSelectionContext(traits),
    requireBalanceProfile: (id: SkillId) => requireBalanceProfile(catalog, id)
  });
}

/** Labels may inspect nested mechanic data, but cannot invoke stateful operations or mutate collections. */
export type ReadonlyMechanicState<T> = T extends (...args: never[]) => unknown
  ? never
  : T extends ReadonlyMap<infer K, infer V>
    ? ReadonlyMap<ReadonlyMechanicState<K>, ReadonlyMechanicState<V>>
    : T extends ReadonlySet<infer V>
      ? ReadonlySet<ReadonlyMechanicState<V>>
      : T extends object
        ? { readonly [K in keyof T]: ReadonlyMechanicState<T[K]> }
        : T;

/** Acceptance labels read the owning profession's current data without acquiring any engine services. */
export interface CastDetailContext<TState extends object> {
  readonly readProfessionState: () => ReadonlyMechanicState<TState>;
}

/** One read-only view follows state replacement throughout a run, without cloning state for each accepted cast. */
export function createCastDetailContext<TState extends object>(readState: () => TState): CastDetailContext<TState> {
  return Object.freeze({
    // The view removes write and call capabilities; the underlying state remains owned by profession mechanics.
    readProfessionState: () => readState() as ReadonlyMechanicState<TState>
  });
}

/** Capacity policies inspect mechanic data and selected content; only the recharge service may change ammo pools. */
export interface MaximumAmmoContext<TState extends object> extends SelectedContentContext {
  readonly readProfessionState: () => ReadonlyMechanicState<TState>;
  readonly flips: Readonly<SkillFlipWindows>;
}

/** Bind once per run so state replacement stays visible and missing profiles cannot fall back to another patch. */
export function createMaximumAmmoContext<TState extends object>(
  readState: () => TState,
  traits: ReadonlySet<SkillId>,
  catalog: CanonicalCatalog,
  flips: Readonly<SkillFlipWindows>
): MaximumAmmoContext<TState> {
  return Object.freeze({
    flips,
    readProfessionState: () => readState() as ReadonlyMechanicState<TState>,
    ...createSelectedContentContext(traits, catalog)
  });
}

/** Lifetime selection inspects selected content without mutating combat, command, or reporting state. */
export interface EffectOwnershipContext<TSkill extends Skill = Skill> {
  readonly skillFor: (id: SkillId) => TSkill | undefined;
}

/** Construct once per run from the selected live or patch catalog without exposing the runtime. */
export function createEffectOwnershipContext<TSkill extends Skill>(
  catalog: CanonicalCatalog<TSkill>
): EffectOwnershipContext<TSkill> {
  return Object.freeze({ skillFor: (id: SkillId) => catalog.skillsById.get(id) });
}
