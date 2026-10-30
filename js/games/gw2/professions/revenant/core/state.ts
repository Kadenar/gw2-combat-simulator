import type { ActivationClaims } from '#gw2/platform/combat/procs/activation-claims.js';
import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import { cloneStateFields } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { createPeriodicTaskState, type PeriodicTaskState } from '#gw2/platform/simulation/periodic-task.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import {
  REVENANT_ENERGY_REGENERATION,
  REVENANT_MAXIMUM_ENERGY,
  REVENANT_PRECOMBAT_ENERGY_CEILING,
  revenantStartingEnergy
} from '#gw2/professions/revenant/core/resource-values.js';
import { normalizeRevenantLegendIds } from '#gw2/professions/revenant/data/legends.js';
import type { RevenantConfig } from '#gw2/professions/revenant/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface RevenantUpkeepState {
  skillId: SkillId;
  upkeepCost: number;
  /** Every upkeep has an activation instant so teardown can retire its scheduled work. */
  startsAt: number;
  empoweredNextPulse: boolean;
}

/** Each application keeps its identity and expiry so delayed cleanses remove only their selected conditions. */
interface RevenantSelfCondition {
  readonly expiresAt: number;
}

export interface RevenantCoreState {
  activationClaims: ActivationClaims;
  energy: ResourceClock;
  activeLegendId: string;
  selectedLegendIds: string[];
  activeUpkeeps: RevenantUpkeepState[];
  availableFlips: SkillFlipWindows;
  autoattackChains: Record<string, SkillId>;
  endurance: ResourceClock;
  enchantedDaggers: ChargeGrant;
  battleScars: number[];
  crushingAbyss: number[];
  combatBeganAt: number | null;
  nextThrillOfCombatAt: number | null;
  exposeDefensesUsed: boolean;
  selfConditions: RevenantSelfCondition[];

  /** Combat anchors replace pending passive work through the shared lifecycle. */
  assassinsPresence: PeriodicTaskState;
}

// Initialize bounded energy and endurance plus complete legend, upkeep, flip,
// weapon-chain, and trait bookkeeping.
export function createRevenantCoreState(config: RevenantConfig): RevenantCoreState {
  const selectedLegendIds = normalizeRevenantLegendIds(config.selectedLegends, config.specialization);
  const configuredStartingLegend = config.startingLegend || '';
  const activeLegendId = selectedLegendIds.includes(configuredStartingLegend)
    ? configuredStartingLegend
    : selectedLegendIds[0] || '';
  return {
    // Standalone construction (attribute previews) shares the runtime policy's fixed energy values;
    // no upkeep is active yet, so the base rate is the whole rate.
    energy: {
      ...createResourceClock(revenantStartingEnergy(config)),
      maximum: REVENANT_MAXIMUM_ENERGY,
      rate: REVENANT_ENERGY_REGENERATION,
      recoveryMaximum: REVENANT_PRECOMBAT_ENERGY_CEILING
    },
    activationClaims: {},
    activeLegendId,
    selectedLegendIds,
    activeUpkeeps: [],
    availableFlips: {},
    autoattackChains: {},
    endurance: createResourceClock(ENDURANCE.maximum),
    enchantedDaggers: {
      charges: 0,
      expiresAt: 0,
      readyAt: 0
    },
    battleScars: [],
    crushingAbyss: [],
    combatBeganAt: null,
    nextThrillOfCombatAt: null,
    exposeDefensesUsed: false,
    selfConditions: [],

    assassinsPresence: createPeriodicTaskState()
  };
}

/** Derive the shared loadout identity from the current legend without storing a second live identity. */
export function projectRevenantPlanningState(input: Gw2PlanningStateInput) {
  const state = cloneStateFields((input.profession as { core: ReturnType<typeof createRevenantCoreState> }).core, [
    'energy',
    'activeLegendId',
    'selectedLegendIds',
    'activeUpkeeps',
    'availableFlips',
    'autoattackChains',
    'endurance',

    'enchantedDaggers',
    'crushingAbyss',
    'combatBeganAt',
    'selfConditions'
  ]);
  return {
    [STATE.ENERGY]: state.energy,
    [STATE.ACTIVE_LEGEND_ID]: state.activeLegendId,
    [STATE.SELECTED_LEGEND_IDS]: state.selectedLegendIds,
    [STATE.ACTIVE_UPKEEPS]: state.activeUpkeeps,
    [STATE.AVAILABLE_FLIPS]: state.availableFlips,
    [STATE.AUTOATTACK_CHAINS]: state.autoattackChains,
    [STATE.ENDURANCE]: state.endurance,
    [STATE.ENCHANTED_DAGGERS]: state.enchantedDaggers,
    [STATE.CRUSHING_ABYSS]: state.crushingAbyss,
    [STATE.COMBAT_BEGAN_AT]: state.combatBeganAt,
    [STATE.SELF_CONDITIONS]: state.selfConditions,
    [STATE.ACTIVE_LOADOUT_ID]: state.activeLegendId
  };
}
