import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';

/** Shares main-cast wind-up and follow-up timing between simulation and combat-log replay. */
export function beguilingHazeCastDuration(
  duration: number,
  followUp: boolean,
  followUpProfile: BalanceProfile,
  mainExtensionProfile: BalanceProfile
): number {
  const profile = followUp ? followUpProfile : mainExtensionProfile;
  const variantDuration = Number(profile.castTimeMs || 0) / 1000;
  return followUp ? variantDuration : duration + variantDuration;
}
