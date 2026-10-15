import {
  simulationEffectFacts,
  skillTooltip,
  tooltipProfile,
  type DescribeSimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';

/** Share tooltip formatting and descriptions used by multiple profession owners. */

/** Label profile alternatives by their actual trigger rather than presenting them as simultaneous payloads. */
export function virtueBoons(description: string): DescribeSimulationTooltip {
  return (context, entity) => ({
    description,
    facts: (tooltipProfile(context, entity.id).effects || []).flatMap(
      (effect, index) => simulationEffectFacts([effect], ['Justice', 'Resolve', 'Courage'][index]).facts
    )
  });
}

export const virtueTooltip: DescribeSimulationTooltip = skillTooltip(
  "Activate this virtue and trigger its applicable trait effects. Its passive follows the virtue's recharge state; specialization-specific replacements change the active effect."
);
