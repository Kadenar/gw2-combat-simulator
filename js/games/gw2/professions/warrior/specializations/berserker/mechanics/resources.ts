import { coreAdrenalinePolicy } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { BERSERKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/berserker/profiles.js';
import { berserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';

/** Berserk changes the shared pool cap; refresh clamps entry and preserves the remaining balance on expiry. */
export const berserkerAdrenalinePolicy: typeof coreAdrenalinePolicy = {
  ...coreAdrenalinePolicy,
  // Build-only resource views have catalog/config but no live mode; they use the starting Core cap.
  maximum: (runtime) =>
    'profession' in runtime && berserkerState.from(runtime).berserkActive
      ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'maximumStacks')
      : coreAdrenalinePolicy.maximum(runtime)
};
