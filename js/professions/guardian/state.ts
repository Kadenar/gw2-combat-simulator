import { GUARDIAN_TRAIT_IDS } from "./data/ids.js";
import type { SchedulerRecord } from "../../platform/engine/types.js";
import type {
  GuardianConfig,
  GuardianEndStateProjectionOptions,
  GuardianState,
} from "./types.js";

export function createGuardianState(
  config: GuardianConfig = {},
): GuardianState {
  const selectedTraits = new Set((config.selectedTraitIds || []).map(Number));
  const traitMaximum = selectedTraits.has(
    GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS,
  )
    ? 8
    : 5;
  const maximumTomePages = Math.max(
    traitMaximum,
    Number(config.maximumTomePages || traitMaximum),
  );
  const tomePageInterval = selectedTraits.has(GUARDIAN_TRAIT_IDS.LOREMASTER)
    ? 6
    : 8;
  const configuredInitialPages = Number(
    config.initialTomePages ?? traitMaximum,
  );
  const initialPages =
    selectedTraits.has(GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS) &&
    configuredInitialPages === 5
      ? traitMaximum
      : configuredInitialPages;
  const tomePages = Math.max(0, Math.min(maximumTomePages, initialPages));
  return {
    justiceArmed: false,
    justiceActiveArmed: false,
    justiceHitCount: 0,
    justiceBurns: 0,
    justiceActiveBurns: 0,
    justicePassiveBurns: 0,
    virtueReadyAt: {
      justice: 0,
      resolve: 0,
      courage: 0,
    },
    autoattackChains: {},
    availableFlips: {},
    activeTome: "",
    tomePages,
    maximumTomePages,
    tomePageInterval,
    nextTomePageAt:
      tomePages < maximumTomePages
        ? tomePageInterval
        : Number.POSITIVE_INFINITY,
    ashesCharges: 0,
    ashesNextTriggerAt: 0,
    radiantForge: false,
    radiantForgeEndsAt: 0,
    radiantForgeEnteredAt: 0,
    radiantWeapon: "",
    radiantWeaponsUsed: {},
    empoweredArmamentsUntil: 0,
    piercingStanceUntil: 0,
    lightAuraUntil: 0,
    lightFields: [],
    furiousFocusReadyAt: 0,
    radiantJusticeArmed: false,
    radiantCourageSwordArmed: false,
    radiantCourageShieldArmed: false,
    symbolicAvengerStacks: 0,
    symbolicAvengerUntil: 0,
    zealotsResolutionReadyAt: 0,
    resolutionUntil: 0,
    righteousNextMightAt: 0,
    effulgentActiveUntil: 0,
    effulgentStacks: 0,
    // Spear "Illuminated" mechanic.
    spearIlluminatedArmed: false,
    spearIlluminatedUntil: 0,
    spearLuminanceUntil: 0,
    daybreakingSlashChainStep: 0,
  };
}

export function snapshotGuardianState(state: GuardianState): GuardianState {
  return structuredClone(state);
}

// Resolver state must begin at time zero. Scheduler-side Guardian transitions
// that affect damage are replayed through namespaced timeline events.
export function createGuardianResolverState(
  config: GuardianConfig = {},
): GuardianState {
  return createGuardianState(config);
}

export const GUARDIAN_PUBLIC_END_STATE_KEYS = Object.freeze([
  "justiceArmed",
  "justiceActiveArmed",
  "justiceHitCount",
  "justiceBurns",
  "justiceActiveBurns",
  "justicePassiveBurns",
  "virtueReadyAt",
  "autoattackChains",
  "availableFlips",
  "activeTome",
  "tomePages",
  "maximumTomePages",
  "tomePageInterval",
  "nextTomePageAt",
  "ashesCharges",
  "radiantForge",
  "radiantForgeEndsAt",
  "radiantWeapon",
  "radiantWeaponsUsed",
  "empoweredArmamentsUntil",
  "piercingStanceUntil",
  "lightAuraUntil",
  "radiantJusticeArmed",
  "radiantCourageSwordArmed",
  "radiantCourageShieldArmed",
  "symbolicAvengerStacks",
  "symbolicAvengerUntil",
  "zealotsResolutionReadyAt",
  "resolutionUntil",
  "effulgentActiveUntil",
  "effulgentStacks",
  "spearIlluminatedArmed",
  "spearIlluminatedUntil",
  "spearLuminanceUntil",
]);

export function projectGuardianEndState({
  schedulerState,
  resolverState,
}: GuardianEndStateProjectionOptions): SchedulerRecord {
  const state = { ...schedulerState.profession };
  const resolver = resolverState || {};
  // Scheduler state owns castability and resources. These values are produced
  // only while resolving chronological damage and condition events.
  for (const key of [
    "justiceArmed",
    "justiceActiveArmed",
    "justiceHitCount",
    "justiceBurns",
    "justiceActiveBurns",
    "justicePassiveBurns",
    "virtueReadyAt",
    "ashesCharges",
    "ashesNextTriggerAt",
    "symbolicAvengerStacks",
    "symbolicAvengerUntil",
    "zealotsResolutionReadyAt",
    "resolutionUntil",
    "righteousNextMightAt",
    "effulgentActiveUntil",
    "effulgentStacks",
  ]) {
    if (Object.hasOwn(resolver, key)) state[key] = resolver[key];
  }
  return Object.fromEntries(
    GUARDIAN_PUBLIC_END_STATE_KEYS.map((key) => [
      key,
      structuredClone(state[key]),
    ]),
  );
}
