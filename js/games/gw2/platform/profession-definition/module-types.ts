import type { Gw2Build, ProfessionBuildDefinition } from '#gw2/platform/builds/types.js';
import type { Gw2Stats } from '#gw2/platform/combat/stats.js';
import type { Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type { ProfessionFamilyContract } from '#gw2/platform/profession-definition/family-contract.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { ProfessionModifierDefinition } from '#gw2/platform/profession-definition/types.js';
import type { AutoattackChainOptions } from '#gw2/platform/skills/catalog.js';
import type { BalanceProfile, CanonicalCatalog, CatalogEntity, Skill, SkillId } from '#gw2/platform/skills/types.js';

import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2AutoattackChainOptions } from '#gw2/platform/execution/autoattack-chains.js';
import type { Gw2ProfessionContract } from '#gw2/platform/profession-definition/family-contract.js';
import type {
  ProfessionRuntimeOptions,
  RuntimeProfession
} from '#gw2/platform/profession-definition/runtime-contract.js';
import type { TraitDefinition } from '#gw2/platform/profession-definition/traits.js';
import type { ProfessionConfig } from '#gw2/platform/profession-definition/types.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export interface NativeModuleCatalogData<TSkill extends Skill = Skill> {
  readonly generatedSkills?: readonly TSkill[];
  readonly skillMechanics?: Readonly<Record<string, Partial<TSkill>>>;
  readonly skillOverrides?: Readonly<Record<string, Partial<TSkill>>>;
  readonly extraSkills?: readonly TSkill[];
  readonly balanceProfiles?: readonly BalanceProfile[];
  readonly traits?: readonly CatalogEntity[];
  readonly specializations?: readonly CatalogEntity[];
  readonly weapons?: readonly string[];
  readonly weaponHands?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  readonly autoattackChains?: AutoattackChainOptions;
  /** Runtime-local name selections for identities that collide with Core skills. */
  readonly skillNameOverrides?: Readonly<Record<string, SkillId>>;
  /**
   * Skills that look like ordinary weapon or Core skills in API metadata but
   * must only exist when this specialization is active.
   */
  readonly specializationOnlySkillIds?: readonly SkillId[];
  /** Stable positions from the profession-wide generated metadata input. */
  readonly generatedSkillOrder?: ReadonlyMap<SkillId, number>;
  /** Stable positions from the profession-wide shared-extra input. */
  readonly sharedExtraSkillOrder?: ReadonlyMap<SkillId, number>;
}

interface NativeStateDefinition<TState extends object, TProjectOptions extends object, TProjectedState extends object> {
  readonly create: (
    config: Readonly<ProfessionConfig>,
    preparation: { attributes: Gw2Stats; balanceContext: ProfessionBalanceContext }
  ) => TState;
  readonly project?: (options: TProjectOptions) => TProjectedState;
}

export interface NativeResolvedDamageDetails {
  readonly hitContext?: Gw2HitResolutionContext;
  readonly criticalChance?: number;
}

/** Runtime callbacks a module contributes; the platform composes Core and the selected specialization in order. */
export type NativeModuleHooks<TSkill extends Skill = Skill> = RuntimeHooks<never, TSkill>;

export interface NativeModuleDefinition<
  TId extends string,
  TState extends object,
  TProjectOptions extends object,
  TProjectedState extends object,
  TModifiers extends ProfessionModifierDefinition,
  TPresentation extends object,
  TSkill extends Skill = Skill
> {
  /** Equipment stays universal; this capability restricts only swaps after combat begins. */
  readonly canSwapWeaponSetsInCombat?: boolean;
  readonly id: TId;
  readonly data: NativeModuleCatalogData<TSkill>;
  readonly state: NativeStateDefinition<TState, TProjectOptions, TProjectedState>;
  readonly traitDefinitions?: readonly TraitDefinition<TSkill>[];
  /** Skill passives and intrinsic mechanics share the trait attribute evaluator without pretending to be traits. */
  readonly attributes?: Gw2AttributeContributionCalculator;
  /** Declarative modifier rules, or rules plus imperative `modify*` callbacks for ordered or stateful math. */
  readonly modifiers?: readonly Gw2ModifierRule[] | TModifiers;
  /** Runtime hooks execute against the single chronological owner. */
  readonly hooks?: NativeModuleHooks<TSkill>;
  readonly presentation?: TPresentation | ((catalog: Readonly<CanonicalCatalog<TSkill>>) => TPresentation);
}

