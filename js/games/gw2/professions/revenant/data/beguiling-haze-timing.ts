import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';

/** Use the complete main cast or the charged follow-up duration in both simulation and import. */
export function beguilingHazeCastDuration(
  duration: number,
  followUp: boolean,
  followUpProfile: BalanceProfile
): number {
  return followUp ? balanceProfileNumber(followUpProfile, 'castTimeMs') / 1000 : duration;
}
