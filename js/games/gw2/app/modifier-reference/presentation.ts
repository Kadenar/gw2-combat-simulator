/** Profession-owned reference descriptions bind real sources and selected rule values without running combat callbacks. */
import { modifierFact, type SimulationTooltip } from '#gw2/app/shared/simulation-tooltip.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type { SkillId, TooltipFact } from '#gw2/platform/skills/types.js';

export interface ModifierPresentation extends SimulationTooltip {
  readonly name?: string;
  readonly skills?: readonly SkillId[];
  readonly category?: 'utility' | 'weapon' | 'mechanic';
  /** Distinguish recipients or conditions when several rules share one displayed modifier. */
  readonly qualifier?: string;
  readonly icon?: string;
}

/** Null explicitly excludes internal arithmetic plumbing from the gameplay reference. */
export type DescribeModifier = (
  context: ProfessionBalanceContext,
  rule: Gw2ModifierRule
) => ModifierPresentation | null;

export type ModifierDescriptions = Readonly<Record<string, DescribeModifier>>;

type ModifierFactSpec = readonly [field: string, label: string, format?: (value: number) => string];

/** Static copy stays beside its profession; numeric facts always come from the selected modifier or catalog. */
export function modifierDescription(
  definition: Omit<ModifierPresentation, 'facts'> & {
    readonly facts?: readonly ModifierFactSpec[] | ((context: ProfessionBalanceContext) => readonly TooltipFact[]);
  }
): DescribeModifier {
  return (context, rule) => ({
    ...definition,
    facts:
      typeof definition.facts === 'function'
        ? definition.facts(context)
        : (definition.facts ?? []).map(([field, label, format]) => modifierFact(context, rule.id, field, label, format))
  });
}