export interface NativeModule<
  TId extends string = string,
  TState extends object = object,
  TProjectOptions extends object = object,
  TProjectedState extends object = object,
  TModifiers extends ProfessionModifierDefinition = object,
  TPresentation extends object = object,
  TSkill extends Skill = Skill
> extends Omit<
  NativeModuleDefinition<TId, TState, TProjectOptions, TProjectedState, TModifiers, TPresentation, TSkill>,
  'modifiers'
> {
  readonly kind: 'native-profession-module';
  /** Registration normalizes rule arrays to the same object shape as imperative modifiers. */
  readonly modifiers: ProfessionModifierDefinition;
}

export interface NativeCatalogOptions {
  readonly skillNameCollision?: 'first' | 'last';
  readonly skillNameOverrides?: Readonly<Record<string, SkillId>>;
}

// Heterogeneous registries erase the skill parameter; concrete module factories retain their inferred subtype.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyNativeModule<TId extends string = string, TSkill extends Skill = any> = NativeModule<
  TId,
  object,
  never,
  object,
  object,
  object,
  TSkill
>;

type NativeModuleState<TModule> = TModule extends {
  readonly state: {
    readonly create: (...args: never[]) => infer TState;
  };
}
  ? TState
  : never;

type NativeCoreState<TModules extends readonly AnyNativeModule[]> = NativeModuleState<
  Extract<TModules[number], { readonly id: 'Core' }>
>;

type NativeSpecializationState<TModules extends readonly AnyNativeModule[]> =
  Exclude<TModules[number], { readonly id: 'Core' }> extends infer TModule
    ? TModule extends AnyNativeModule
      ? {
          readonly kind: TModule['id'];
          readonly state: NativeModuleState<TModule>;
        }
      : never
    : never;

export type NativeProfessionRuntimeState<TModules extends readonly AnyNativeModule[]> = {
  readonly core: NativeCoreState<TModules>;
  readonly specialization:
    { readonly kind: 'Core'; readonly state: Record<string, never> } | NativeSpecializationState<TModules>;
};

export interface NativeProfessionDefinition<
  TModules extends readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TBuild extends Gw2Build = Gw2Build,
  TSkill extends Skill = Skill
> {
  readonly id: string;
  readonly name: string;
  readonly modules: TModules & readonly AnyNativeModule<string, TSkill>[];
  /** Bind family-owned mechanics to the selected specialization without upward imports from Core. */
  readonly runtimeHooks?: (specialization: string) => RuntimeHooks<NativeProfessionRuntimeState<TModules>, TSkill>;
  readonly build?: ProfessionBuildDefinition<TBuild>;
  /** Family presentation factories receive the same assembled catalog as module presentation factories. */
  readonly presentation?: TPresentation | ((catalog: Readonly<CanonicalCatalog<TSkill>>) => TPresentation);
  readonly catalog?: NativeCatalogOptions;
  /** Profession-specific exceptions and observers for the automatically installed GW2 chain controller. */
  readonly autoattackChains?: Gw2AutoattackChainOptions;
  /** Equipment eligibility is shared by every runtime and the application adapter. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  /**
   * Heal, utility, and elite casts must be equipped in the build's selected slots, with a flip resolving through its
   * root. Families whose bars are not chosen skill by skill, or that own a variant rule, leave it unset.
   */
  readonly requireEquippedSlotSkills?: boolean;
}

export type NativeProfessionContract<
  TModules extends readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TBuild extends Gw2Build = Gw2Build,
  TSkill extends Skill = NonNullable<TModules[number]['data']['generatedSkills']>[number]
> = ProfessionFamilyContract<
  NativeProfessionRuntimeState<TModules>,
  Gw2ProfessionContract<NativeProfessionRuntimeState<TModules>, TSkill>,
  TBuild,
  TSkill
> & {
  /** Retains the immutable composition input so optional integrations can decorate the family without content imports. */
  readonly nativeDefinition: Readonly<NativeProfessionDefinition<TModules, TPresentation, TBuild, TSkill>>;
  runtimeFor(
    config: Gw2Config,
    options?: ProfessionRuntimeOptions
  ): RuntimeProfession<NativeProfessionRuntimeState<TModules>, TSkill>;
  readonly attributeContributions: Gw2AttributeContributionCalculator;
};
