/** Compiled professions combine authored hooks with selected calculation, catalog, and state capabilities. */
import type { Gw2QueryProfession } from '#gw2/platform/combat-calculation/profession-contract.js';
import type { Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import type { AutoattackChainOverride } from '#gw2/platform/execution/autoattack-chains.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { TriggerListener } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/skills/types.js';

/**
 * Select compiled activation producers before execution. Disabling them retains value policies and handlers for
 * explicitly admitted payloads. Traits register new rewards through compiled triggers; their explicit lifetime
 * handlers and value policies remain available when activation discovery is disabled.
 */
export interface ProfessionRuntimeOptions {
  readonly traitTriggers?: boolean;
}

/** Compiled runtime adds selected content and state construction to the canonical author and query contracts. */
export interface RuntimeProfession<T extends object, TSkill extends Skill = Skill>
  extends RuntimeHooks<T, TSkill>, Gw2QueryProfession {
  readonly catalog: CanonicalCatalog<TSkill>;
  /** Full profession identities remain valid selections when the active specialization narrows executable skills. */
  readonly skillSelectionCatalog: CanonicalCatalog<TSkill>;
  /** Selected trait listeners for each trigger point, in each point's declared order; empty for isolated payloads. */
  readonly triggerListeners: ReadonlyMap<string, readonly TriggerListener<T, TSkill>[]>;
  createState(config: Gw2Config): T;
  /** Compilation supplies a selector even for empty projections; the observer owns snapshot detachment. */
  projectPlanningState(input: Gw2PlanningStateInput<T>): unknown;
  /** Restricts equipped-set changes after combat entry, independently of temporary bars. */
  readonly canSwapWeaponSetsInCombat: boolean;
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  readonly autoattackChainOverrides?: readonly AutoattackChainOverride[];
}
