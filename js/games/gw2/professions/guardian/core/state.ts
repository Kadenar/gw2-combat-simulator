import type { GuardianCoreState, GuardianConfig } from '#gw2/professions/guardian/types.js';

// Create a complete Guardian core state with bounded resources and initialized
// virtue, trait, symbol, and flip bookkeeping.
export function createGuardianCoreState(config: GuardianConfig = {}): GuardianCoreState {
  return {
    endurance: Math.max(0, Math.min(100, Number(config.initialEndurance ?? 100))),
    maximumEndurance: 100,
    enduranceUpdatedAt: 0,
    justiceArmed: false,
    justiceActiveArmed: false,
    justiceHitCount: 0,
    justiceBurns: 0,
    justiceActiveBurns: 0,
    justicePassiveBurns: 0,
    virtueReadyAt: {
      justice: 0,
      resolve: 0,
      courage: 0
    },
    lastVirtue: '',
    lastVirtuePassiveWasReady: false,
    autoattackChains: {},
    availableFlips: {},
    symbolicAvengerStacks: 0,
    symbolicAvengerUntil: 0,
    symbolIgnitionStartsAt: -1,
    symbolIgnitionUntil: -1,
    symbolIgnitionReadyAt: 0,
    zealotsResolutionReadyAt: 0,
    resolutionUntil: 0,
    righteousNextMightAt: 0,
    furiousFocusReadyAt: 0,
    spearIlluminatedArmed: false,
    spearIlluminatedUntil: 0,
    spearLuminanceUntil: 0
  };
}

/** Declares the Core-owned portion of Guardian's stable public end-state contract. */
export const GUARDIAN_CORE_PUBLIC_END_STATE_KEYS: readonly (keyof GuardianCoreState)[] = Object.freeze([
  'endurance',
  'maximumEndurance',
  'justiceArmed',
  'justiceActiveArmed',
  'justiceHitCount',
  'justiceBurns',
  'justiceActiveBurns',
  'justicePassiveBurns',
  'virtueReadyAt',
  'autoattackChains',
  'availableFlips',
  'symbolIgnitionStartsAt',
  'symbolIgnitionUntil',
  'symbolIgnitionReadyAt',
  'symbolicAvengerStacks',
  'symbolicAvengerUntil',
  'zealotsResolutionReadyAt',
  'resolutionUntil',
  'spearIlluminatedArmed',
  'spearIlluminatedUntil',
  'spearLuminanceUntil'
]);

/** Identifies Core fields whose chronological resolver values supersede scheduler snapshots. */
export const GUARDIAN_CORE_RESOLVER_END_STATE_KEYS: readonly (keyof GuardianCoreState)[] = Object.freeze([
  'justiceArmed',
  'justiceActiveArmed',
  'justiceHitCount',
  'justiceBurns',
  'justiceActiveBurns',
  'justicePassiveBurns',
  'virtueReadyAt',
  'symbolicAvengerStacks',
  'symbolicAvengerUntil',
  'zealotsResolutionReadyAt',
  'resolutionUntil'
]);
