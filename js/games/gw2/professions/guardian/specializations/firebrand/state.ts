import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';

import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import type {
  GuardianConfig,
  GuardianFirebrandState,
  GuardianSchedulerContext
} from '#gw2/professions/guardian/types.js';

/** Normalizes page overrides against trait capacity and starts regeneration only below the cap. */
function initialTomePageState(
  config: GuardianConfig,
  archivistOfWhispers: boolean,
  defaultMaximum: number,
  traitMaximum: number,
  tomePageInterval: number
) {
  const maximumTomePages = Math.max(traitMaximum, Number(config.maximumTomePages || traitMaximum));
  const configuredInitialPages = Number(config.initialTomePages ?? traitMaximum);
  // Archivist upgrades the untraited default, while explicit nondefault page counts remain intact.
  const initialPages =
    archivistOfWhispers && configuredInitialPages === defaultMaximum ? traitMaximum : configuredInitialPages;
  const tomePages = Math.max(0, Math.min(maximumTomePages, initialPages));
  return {
    tomePages,
    maximumTomePages,
    tomePageInterval,
    nextTomePageAt: tomePages < maximumTomePages ? tomePageInterval : Number.POSITIVE_INFINITY
  };
}

export function createFirebrandState(config: GuardianConfig = {}): GuardianFirebrandState {
  const archivistOfWhispers = hasTrait(config, GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS);
  return {
    activeTome: '',
    ...initialTomePageState(
      config,
      archivistOfWhispers,
      5,
      archivistOfWhispers ? 8 : 5,
      hasTrait(config, GUARDIAN_TRAIT_IDS.LOREMASTER) ? 5 : 8
    ),
    ashesCharges: 0,
    ashesBurnDuration: 2,
    ashesNextTriggerAt: 0,
    ashesExpiresAt: 0,
    nextCourageAegisAt: 0,
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
export const FIREBRAND_PUBLIC_END_STATE_KEYS: readonly (keyof GuardianFirebrandState)[] = Object.freeze([
  'activeTome',
  'tomePages',
  'maximumTomePages',
  'tomePageInterval',
  'nextTomePageAt',
  'ashesCharges',
  'ashesExpiresAt',
  'nextCourageAegisAt',
  'tomeDormantReadyAt',
  'swiftScholarTome',
  'swiftScholarCount',
  'liberatorsVowReadyAt',
  'stalwartSpeedReadyAt',
  'quickfireReadyAt',
  'mantraRechargeReadyAt'
]);

export const FIREBRAND_RESOLVER_END_STATE_KEYS: readonly (keyof GuardianFirebrandState)[] = Object.freeze([
  'ashesCharges',
  'ashesExpiresAt',
  'stalwartSpeedReadyAt',
  'quickfireReadyAt'
]);

export const FIREBRAND_PUBLIC_END_STATE_DEFAULTS: Readonly<Partial<GuardianFirebrandState>> = Object.freeze({
  activeTome: '',
  tomePages: 5,
  maximumTomePages: 5,
  tomePageInterval: 8,
  nextTomePageAt: Number.POSITIVE_INFINITY,
  ashesCharges: 0,
  ashesExpiresAt: 0,
  nextCourageAegisAt: 0,
  tomeDormantReadyAt: { justice: 0, resolve: 0, courage: 0 },
  swiftScholarTome: '',
  swiftScholarCount: 0,
  liberatorsVowReadyAt: 0,
  stalwartSpeedReadyAt: 0,
  quickfireReadyAt: 0,
  mantraRechargeReadyAt: {}
});

// Derive page capacity, regeneration cadence, starting pages, and Ashes duration
// from the selected traits while respecting explicit build overrides.
export function initializeFirebrandBalanceState(context: GuardianSchedulerContext): void {
  const state = firebrandState.from(context);
  const archivistOfWhispers = hasTrait(context, GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS);
  const resources = balanceProfileFromContext(context, PROFILE.resources);
  const defaultMaximum = Number(resources?.maximumStacks ?? 5);
  const traitMaximum = archivistOfWhispers
    ? Number(balanceProfileFromContext(context, PROFILE.archivistOfWhispers)?.maximumStacks ?? 8)
    : defaultMaximum;
  const interval = hasTrait(context, GUARDIAN_TRAIT_IDS.LOREMASTER)
    ? Number(balanceProfileFromContext(context, PROFILE.loremaster)?.pulseInterval ?? 5)
    : Number(resources?.pulseInterval ?? 8);
  Object.assign(
    state,
    initialTomePageState(context.config, archivistOfWhispers, defaultMaximum, traitMaximum, interval)
  );
  state.ashesBurnDuration = Number(
    balanceProfileEffect(balanceProfileFromContext(context, PROFILE.ashes), 'condition')?.duration ?? 2
  );
}

export const firebrandState = defineProfessionSpecializationState('Firebrand', createFirebrandState);
