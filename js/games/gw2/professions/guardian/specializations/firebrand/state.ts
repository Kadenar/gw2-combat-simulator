import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumberFromContext
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
import type { GuardianConfig, GuardianSchedulerContext } from '#gw2/professions/guardian/types.js';
import { clamp } from '#kernel/core/numeric.js';

export interface GuardianFirebrandState {
  activeTome: string;
  tomePages: number;
  maximumTomePages: number;
  tomePageInterval: number;
  nextTomePageAt: number;
  ashes: ChargeGrant;
  ashesBurnDuration: number;
  tomeDormantReadyAt: Record<'justice' | 'resolve' | 'courage', number>;
  swiftScholarTome: string;
  swiftScholarCount: number;
  liberatorsVowReadyAt: number;
  stalwartSpeedReadyAt: number;
  quickfireReadyAt: number;
  mantraRechargeReadyAt: Record<string, number>;
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
    tomePages,
    maximumTomePages,
    tomePageInterval,
    nextTomePageAt: tomePages < maximumTomePages && tomePageInterval > 0 ? tomePageInterval : Number.POSITIVE_INFINITY
  };
}

export function createFirebrandState(config: GuardianConfig = {}): GuardianFirebrandState {
  const archivistOfWhispers = hasTrait(config, GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS);
  // Standalone state starts from canonical declarations; scheduler initialization selects the active patch.
  const profileContext = {
    balanceProfile: (id: string | number) => FIREBRAND_BALANCE_PROFILES.find((profile) => profile.id === id)
  };
  const maximum = balanceProfileNumberFromContext(profileContext, PROFILE.resources, 'maximumStacks');
  const ashesProfile = requireBalanceProfileFromContext(profileContext, PROFILE.ashes);
  const burn = requireEffect(ashesProfile, 'condition', 'Burning');
  return {
    activeTome: '',
    ...initialTomePageState(
      config,
      archivistOfWhispers,
      maximum,
      archivistOfWhispers
        ? balanceProfileNumberFromContext(profileContext, PROFILE.archivistOfWhispers, 'maximumStacks')
        : maximum,
      balanceProfileNumberFromContext(
        profileContext,
        hasTrait(config, GUARDIAN_TRAIT_IDS.LOREMASTER) ? PROFILE.loremaster : PROFILE.resources,
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
    mantraRechargeReadyAt: {}
  };
}

/** Keeps Firebrand projection ownership beside the state that produces it. */
export const FIREBRAND_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  activeTome: '',
  tomePages: 5,
  maximumTomePages: 5,
  tomePageInterval: 8,
  nextTomePageAt: Number.POSITIVE_INFINITY,
  ashes: grantCharges(0, 0),
  tomeDormantReadyAt: { justice: 0, resolve: 0, courage: 0 },
  swiftScholarTome: '',
  swiftScholarCount: 0,
  liberatorsVowReadyAt: 0,
  stalwartSpeedReadyAt: 0,
  quickfireReadyAt: 0,
  mantraRechargeReadyAt: {}
} satisfies Partial<GuardianFirebrandState>);

// Derive page capacity, regeneration cadence, starting pages, and Ashes duration
// from the selected traits while respecting explicit build overrides.
export function initializeFirebrandBalanceState(context: GuardianSchedulerContext): void {
  const state = firebrandState.from(context);
  const archivistOfWhispers = hasTrait(context, GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS);

  const defaultMaximum = balanceProfileNumberFromContext(context, PROFILE.resources, 'maximumStacks');
  const traitMaximum = archivistOfWhispers
    ? balanceProfileNumberFromContext(context, PROFILE.archivistOfWhispers, 'maximumStacks')
    : defaultMaximum;
  const interval = hasTrait(context, GUARDIAN_TRAIT_IDS.LOREMASTER)
    ? balanceProfileNumberFromContext(context, PROFILE.loremaster, 'pulseInterval')
    : balanceProfileNumberFromContext(context, PROFILE.resources, 'pulseInterval');
  Object.assign(
    state,
    initialTomePageState(context.config, archivistOfWhispers, defaultMaximum, traitMaximum, interval)
  );
  const ashesProfile = requireBalanceProfileFromContext(context, PROFILE.ashes);
  const burn = requireEffect(ashesProfile, 'condition', 'Burning');
  state.ashesBurnDuration = burn ? effectNumber(ashesProfile, burn, 'duration') : 0;
}

export const firebrandState = defineProfessionSpecializationState('Firebrand', createFirebrandState);
