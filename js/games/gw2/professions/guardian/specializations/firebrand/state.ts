import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import {
  createDiscreteResourceClock,
  type DiscreteResourceClock
} from '#gw2/platform/combat/resources/resource-policy.js';
import {
  defineProfessionSpecializationState,
  definePublicStateDefaults
} from '#gw2/platform/profession-definition/state.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { firebrandPageTuning } from '#gw2/professions/guardian/specializations/firebrand/traits/behavior.js';
import type { GuardianConfig } from '#gw2/professions/guardian/types.js';
import { clamp } from '#kernel/core/numeric.js';

export interface GuardianFirebrandState {
  activeTome: string;
  tomePages: DiscreteResourceClock;
  ashes: ChargeGrant;
  ashesBurnDuration: number;
  tomeDormantReadyAt: Record<'justice' | 'resolve' | 'courage', number>;
  swiftScholarTome: string;
  swiftScholarCount: number;

  mantraRechargeReadyAt: Record<string, number>;
  mantraWakeGenerations: Record<string, number>;
}

/** Initializes independent resource storage from the profiles supplied by module composition. */
function createFirebrandState(profileContext: {
  readonly config: GuardianConfig;
  readonly balanceProfile: (id: string | number) => BalanceProfile | undefined;
}): GuardianFirebrandState {
  const { maximum, initial, interval } = firebrandPageTuning(profileContext);
  const pages = clamp(initial, 0, maximum);
  const ashesProfile = requireBalanceProfileFromContext(profileContext, PROFILE.ashes);
  const burn = requireEffect(ashesProfile, 'condition', 'Burning');
  return {
    activeTome: '',
    tomePages: {
      ...createDiscreteResourceClock(pages),
      maximum,
      interval,
      nextAt: pages < maximum && interval > 0 ? interval : Infinity
    },
    ashes: grantCharges(0, 0),
    ashesBurnDuration: burn ? effectNumber(ashesProfile, burn, 'duration') : 0,
    tomeDormantReadyAt: { justice: 0, resolve: 0, courage: 0 },
    swiftScholarTome: '',
    swiftScholarCount: 0,

    mantraRechargeReadyAt: {},
    mantraWakeGenerations: {}
  };
}

/** Keeps Firebrand projection ownership beside the state that produces it. */
export const FIREBRAND_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  activeTome: '',
  tomePages: { ...createDiscreteResourceClock(5), interval: 8 },
  ashes: grantCharges(0, 0),
  tomeDormantReadyAt: { justice: 0, resolve: 0, courage: 0 },
  swiftScholarTome: '',
  swiftScholarCount: 0,

  mantraRechargeReadyAt: {}
} satisfies Partial<GuardianFirebrandState>);

export const firebrandState = defineProfessionSpecializationState('Firebrand', createFirebrandState);
