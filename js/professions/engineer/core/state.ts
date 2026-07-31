import type {
  SchedulerRecord,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  EngineerConfig,
  EngineerCoreState,
  EngineerEndStateProjectionOptions,
  EngineerRuntimeState,
  EngineerState,
} from "../types.js";
import { flattenProfessionState } from "../../../platform/engine/profession.js";

export function selectedEngineerTraits(
  config: EngineerConfig = {},
): Set<SkillId> {
  return new Set([
    ...(config.traitIds || []),
    ...(config.selectedTraitIds || []),
    ...(config.selectedTraits || []),
  ].map((value) =>
    Number.isFinite(Number(value)) ? Number(value) : value
  ));
}

export function hasEngineerTrait(
  configOrTraits: EngineerConfig | ReadonlySet<SkillId>,
  traitId: SkillId,
): boolean {
  const traits = typeof (configOrTraits as ReadonlySet<SkillId>).has
      === "function"
    ? configOrTraits as ReadonlySet<SkillId>
    : selectedEngineerTraits(configOrTraits as EngineerConfig);
  return traits.has(traitId) || traits.has(String(traitId));
}

export function createEngineerCoreState(
  _config: EngineerConfig = {},
): EngineerCoreState {
  return {
    endurance: 100,
    maximumEndurance: 100,
    enduranceUpdatedAt: 0,
    activeKit: "",
    fireProjectileFinisherProgress: 0,
    completedBlastFinisherActivations: {},
    activeComboFields: [],
    availableFlips: {},
    autoattackChains: {},
    lightningRodActivationId: "",
    lightningRodChargeExpiries: [],
    electricArtilleryAvailable: false,
    electricArtilleryReadyAt: 0,
    electricArtilleryExpiresAt: 0,
    focusedUntil: 0,
    kineticCharges: 0,
    traitProcReadyAt: {},
  };
}

export function snapshotEngineerState(
  state: unknown,
): EngineerState {
  return structuredClone(
    flattenProfessionState(state),
  ) as unknown as EngineerState;
}

export const ENGINEER_PUBLIC_END_STATE_KEYS = Object.freeze([
  "endurance",
  "maximumEndurance",
  "heat",
  "maximumHeat",
  "photonForgeActive",
  "forgeExitedAt",
  "overheated",
  "solarFocusingLensStacks",
  "solarFocusingLensReadyAt",
  "solarFocusingLensUntil",
  "activeKit",
  "availableFlips",
  "autoattackChains",
  "mech",
  "selectedMorphSkillIds",
  "evolvedUntil",
  "focusedUntil",
  "lightningRodChargeExpiries",
  "electricArtilleryAvailable",
  "electricArtilleryReadyAt",
  "electricArtilleryExpiresAt",
  "willingHostUntil",
  "plasmaticStateUntil",
  "plasmaticLockoutUntil",
  "thornsUntil",
  "rapaciousUntil",
  "predatorUntil",
  "titanicUntil",
  "berserkerUntil",
  "activeStances",
  "kineticCharges",
] as const satisfies readonly (keyof EngineerState)[]);

const ENGINEER_PUBLIC_INACTIVE_STATE_DEFAULTS:
  Readonly<Partial<EngineerState>> = Object.freeze({
  heat: 0,
  maximumHeat: 100,
  photonForgeActive: false,
  forgeExitedAt: null,
  overheated: false,
  solarFocusingLensStacks: 0,
  solarFocusingLensReadyAt: 0,
  solarFocusingLensUntil: 0,
  mech: {
    enabled: false,
    active: false,
    commandSkillIds: [],
    nextAttackAt: null,
    busyUntil: 0,
    attributes: null,
  },
  selectedMorphSkillIds: [],
  evolvedUntil: 0,
  willingHostUntil: 0,
  plasmaticStateUntil: 0,
  plasmaticLockoutUntil: 0,
  thornsUntil: 0,
  rapaciousUntil: 0,
  predatorUntil: 0,
  titanicUntil: 0,
  berserkerUntil: 0,
  activeStances: {},
});

export function projectEngineerEndState({
  schedulerState,
}: EngineerEndStateProjectionOptions): SchedulerRecord {
  const state = snapshotEngineerState(schedulerState.profession);
  return Object.fromEntries(
    ENGINEER_PUBLIC_END_STATE_KEYS.map((key) => [
      key,
      structuredClone(
        state[key] ?? ENGINEER_PUBLIC_INACTIVE_STATE_DEFAULTS[key],
      ),
    ]),
  );
}
