import {
  simulationEffectFacts,
  skillTooltip,
  tooltipProfile,
  type DescribeSimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import { requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { virtueBoonEffects } from '#gw2/professions/guardian/core/mechanics/virtue-boons.js';

/** Look up each virtue's effect by name so patch removals cannot relabel the surviving boons. */
export function virtueBoons(description: string): DescribeSimulationTooltip {
  return (context, entity) => {
    const profile = tooltipProfile(context, entity.id);
    const facts = Object.entries(virtueBoonEffects).flatMap(([virtue, { type, name }]) => {
      const effect = requireEffect(profile, type, name);

      if (!effect) return [];

      // The stable effect name selects the virtue. Only the delivered boon belongs in the displayed fact.
      return simulationEffectFacts([{ ...effect, name: effect.boon }], virtue[0].toUpperCase() + virtue.slice(1)).facts;
    });
    return { description, facts };
  };
}

export const virtueTooltip: DescribeSimulationTooltip = skillTooltip(
  "Activate this virtue and trigger its applicable trait effects. Its passive follows the virtue's recharge state; specialization-specific replacements change the active effect."
);
