import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2Stats } from '#gw2/platform/combat/stats.js';
import type { Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type { AutoattackChainOptions } from '#gw2/platform/skills/catalog.js';
import type { BalanceProfile, CanonicalCatalog, CatalogEntity, Skill, SkillId } from '#gw2/platform/skills/types.js';

/** Defines runtime capabilities and composition inputs; display and build callback types have separate owners. */

/** The configuration slice that selects a profession's modules and seeds its state factories. */
export interface ProfessionConfig {
  /** Active elite specialization, or "Core"; module composition resolves the runtime from it. */
  readonly specialization?: string;
  readonly boons?: Readonly<Record<string, boolean | number>>;
}

/** State construction and projection; executable resource policies belong to runtime hooks. */
export interface ProfessionResourceDefinition<TProfessionState extends object = object> {
  readonly createState?: (
    config: Readonly<ProfessionConfig>,
    balanceContext?: ProfessionBalanceContext
  ) => TProfessionState;
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
type ProfessionHookEntry = ProfessionHook | readonly ProfessionHook[];

/** Attribute-phase rules a module contributes, plus its declarative modifier fragments. */
export interface ProfessionModifierDefinition {
  readonly modifyAttributes?: ProfessionHookEntry;
  readonly modifyConditionAttributes?: ProfessionHookEntry;
  readonly modifyCriticalChance?: ProfessionHookEntry;
  readonly modifyCriticalDamage?: ProfessionHookEntry;
  readonly modifyStrikeDamage?: ProfessionHookEntry;
  readonly modifyConditionDamage?: ProfessionHookEntry;
  readonly modifyConditionBaseDuration?: ProfessionHookEntry;
  readonly modifyConditionDuration?: ProfessionHookEntry;
  /** Declarative modifier fragments compiled once per selection with standard GW2 damage buckets. */
  readonly modifierRules?: readonly Gw2ModifierRule[];
  /** Optional single-owner override for profession-specific damage-bucket policies. */
  readonly compileModifierRules?: (declarations: readonly Gw2ModifierRule[]) => {
    readonly [
      K in Exclude<keyof ProfessionModifierDefinition, 'modifierRules' | 'compileModifierRules'>
    ]?: ProfessionHook;
  };
}

export interface ProfessionDefinition<TProfessionState extends object = object, TSkill extends Skill = Skill> {
  /** One equipment eligibility policy used by simulation and application consumers. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  /** Equipment stays universal; this capability restricts only swaps after combat begins. */
  readonly canSwapWeaponSetsInCombat?: boolean;
  readonly id: string;
  readonly name: string;
  readonly catalog?: CanonicalCatalog<TSkill>;
  readonly attributeContributions?: import('#gw2/platform/builds/types.js').Gw2AttributeContributionCalculator;
  readonly resources?: ProfessionResourceDefinition<TProfessionState>;
  readonly modifiers?: ProfessionModifierDefinition;
}

export interface ProfessionModuleCatalogFragment<TSkill extends Skill = Skill> {
  readonly skills?: readonly TSkill[];
  readonly balanceProfiles?: readonly BalanceProfile[];
  readonly traits?: readonly CatalogEntity[];
  readonly specializations?: readonly CatalogEntity[];
  readonly weapons?: readonly string[];
  readonly weaponHands?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  readonly autoattackChains?: AutoattackChainOptions;
  readonly skillNameCollision?: 'first' | 'last';
  readonly skillNameOverrides?: Readonly<Record<string, SkillId>>;
}

/** Keeps scheduler contracts resolver-neutral while typed resolver layers supply their own registries. */
export interface NormalizedProfessionContract<TProfessionState extends object = object, TSkill extends Skill = Skill> {
  readonly attributeContributions?: import('#gw2/platform/builds/types.js').Gw2AttributeContributionCalculator;
  readonly canSwapWeaponSetsInCombat: boolean;
  /** One equipment eligibility policy used by simulation and application consumers. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog<TSkill>;
  readonly createState: (
    config: Readonly<ProfessionConfig>,
    balanceContext?: ProfessionBalanceContext
  ) => TProfessionState;
  readonly projectPlanningState: (...args: never[]) => unknown;
  readonly modifyAttributes: (context: Gw2ModifierContext, attributes: Gw2Stats) => Gw2Stats;
  /** Condition-specific replacements run after all profession and equipment attribute bonuses. */
  readonly modifyConditionAttributes: (context: Gw2ModifierContext, attributes: Gw2Stats) => Gw2Stats;
  readonly modifyCriticalChance: (context: Gw2ModifierContext, chance: number) => number;
  readonly modifyCriticalDamage: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly modifyStrikeDamage: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly modifyConditionDamage: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly modifyConditionBaseDuration: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly modifyConditionDuration: (context: Gw2ModifierContext, multiplier: number) => number;
}
