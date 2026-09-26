import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { ResourcePolicies } from '#gw2/platform/combat/resources/resource-policy.js';
import type { ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { AutoattackChainOptions } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import type { ProfessionBuildDefinition, UnvalidatedBuild, BuildValidationResult } from '#gw2/platform/builds/types.js';
/** Defines runtime capabilities and composition inputs; display and build callback types have separate owners. */
import type {
  SkillId,
  Skill,
  CanonicalCatalog,
  BalanceProfile,
  CatalogEntity
} from '#gw2/platform/engine/skills/types.js';
import type { ProfessionConfig } from '#gw2/platform/execution/types.js';
import type { Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';

export interface ProfessionResourceDefinition<TProfessionState extends object = object> extends ResourcePolicies {
  readonly endurance?: EndurancePolicy;
  readonly createState?: (config: Readonly<ProfessionConfig>) => TProfessionState;
  readonly projectPlanningState?: unknown;
}

/** One composable hook: a bare function, or a function with ordering metadata. */
export type ProfessionHook =
  | ((...args: never[]) => unknown)
  | {
      readonly id?: string;
      readonly order?: number;
      readonly handler: (...args: never[]) => unknown;
    };

/** A hook slot accepts one hook or an ordered list of them. */
export type ProfessionHookEntry = ProfessionHook | readonly ProfessionHook[];

/** Attribute-phase rules a module contributes, plus its declarative modifier fragments. */
export interface ProfessionModifierDefinition {
  readonly modifyAttributes?: ProfessionHookEntry;
  readonly modifyCriticalChance?: ProfessionHookEntry;
  readonly modifyCriticalDamage?: ProfessionHookEntry;
  readonly modifyStrikeDamage?: ProfessionHookEntry;
  readonly modifyConditionDamage?: ProfessionHookEntry;
  readonly modifyConditionBaseDuration?: ProfessionHookEntry;
  readonly modifyConditionDuration?: ProfessionHookEntry;
  /** Declarative modifier fragments compiled once per family by the single owning compiler. */
  readonly modifierRules?: readonly Gw2ModifierRule[];
  readonly compileModifierRules?: (declarations: readonly Gw2ModifierRule[]) => {
    readonly [
      K in Exclude<keyof ProfessionModifierDefinition, 'modifierRules' | 'compileModifierRules'>
    ]?: ProfessionHook;
  };
}

export interface ProfessionDefinition<TProfessionState extends object = object, TBuild extends object = object> {
  /** One equipment eligibility policy used by simulation and application consumers. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  readonly id: string;
  readonly name: string;
  readonly catalog?: CanonicalCatalog;
  readonly build?: ProfessionBuildDefinition<TBuild>;
  readonly resources?: ProfessionResourceDefinition<TProfessionState>;
  readonly modifiers?: ProfessionModifierDefinition;
  /** Runtime callbacks composed over the normalized attribute and planning hooks. */
  readonly hooks?: Partial<RuntimeProfession<TProfessionState>>;
  readonly ui?: Partial<ProfessionUiContract>;
}

export interface ProfessionModuleCatalogFragment {
  readonly skills?: readonly Skill[];
  readonly balanceProfiles?: readonly BalanceProfile[];
  readonly traits?: readonly CatalogEntity[];
  readonly specializations?: readonly CatalogEntity[];
  readonly weapons?: readonly string[];
  readonly weaponHands?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  readonly autoattackChains?: AutoattackChainOptions;
  readonly skillNameCollision?: 'first' | 'last';
  readonly skillNameOverrides?: Readonly<Record<string, SkillId>>;
}

export interface ProfessionModuleDefinition<TModuleState extends object = object> {
  readonly id: string;
  readonly catalog?: ProfessionModuleCatalogFragment;
  readonly resources?: ProfessionResourceDefinition<TModuleState>;
  readonly modifiers?: ProfessionModifierDefinition;
  readonly ui?: Partial<ProfessionUiContract>;
}

export interface ProfessionFamilyDefinition<TBuild extends object = object> {
  /** One equipment eligibility policy used by simulation and application consumers. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog;
  readonly build?: ProfessionBuildDefinition<TBuild>;
  readonly core: ProfessionModuleDefinition<any>;
  readonly specializations: Readonly<Record<string, ProfessionModuleDefinition<any>>>;
  /**
   * Application-only callbacks that are genuinely global to the family.
   * Runtime callbacks belong to Core or the active specialization module.
   */
  readonly ui?: Partial<ProfessionUiContract>;
  /**
   * Capacity-preview policies for the selected specialization. Families whose resources live only in their live
   * owners supply them here; otherwise the composed module resources are used.
   */
  readonly resourcesFor?: (specialization: string) => ResourcePolicies & { readonly endurance?: EndurancePolicy };
}

/** Keeps scheduler contracts resolver-neutral while typed resolver layers supply their own registries. */
export interface NormalizedProfessionContract<TProfessionState extends object = object> {
  readonly resources: ResourcePolicies & { readonly endurance: EndurancePolicy | null };
  /** One equipment eligibility policy used by simulation and application consumers. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog;
  readonly createState: (config: Readonly<ProfessionConfig>) => TProfessionState;
  readonly projectPlanningState: (...args: never[]) => unknown;
  readonly runtimeFor: (config: Readonly<ProfessionConfig>) => RuntimeProfession<TProfessionState>;
  readonly modifyAttributes: (context: Gw2ModifierContext, attributes: Gw2Stats) => Gw2Stats;
  readonly modifyCriticalChance: (context: Gw2ModifierContext, chance: number) => number;
  readonly modifyCriticalDamage: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly modifyStrikeDamage: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly modifyConditionDamage: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly modifyConditionBaseDuration: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly modifyConditionDuration: (context: Gw2ModifierContext, multiplier: number) => number;
}

export interface ProfessionApplicationContract<TBuild extends object = object> {
  /** One equipment eligibility policy used by simulation and application consumers. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog;
  readonly ui: ProfessionUiContract;
  readonly createBuildDefaults: () => TBuild;
  readonly migrateBuild: (saved: UnvalidatedBuild) => TBuild;
  readonly validateBuild: (build: UnvalidatedBuild) => BuildValidationResult;
}

export interface ProfessionFamilyContract<
  TProfessionState extends object = object,
  TRuntime extends NormalizedProfessionContract<TProfessionState> = NormalizedProfessionContract<TProfessionState>,
  TBuild extends object = object
> extends ProfessionApplicationContract<TBuild> {
  readonly resolveProfession: (config: Readonly<ProfessionConfig>) => Readonly<TRuntime>;
}

export type ProfessionSource<
  TProfessionState extends object = object,
  TRuntime extends NormalizedProfessionContract<TProfessionState> = NormalizedProfessionContract<TProfessionState>,
  TBuild extends object = object
> = TRuntime | ProfessionFamilyContract<TProfessionState, TRuntime, TBuild>;
