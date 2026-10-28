import { normalizeSelectedTraitIds } from '#gw2/platform/builds/selected-traits.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { EngineerConfig } from '#gw2/professions/engineer/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface EngineerCoreState {
  endurance: ResourceClock;
  /** The equip skill identifies the active bundle independently of its display name. */
  activeKit: SkillId | null;
  availableFlips: SkillFlipWindows;
  autoattackChains: Record<string, SkillId>;
  lightningRodChargeExpiries: number[];
  lightningRodGeneration: number;
  healingTurretGeneration: number;
  healingTurretActivationId: string;
  kineticCharges: number;
  pendingMineFieldActivationIds: string[];
  explosiveEntranceFired: boolean;
  aimAssistedRocketCount: number;
}

/** Normalizes canonical trait IDs for state initialization and runtime membership checks. */
export function selectedEngineerTraits(config: EngineerConfig = {}): Set<SkillId> {
  return normalizeSelectedTraitIds(config.selectedTraitIds);
}

/** Creates a fresh Core Engineer state with resources, kit state, flips, and proc windows reset. */
export function createEngineerCoreState(): EngineerCoreState {
  return {
    endurance: createResourceClock(ENDURANCE.maximum),
    activeKit: null,
    availableFlips: {},
    autoattackChains: {},
    lightningRodChargeExpiries: [],
    lightningRodGeneration: 0,
    healingTurretGeneration: 0,
    healingTurretActivationId: '',
    kineticCharges: 0,
    pendingMineFieldActivationIds: [],
    explosiveEntranceFired: false,
    aimAssistedRocketCount: 0
  };
}

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectEngineerCorePlanningState(input: Gw2PlanningStateInput) {
  const state = (input.profession as { core: ReturnType<typeof createEngineerCoreState> }).core;
  return structuredClone({
    [STATE.ENDURANCE]: state.endurance,
    [STATE.ACTIVE_KIT]: state.activeKit,
    [STATE.AVAILABLE_FLIPS]: state.availableFlips,
    [STATE.AUTOATTACK_CHAINS]: state.autoattackChains,
    [STATE.LIGHTNING_ROD_CHARGE_EXPIRIES]: state.lightningRodChargeExpiries,
    [STATE.KINETIC_CHARGES]: state.kineticCharges
  });
}
