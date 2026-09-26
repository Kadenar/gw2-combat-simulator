import {
  createDiscreteResourceClock,
  type DiscreteResourceClock
} from '#gw2/platform/combat/resources/resource-policy.js';
import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  FIREBRAND_BALANCE_PROFILE_IDS as PROFILE,
  FIREBRAND_BALANCE_PROFILES
} from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
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
  liberatorsVowReadyAt: number;
  stalwartSpeedReadyAt: number;
  quickfireReadyAt: number;
  mantraRechargeReadyAt: Record<string, number>;
  mantraWakeGenerations: Record<string, number>;
}

/** Normalizes page overrides against trait capacity and starts regeneration only below the cap. */
function initialTomePageState(
  config: GuardianConfig,
  archivistOfWhispers: boolean,
  defaultMaximum: number,
  traitMaximum: number,
  tomePageInterval: number
) {
  const maximumTomePages = Math.max(traitMaximum, Number(config.maximumTomePages ?? traitMaximum));
  const configuredInitialPages = Number(config.initialTomePages ?? traitMaximum);
  // Archivist upgrades the untraited default, while explicit nondefault page counts remain intact.
  const initialPages =
    archivistOfWhispers && configuredInitialPages === defaultMaximum ? traitMaximum : configuredInitialPages;
  const tomePages = clamp(initialPages, 0, maximumTomePages);
  return {
    tomePages: {
      ...createDiscreteResourceClock(tomePages),
      maximum: maximumTomePages,
      interval: tomePageInterval,
      nextAt: tomePages < maximumTomePages && tomePageInterval > 0 ? tomePageInterval : Infinity
    }
  };
}

export function createFirebrandState(config: GuardianConfig = {}): GuardianFirebrandState {
  const archivistOfWhispers = hasTrait(config, GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS);
  // Standalone state starts from canonical declarations; live initialization selects the active patch.
  const profileContext = {
    balanceProfile: (id: string | number) => FIREBRAND_BALANCE_PROFILES.find((profile) => profile.id === id)
  };
  const resourcesProfile = requireBalanceProfileFromContext(profileContext, PROFILE.resources);
  const maximum = balanceProfileNumber(resourcesProfile, 'maximumStacks');
  const ashesProfile = requireBalanceProfileFromContext(profileContext, PROFILE.ashes);
  const burn = requireEffect(ashesProfile, 'condition', 'Burning');
  return {
    activeTome: '',
    ...initialTomePageState(
      config,
      archivistOfWhispers,
      maximum,
      archivistOfWhispers
        ? balanceProfileNumber(
            requireBalanceProfileFromContext(profileContext, PROFILE.archivistOfWhispers),
            'maximumStacks'
          )
        : maximum,
      balanceProfileNumber(
        requireBalanceProfileFromContext(
          profileContext,
          hasTrait(config, GUARDIAN_TRAIT_IDS.LOREMASTER) ? PROFILE.loremaster : PROFILE.resources
        ),
        'pulseInterval'
      )
    ),
    ashes: grantCharges(0, 0),
    ashesBurnDuration: burn ? effectNumber(ashesProfile, burn, 'duration') : 0,
    tomeDormantReadyAt: { justice: 0, resolve: 0, courage: 0 },
    swiftScholarTome: '',
    swiftScholarCount: 0,
    liberatorsVowReadyAt: 0,
    stalwartSpeedReadyAt: 0,
    quickfireReadyAt: 0,
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
  liberatorsVowReadyAt: 0,
  stalwartSpeedReadyAt: 0,
  quickfireReadyAt: 0,
  mantraRechargeReadyAt: {}
} satisfies Partial<GuardianFirebrandState>);

export const firebrandState = defineProfessionSpecializationState('Firebrand', createFirebrandState);

/** Keeps page tuning local while the platform owns recovery, grants and spending. */
export function firebrandPageTuning(context: { readonly config: GuardianConfig }) {
  const archivistOfWhispers = hasTrait(context, GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS);

  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const defaultMaximum = balanceProfileNumber(resourcesProfile, 'maximumStacks');
  const traitMaximum = archivistOfWhispers
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.archivistOfWhispers), 'maximumStacks')
    : defaultMaximum;
  const interval = hasTrait(context, GUARDIAN_TRAIT_IDS.LOREMASTER)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.loremaster), 'pulseInterval')
    : balanceProfileNumber(resourcesProfile, 'pulseInterval');
  const initial = Number(context.config.initialTomePages ?? traitMaximum);
  return {
    maximum: Math.max(traitMaximum, Number(context.config.maximumTomePages ?? traitMaximum)),
    initial: archivistOfWhispers && initial === defaultMaximum ? traitMaximum : initial,
    interval
  };
}
