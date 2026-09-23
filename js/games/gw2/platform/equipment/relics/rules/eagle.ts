/** Eagle relic rules. */
import { remainingTargetHealthBelow } from '#gw2/platform/combat/state/target-health.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const eagle = defineRelic({
  strikeMultiplier(ctx) {
    // Activates once remaining health, including missing starting health, is strictly below half.
    return remainingTargetHealthBelow(ctx.config, ctx, 0.5) ? 1.1 : 1;
  }
});
