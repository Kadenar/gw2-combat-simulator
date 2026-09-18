/** Eagle relic rules. */
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const eagle = defineRelic({
  strikeMultiplier(ctx) {
    // Activates once effective health loss, including missing starting health,
    // reaches half of the target's maximum health.
    const targetHealth = Number(ctx.config.target?.health || 0);
    return targetHealth > 0 && targetHealthLoss(ctx.config, ctx) >= targetHealth * 0.5 ? 1.1 : 1;
  }
});
