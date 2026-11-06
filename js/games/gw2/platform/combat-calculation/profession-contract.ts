/** Calculation consumers share selected policies without depending on compilation or execution. */
import type { Gw2Stats } from '#gw2/platform/attributes/stats.js';
import type { Gw2AttributeContributions } from '#gw2/platform/attributes/types.js';
import type { Gw2ModifierContext, Gw2ModifierHooks } from '#gw2/platform/combat/modifiers.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';

/** Selected calculation policies are shared by queries and compiled runtimes without rebuilding evaluators. */
export interface Gw2ProfessionCalculations extends Gw2ModifierHooks {
  readonly attributeContributions?: (context: Gw2ModifierContext) => readonly Gw2AttributeContributions[];
  readonly modifyConditionAttributes: (context: Gw2ModifierContext, attributes: Gw2Stats) => Gw2Stats;
}

/** Calculations require selected content and policies, without state creation or execution capabilities. */
export interface Gw2QueryProfession {
  readonly id: string;
  readonly catalog: Readonly<CanonicalCatalog>;
  readonly calculations: Readonly<Gw2ProfessionCalculations>;
  readonly playerAlacrityRechargeRate?: number;
}
