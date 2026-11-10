/** Purity of Word owns the page pool; saved starting pages remain explicit. */
import {
  balanceProfileNumber,
  requireBalanceProfile,
  type BalanceProfileSource
} from '#gw2/platform/skills/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianConfig } from '#gw2/professions/guardian/types.js';

export function firebrandPageTuning(context: {
  readonly config: GuardianConfig;
  readonly catalog: BalanceProfileSource;
}) {
  const profile = requireBalanceProfile(context.catalog, TRAIT.PURITY_OF_WORD);
  const maximum = balanceProfileNumber(profile, 'maximumStacks');
  return {
    maximum,
    initial: context.config.initialTomePages ?? maximum,
    interval: balanceProfileNumber(profile, 'pulseInterval')
  };
}
