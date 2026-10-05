import { balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';

/** Shade strikes and trait previews use the same Scourge-owned Dhuumfire duration and cooldown override. */
export function shadeDhuumfireParameters(profile: BalanceProfile) {
  return {
    dhuumfireDuration: balanceProfileNumber(profile, 'dhuumfireDuration'),
    dhuumfireInterval: balanceProfileNumber(profile, 'dhuumfireInterval')
  };
}
