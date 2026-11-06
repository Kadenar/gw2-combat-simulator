/** Defines runtime capabilities and composition inputs; display and build callback types have separate owners. */
import type { Gw2AttributeContributions } from '#gw2/platform/attributes/types.js';
import type { Gw2ProfessionCalculations } from '#gw2/platform/combat-calculation/profession-contract.js';
import type { Gw2DamageBucketPolicies, Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/skills/types.js';

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
  readonly projectPlanningState?: (input: Gw2PlanningStateInput<TProfessionState>) => unknown;
}

/** Modules contribute declarative rules and bucket policies; shared attribute phases belong to compilation. */
export interface ProfessionModifierDefinition {
  /** Declarative modifier fragments compiled once per selection with standard GW2 damage buckets. */
  readonly modifierRules?: readonly Gw2ModifierRule[];
  /** Each damage target has one policy owner; all selected rules share its equipment eligibility. */
  readonly damageBuckets?: Gw2DamageBucketPolicies;
}

export interface ProfessionDefinition<TProfessionState extends object = object, TSkill extends Skill = Skill> {
  /** One equipment eligibility policy used by simulation and application consumers. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  /** Equipment stays universal; this capability restricts only swaps after combat begins. */
  readonly canSwapWeaponSetsInCombat?: boolean;
  readonly id: string;
  readonly name: string;
  readonly catalog?: CanonicalCatalog<TSkill>;
  /** Runtime owners construct attribute facts with their selected balance context. */
  readonly attributeContributions?: (context: Gw2ModifierContext) => readonly Gw2AttributeContributions[];
  readonly resources?: ProfessionResourceDefinition<TProfessionState>;
  readonly modifiers?: ProfessionModifierDefinition;
}

/** Validated module selections retain canonical records, complete field tables, and already compiled chain positions. */
export type ProfessionModuleCatalogFragment<TSkill extends Skill = Skill> = Pick<
  CanonicalCatalog<TSkill>,
  | 'skills'
  | 'skillFields'
  | 'profileFields'
  | 'balanceProfiles'
  | 'traits'
  | 'specializations'
  | 'weapons'
  | 'weaponHands'
  | 'autoattackChains'
  | 'autoattackChainPositions'
  | 'skillFlips'
>;

/** Keeps scheduler contracts resolver-neutral while typed resolver layers supply their own registries. */
export interface NormalizedProfessionContract<TProfessionState extends object = object, TSkill extends Skill = Skill> {
  readonly calculations: Readonly<Gw2ProfessionCalculations>;
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
  readonly projectPlanningState: (input: Gw2PlanningStateInput<TProfessionState>) => unknown;
}
