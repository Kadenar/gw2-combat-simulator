import { skillTooltip, type DescribeSimulationTooltip } from '#gw2/app/shared/simulation-tooltip.js';

/** Share tooltip formatting and descriptions used by multiple profession owners. */

export const resourceTooltip: DescribeSimulationTooltip = (balanceContext, entity) =>
  skillTooltip(
    entity.burst
      ? entity.primalBurst
        ? 'Spend adrenaline to perform a primal burst and trigger eligible burst traits.'
        : 'Spend adrenaline to perform a burst and trigger eligible burst traits. Ordinary bursts consume available adrenaline; specialization variants follow their own spending limit.'
      : 'Apply the listed effects and gain the listed combat resource when the activation succeeds.'
  )(balanceContext, entity);
