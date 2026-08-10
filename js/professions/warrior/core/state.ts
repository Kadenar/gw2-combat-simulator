import { flattenProfessionState } from "../../../platform/engine/profession.js";
import type {
  WarriorConfig,
  WarriorCoreState,
  WarriorEndStateProjectionOptions,
  WarriorState,
} from "../types.js";

export function warriorMaximumAdrenaline(config: WarriorConfig = {}): number {
  if (config.specialization === "Bladesworn") return 0;
  if (config.specialization === "Spellbreaker") return 20;
  if (config.specialization === "Paragon") return 10;
  return 30;
}

export function createWarriorCoreState(
  config: WarriorConfig = {},
): WarriorCoreState {
  const maximumAdrenaline = warriorMaximumAdrenaline(config);
  const adrenaline = Math.max(
    0,
    Math.min(maximumAdrenaline, Number(config.initialResource ?? 0)),
  );
  return {
    adrenaline,
    resource: adrenaline,
    maximumAdrenaline,
    lastResourceAt: 0,
    endurance: 100,
    maximumEndurance: 100,
    enduranceUpdatedAt: 0,
    autoattackChains: {},
    availableFlips: {},
    burstPowerExpiries: [],
    signetMasteryExpiries: [],
    signetOfRageNextAt: 0,
    targetControlledUntil: 0,
    soldierFocusReadyAt: 0,
    empowerAlliesNextAt: 0,
    burstHitActivations: {},
    burstPrecisionDurations: {},
    traitProcReadyAt: {},
    armsCriticalProgress: 0,
    bloodlustProgress: 0,
    furiousSurgeExpiries: [],
  };
}

export function snapshotWarriorState(state: unknown): WarriorState {
  return structuredClone(
    flattenProfessionState(state),
  ) as unknown as WarriorState;
}

export const WARRIOR_PUBLIC_END_STATE_KEYS: readonly (keyof WarriorState)[] =
  Object.freeze([
    "adrenaline",
    "resource",
    "maximumAdrenaline",
    "endurance",
    "maximumEndurance",
    "autoattackChains",
    "availableFlips",
    "berserkActive",
    "berserkUntil",
    "attackerInsightExpiries",
    "fullCounterActiveUntil",
    "magebaneTetherUntil",
    "magebaneTetherReadyAt",
    "flow",
    "maximumFlow",
    "flowStabilizerWindows",
    "traitPositiveFlowStartedAt",
    "traitPositiveFlowUntil",
    "gunsaberActive",
    "dragonTriggerActive",
    "dragonCharges",
    "overchargedCartridgeWindows",
    "motivation",
    "maximumMotivation",
    "activeRefrain",
  ]);

const INACTIVE_DEFAULTS: Readonly<Partial<WarriorState>> = Object.freeze({
  berserkActive: false,
  berserkUntil: 0,
  attackerInsightExpiries: [],
  fullCounterActiveUntil: 0,
  magebaneTetherUntil: 0,
  magebaneTetherReadyAt: 0,
  flow: 0,
  maximumFlow: 100,
  flowStabilizerWindows: [],
  traitPositiveFlowStartedAt: 0,
  traitPositiveFlowUntil: 0,
  gunsaberActive: false,
  dragonTriggerActive: false,
  dragonCharges: 0,
  overchargedCartridgeWindows: [],
  motivation: 0,
  maximumMotivation: 10,
  activeRefrain: "",
  endurance: 100,
  maximumEndurance: 100,
});

export function projectWarriorEndState({
  schedulerState,
}: WarriorEndStateProjectionOptions): Record<string, unknown> {
  const state = snapshotWarriorState(schedulerState.profession);
  return Object.fromEntries(
    WARRIOR_PUBLIC_END_STATE_KEYS.map((key) => [
      key,
      structuredClone(state[key] ?? INACTIVE_DEFAULTS[key]),
    ]),
  );
}
