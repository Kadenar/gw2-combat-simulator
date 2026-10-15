import { tooltipPercent } from '#gw2/app/shared/simulation-tooltip.js';

/** Share tooltip formatting and descriptions used by multiple profession owners. */

export const percentagePoints = (value: number) => tooltipPercent(value / 100);
