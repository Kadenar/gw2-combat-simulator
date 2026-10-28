import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { createThiefCoreState, type ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import type { ThiefConfig } from '#gw2/professions/thief/types.js';

export interface ThiefCoreReworkState extends ThiefCoreState {
  /** Refreshing mobility leaves one pending attack reward, never accumulated charges. */
  deftInitiationArmed: boolean;
}

/** The replacement module owns its extra state without extending the Live state contract. */
export function createThiefCoreReworkState(
  config: ThiefConfig,
  preparation: { balanceContext: ProfessionBalanceContext }
): ThiefCoreReworkState {
  return { ...createThiefCoreState(config, preparation), deftInitiationArmed: false };
}

/** Only replacement-module handlers call this accessor; a mismatched runtime is an assembly error. */
export function reworkCoreState(runtime: Pick<ThiefRuntime, 'profession'>): ThiefCoreReworkState {
  if (!('deftInitiationArmed' in runtime.profession.core)) throw new TypeError('Thief rework state is required.');

  return runtime.profession.core as ThiefCoreReworkState;
}

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectThiefCoreReworkPlanningState(input: Gw2PlanningStateInput) {
  const state = (input.profession as { core: ReturnType<typeof createThiefCoreReworkState> }).core;
  return structuredClone({
    [STATE.INITIATIVE]: state.initiative,
    [STATE.STEALTH_STARTED_AT]: state.stealthStartedAt,
    [STATE.STEALTH_UNTIL]: state.stealthUntil,
    [STATE.REVEALED_UNTIL]: state.revealedUntil,
    [STATE.STORED_STOLEN_SKILL_IDS]: state.storedStolenSkillIds,
    [STATE.STORED_STOLEN_SKILL_COUNT]: state.storedStolenSkillCount,
    [STATE.KNEELING]: state.kneeling,
    [STATE.ENDURANCE]: state.endurance,
    [STATE.LEAD_ATTACK_EXPIRATIONS]: state.leadAttackExpirations,
    [STATE.SPEAR_CHAIN_STAGE]: state.spearChainStage,
    [STATE.SPEAR_PREVIOUS_SKILL_ID]: state.spearPreviousSkillId,
    [STATE.SPINNING_AXES]: state.spinningAxes,
    [STATE.OUTBOUND_AXES]: state.outboundAxes,
    [STATE.VENOM_CHARGE_BATCHES]: state.venomChargeBatches,
    [STATE.ACTIVE_THIEVES_GUILD]: state.activeThievesGuild,
    [STATE.AVAILABLE_FLIPS]: state.availableFlips,
    [STATE.AUTOATTACK_CHAINS]: state.autoattackChains,
    [STATE.DEFT_INITIATION_ARMED]: state.deftInitiationArmed
  });
}
