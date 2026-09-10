import type { GuardianCoreState, GuardianCorePublicState, GuardianConfig } from '#gw2/professions/guardian/types.js';

// Create a complete Guardian core state with bounded resources and initialized
// virtue, trait, symbol, and flip bookkeeping.
export function createGuardianCoreState(config: GuardianConfig = {}): GuardianCoreState {
  return {
    endurance: Math.max(0, Math.min(100, Number(config.initialEndurance ?? 100))),
    maximumEndurance: 100,
    enduranceUpdatedAt: 0,
    justiceActiveArmed: false,
    justiceHitCount: 0,
    justiceActiveBurns: 0,
    justicePassiveBurns: 0,
    virtueReadyAt: {
      justice: 0,
      resolve: 0,
      courage: 0
    },
    lastVirtuePassiveWasReady: false,
    autoattackChains: {},
    availableFlips: {},
    symbolicAvengerExpirations: [],
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

/** Each Symbolic Avenger stack expires independently, including between symbol hits. */
export function activeSymbolicAvengerExpirations(state: Partial<GuardianCoreState>, at: number): number[] {
  return (state.symbolicAvengerExpirations || []).filter((expiresAt) => expiresAt > at);
}

/** Declares the Core-owned portion of Guardian's stable public end-state contract. */
export const GUARDIAN_CORE_PUBLIC_END_STATE_KEYS: readonly (keyof GuardianCorePublicState)[] = Object.freeze([
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
  'symbolicAvengerExpirations',
  'zealotsResolutionReadyAt',
  'resolutionUntil',
  'spearIlluminatedArmed',
  'spearIlluminatedUntil',
  'spearLuminanceUntil'
]);

/** Identifies Core fields whose chronological resolver values supersede scheduler snapshots. */
export const GUARDIAN_CORE_RESOLVER_END_STATE_KEYS: readonly (keyof GuardianCoreState)[] = Object.freeze([
  'justiceActiveArmed',
  'justiceHitCount',
  'justiceActiveBurns',
  'justicePassiveBurns',
  'virtueReadyAt',
  'symbolicAvengerExpirations',
  'zealotsResolutionReadyAt',
  'resolutionUntil'
]);
