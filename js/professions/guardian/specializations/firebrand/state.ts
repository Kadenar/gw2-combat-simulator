import { GUARDIAN_TRAIT_IDS } from '../../data/ids.js';
import { defineProfessionSpecializationState } from '../../../../platform/engine/profession/state.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { guardianBalanceProfile, guardianBalanceProfileEffect } from '../../core/profiles.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import type { GuardianConfig, GuardianFirebrandState, GuardianSchedulerContext } from '../../types.js';

export function createFirebrandState(config: GuardianConfig = {}): GuardianFirebrandState {
  const archivistOfWhispers = hasTrait(config, GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS);
  const traitMaximum = archivistOfWhispers ? 8 : 5;
  // config.maximumTomePages can override upward (e.g. test harness or future
  // traits), but never below what the selected traits already grant.
  const maximumTomePages = Math.max(traitMaximum, Number(config.maximumTomePages || traitMaximum));
  const tomePageInterval = hasTrait(config, GUARDIAN_TRAIT_IDS.LOREMASTER) ? 5 : 8;
  const configuredInitialPages = Number(config.initialTomePages ?? traitMaximum);
  // If Archivist of Whispers raised the cap from 5 to 8 but the caller passed
  // the old default of 5, silently upgrade to the new maximum so the sim
  // doesn't start with fewer pages than the trait provides.
  const initialPages = archivistOfWhispers && configuredInitialPages === 5 ? traitMaximum : configuredInitialPages;
  const tomePages = Math.max(0, Math.min(maximumTomePages, initialPages));
  return {
    activeTome: '',
    tomePages,
    maximumTomePages,
    tomePageInterval,
    // +Infinity signals "don't schedule a regen tick" when the pool is already
    // full; the scheduler loop only advances the timer while pages < maximum.
    nextTomePageAt: tomePages < maximumTomePages ? tomePageInterval : Number.POSITIVE_INFINITY,
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
  const resources = guardianBalanceProfile(context, PROFILE.resources);
  const defaultMaximum = Number(resources?.maximumStacks || 5);
  const traitMaximum = archivistOfWhispers
    ? Number(guardianBalanceProfile(context, PROFILE.archivistOfWhispers)?.maximumStacks || 8)
    : defaultMaximum;
  state.maximumTomePages = Math.max(traitMaximum, Number(context.config.maximumTomePages || traitMaximum));
  state.tomePageInterval = hasTrait(context, GUARDIAN_TRAIT_IDS.LOREMASTER)
    ? Number(guardianBalanceProfile(context, PROFILE.loremaster)?.pulseInterval || 5)
    : Number(resources?.pulseInterval || 8);
  const configuredInitialPages = Number(context.config.initialTomePages ?? traitMaximum);
  const initialPages =
    archivistOfWhispers && configuredInitialPages === defaultMaximum ? traitMaximum : configuredInitialPages;
  state.tomePages = Math.max(0, Math.min(state.maximumTomePages, initialPages));
  state.nextTomePageAt = state.tomePages < state.maximumTomePages ? state.tomePageInterval : Number.POSITIVE_INFINITY;
  state.ashesBurnDuration = Number(
    guardianBalanceProfileEffect(guardianBalanceProfile(context, PROFILE.ashes), 'condition')?.duration || 2
  );
}

export const firebrandState = defineProfessionSpecializationState('Firebrand', createFirebrandState);
