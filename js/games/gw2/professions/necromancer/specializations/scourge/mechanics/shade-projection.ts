import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Shade strikes and trait previews use the same Scourge-owned Dhuumfire duration and cooldown override. */
export function shadeDhuumfireParameters(profile: Skill) {
  return {
    dhuumfireDuration: skillNumber(profile, 'dhuumfireDuration'),
    dhuumfireInterval: skillNumber(profile, 'dhuumfireInterval')
  };
}
