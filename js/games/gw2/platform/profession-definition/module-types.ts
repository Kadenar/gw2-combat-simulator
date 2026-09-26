import type { ResourcePolicies } from '#gw2/platform/combat/resources/resource-policy.js';
import type { Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import type { AutoattackChainOptions } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import type {
  CanonicalCatalog,
  BalanceProfile,
  CatalogEntity,
  Skill,
  SkillId
} from '#gw2/platform/engine/skills/types.js';
import type {
  ProfessionFamilyContract,
  ProfessionAttributeRuleDefinition
} from '#gw2/platform/engine/profession/types.js';
import type { Gw2Build, ProfessionBuildDefinition } from '#gw2/platform/builds/types.js';

import type { ProfessionConfig } from '#gw2/platform/execution/types.js';
import type { Gw2ProfessionContract } from '#gw2/platform/simulation/types.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2AutoattackChainOptions } from '#gw2/platform/skills/autoattack-chain-controller.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export interface NativeModuleCatalogData {
  readonly generatedSkills?: readonly Skill[];
  readonly skillMechanics?: Readonly<Record<string, Partial<Skill>>>;
  readonly skillOverrides?: Readonly<Record<string, Partial<Skill>>>;
  readonly extraSkills?: readonly Skill[];
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

export interface NativeStateDefinition<
  TState extends object,
  TProjectOptions extends object,
  TProjectedState extends object
> {
  readonly create: (config: Readonly<ProfessionConfig>) => TState;
  readonly project?: (options: TProjectOptions) => TProjectedState;
}

export interface NativeResolvedDamageDetails {
  readonly hitContext?: Gw2HitResolutionContext;
  readonly criticalChance?: number;
}

/** Runtime callbacks a module contributes; the platform composes Core and the selected specialization in order. */
export type NativeModuleHooks = Partial<
  Omit<RuntimeProfession<never>, 'id' | 'catalog' | 'createState' | 'projectPlanningState'>
>;

export interface NativeModuleDefinition<
  TId extends string,
  TState extends object,
  TProjectOptions extends object,
  TProjectedState extends object,
  TModifierEscape extends ProfessionAttributeRuleDefinition,
  TPresentation extends object
> {
  readonly id: TId;
  readonly data: NativeModuleCatalogData;
  readonly state: NativeStateDefinition<TState, TProjectOptions, TProjectedState>;
  readonly resources?: ResourcePolicies & { readonly endurance?: EndurancePolicy };
  /** Declarative modifier rules or an explicit legacy modifier hook bundle. */
  readonly modifiers?: readonly Gw2ModifierRule[] | TModifierEscape;
  /** Runtime hooks execute against the single chronological owner. */
  readonly hooks?: NativeModuleHooks;
  readonly presentation?: TPresentation | ((catalog: Readonly<CanonicalCatalog>) => TPresentation);
}

export interface NativeModule<
  TId extends string = string,
  TState extends object = object,
  TProjectOptions extends object = object,
  TProjectedState extends object = object,
  TModifierEscape extends ProfessionAttributeRuleDefinition = object,
  TPresentation extends object = object
> extends NativeModuleDefinition<TId, TState, TProjectOptions, TProjectedState, TModifierEscape, TPresentation> {
  readonly kind: 'native-profession-module';
}

export interface NativeCatalogOptions {
  readonly skillNameCollision?: 'first' | 'last';
  readonly skillNameOverrides?: Readonly<Record<string, SkillId>>;
}

export type AnyNativeModule<TId extends string = string> = NativeModule<TId, object, never, object, object, object>;

type NativeModuleState<TModule> = TModule extends {
  readonly state: {
    readonly create: (config: Readonly<ProfessionConfig>) => infer TState;
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

export type NativeSpecializationId<TModules extends readonly AnyNativeModule[]> = Exclude<
  TModules[number]['id'],
  'Core'
>;

export interface NativeProfessionDefinition<
  TModules extends readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TBuild extends Gw2Build = Gw2Build
> {
  readonly id: string;
  readonly name: string;
  readonly modules: TModules;
  readonly build?: ProfessionBuildDefinition<TBuild>;
  /** Family presentation factories receive the same assembled catalog as module presentation factories. */
  readonly presentation?: TPresentation | ((catalog: Readonly<CanonicalCatalog>) => TPresentation);
  readonly catalog?: NativeCatalogOptions;
  /** Profession-specific exceptions and observers for the automatically installed GW2 chain controller. */
  readonly autoattackChains?: Gw2AutoattackChainOptions;
  /** Equipment eligibility is shared by every runtime and the application adapter. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
}

export type NativeProfessionContract<
  TModules extends readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TBuild extends Gw2Build = Gw2Build
> = ProfessionFamilyContract<
  NativeProfessionRuntimeState<TModules>,
  Gw2ProfessionContract<NativeProfessionRuntimeState<TModules>>,
  TBuild
> & {
  readonly specializationIds: readonly NativeSpecializationId<TModules>[];
  /** Retains the immutable composition input so optional integrations can decorate the family without content imports. */
  readonly nativeDefinition: Readonly<NativeProfessionDefinition<TModules, TPresentation, TBuild>>;
  runtimeFor(config: Gw2Config): RuntimeProfession<NativeProfessionRuntimeState<TModules>>;
};
