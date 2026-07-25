const QUICKNESS_ACTION_RATE = 1.5;
const ALACRITY_RECHARGE_RATE = 1.25;

/**
 * Supplies shared GW2 timing rules without coupling platform/engine to GW2.
 */
export function createGw2SchedulerPolicy(config = {}) {
  return Object.freeze({
    initialWeaponSet() {
      return Number(config.startingWeaponSet) === 2 ? 2 : 1;
    },

    castDuration(context, _skill, baseDuration) {
      return context.hasBuff("quickness", context.start)
        ? baseDuration / QUICKNESS_ACTION_RATE
        : baseDuration;
    },

    rechargeDuration(context, _skill, baseDuration) {
      const at = context.at ?? context.effectiveEnd ?? context.start;
      const rate = context.hasBuff("alacrity", at)
        ? Number(config.alacrityRechargeRate || ALACRITY_RECHARGE_RATE)
        : 1;
      return baseDuration / Math.max(Number.EPSILON, rate);
    },

    maximumAmmo(_context, skill, baseMaximum) {
      return baseMaximum ?? Number(skill.ammo || 0);
    },
  });
}
