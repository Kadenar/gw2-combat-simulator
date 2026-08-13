import type { SchedulerRecord } from "../../../platform/engine/types.js";
import { flattenProfessionState } from "../../../platform/engine/profession.js";
import type {
  GuardianCoreState,
  GuardianConfig,
  GuardianEndStateProjectionOptions,
  GuardianState,
} from "../types.js";

export function createGuardianCoreState(
  config: GuardianConfig = {},
): GuardianCoreState {
  return {
    endurance: Math.max(
      0,
      Math.min(100, Number(config.initialEndurance ?? 100)),
    ),
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
      courage: 0,
    },
    lastVirtue: "",
    lastVirtuePassiveWasReady: false,
    autoattackChains: {},
    availableFlips: {},
    symbolicAvengerStacks: 0,
    symbolicAvengerUntil: 0,
    zealotsResolutionReadyAt: 0,
    resolutionUntil: 0,
    righteousNextMightAt: 0,
    furiousFocusReadyAt: 0,
    spearIlluminatedArmed: false,
    spearIlluminatedUntil: 0,
    spearLuminanceUntil: 0,
    daybreakingSlashChainStep: 0,
  };
}

export function snapshotGuardianState(state: unknown): GuardianState {
  return structuredClone(
    flattenProfessionState(state),
  ) as unknown as GuardianState;
}

export const GUARDIAN_PUBLIC_END_STATE_KEYS = Object.freeze([
  "endurance",
  "maximumEndurance",
  "justiceArmed",
  "justiceActiveArmed",
  "justiceHitCount",
  "justiceBurns",
  "justiceActiveBurns",
  "justicePassiveBurns",
  "virtueReadyAt",
  "autoattackChains",
  "availableFlips",
  "tetherUntil",
  "heavyLightReadyAt",
  "activeTome",
  "tomePages",
  "maximumTomePages",
  "tomePageInterval",
  "nextTomePageAt",
  "ashesCharges",
  "ashesExpiresAt",
  "nextCourageAegisAt",
  "tomeDormantReadyAt",
  "swiftScholarTome",
  "swiftScholarCount",
  "liberatorsVowReadyAt",
  "stalwartSpeedReadyAt",
  "quickfireReadyAt",
  "mantraRechargeReadyAt",
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

const GUARDIAN_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<
  Partial<GuardianState>
> = Object.freeze({
  activeTome: "",
  tomePages: 5,
  maximumTomePages: 5,
  tomePageInterval: 8,
  nextTomePageAt: Number.POSITIVE_INFINITY,
  ashesCharges: 0,
  ashesExpiresAt: 0,
  nextCourageAegisAt: 0,
  tomeDormantReadyAt: { justice: 0, resolve: 0, courage: 0 },
  swiftScholarTome: "",
  swiftScholarCount: 0,
  liberatorsVowReadyAt: 0,
  stalwartSpeedReadyAt: 0,
  quickfireReadyAt: 0,
  mantraRechargeReadyAt: {},
  radiantForge: false,
  radiantForgeEndsAt: 0,
  radiantWeapon: "",
  radiantWeaponsUsed: {},
  empoweredArmamentsUntil: 0,
  piercingStanceUntil: 0,
  lightAuraUntil: 0,
  radiantJusticeArmed: false,
  radiantCourageSwordArmed: false,
  radiantCourageShieldArmed: false,
  effulgentActiveUntil: 0,
  effulgentStacks: 0,
  tetherUntil: 0,
  heavyLightReadyAt: 0,
  endurance: 100,
  maximumEndurance: 100,
});

export function projectGuardianEndState({
  schedulerState,
  resolverState,
}: GuardianEndStateProjectionOptions): SchedulerRecord {
  const state = snapshotGuardianState(schedulerState.profession);
  const resolver = flattenProfessionState(resolverState || {});
  const mutableState = state as unknown as SchedulerRecord;
  const inactiveDefaults =
    GUARDIAN_PUBLIC_INACTIVE_STATE_DEFAULTS as unknown as SchedulerRecord;
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
    "ashesExpiresAt",
    "stalwartSpeedReadyAt",
    "quickfireReadyAt",
    "symbolicAvengerStacks",
    "symbolicAvengerUntil",
    "zealotsResolutionReadyAt",
    "resolutionUntil",
    "righteousNextMightAt",
    "effulgentActiveUntil",
    "effulgentStacks",
    "tetherUntil",
    "heavyLightReadyAt",
  ]) {
    if (Object.hasOwn(resolver, key)) mutableState[key] = resolver[key];
  }
  return Object.fromEntries(
    GUARDIAN_PUBLIC_END_STATE_KEYS.map((key) => [
      key,
      structuredClone(mutableState[key] ?? inactiveDefaults[key]),
    ]),
  );
}
