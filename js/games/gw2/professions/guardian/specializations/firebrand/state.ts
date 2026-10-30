import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { createDiscreteResourceClock, type DiscreteResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import type { GuardianCoreState } from '#gw2/professions/guardian/core/state.js';
import { firebrandPageTuning } from '#gw2/professions/guardian/specializations/firebrand/traits/page-tuning.js';
import type { GuardianConfig } from '#gw2/professions/guardian/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { clamp } from '#kernel/core/numeric.js';

export interface GuardianFirebrandState {
  activeTome: string;
  tomePages: DiscreteResourceClock;
  ashes: ChargeGrant;
  /** Each assumed ally's own Ashes grant, keyed by ally index; the allied controller supplies only strikes. */
  alliedAshes: Record<number, ChargeGrant>;
  swiftScholarTome: string;
  swiftScholarCount: number;

  mantraRechargeReadyAt: Record<string, number>;
  mantraWakeGenerations: Record<string, number>;
}

/** Initializes independent resource storage from the profiles supplied by module composition. */
function createFirebrandState(profileContext: {
  readonly config: GuardianConfig;
  readonly balanceProfile: (id: string | number) => BalanceProfile | undefined;
}): GuardianFirebrandState {
  const { maximum, initial, interval } = firebrandPageTuning(profileContext);
  const pages = clamp(initial, 0, maximum);
  return {
    activeTome: '',
    tomePages: {
      ...createDiscreteResourceClock(pages),
      maximum,
      interval,
      nextAt: pages < maximum && interval > 0 ? interval : Infinity
    },
    ashes: grantCharges(0, 0),
    alliedAshes: {},
    swiftScholarTome: '',
    swiftScholarCount: 0,

    mantraRechargeReadyAt: {},
    mantraWakeGenerations: {}
  };
}

export const firebrandState = defineProfessionSpecializationState('Firebrand', createFirebrandState);

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectFirebrandPlanningState(input: Gw2PlanningStateInput) {
  const state = firebrandState.from(input);
  // Tome observations include the shared virtue readiness owned by Core.
  const core = (input.profession as { core: GuardianCoreState }).core;
  return structuredClone({
    [STATE.ACTIVE_TOME]: state.activeTome,
    [STATE.TOME_PAGES]: state.tomePages,
    [STATE.ASHES]: state.ashes,
    [STATE.VIRTUE_READY_AT]: core.virtueReadyAt,
    [STATE.SWIFT_SCHOLAR_COUNT]: state.swiftScholarCount
  });
}
