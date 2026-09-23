import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { balanceProfileNumber } from '#gw2/platform/engine/skills/balance-profiles.js';

/** Shares main-cast wind-up and follow-up timing between simulation and combat-log replay. */
export function beguilingHazeCastDuration(
  duration: number,
  followUp: boolean,
  followUpProfile: BalanceProfile,
  mainExtensionProfile: BalanceProfile
): number {
  const profile = followUp ? followUpProfile : mainExtensionProfile;
  // Both cast variants have authored timing; zero remains a valid instant duration.
  const variantDuration = balanceProfileNumber(profile, 'castTimeMs') / 1000;
  return followUp ? variantDuration : duration + variantDuration;
}
