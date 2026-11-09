import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { createDiscreteResourceClock, type DiscreteResourceClock } from '#gw2/platform/combat/resources/clock.js';
import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { BalanceProfileSource } from '#gw2/platform/skills/balance-profiles.js';
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
}

/** Initializes independent resource storage from the profiles supplied by module composition. */
function createFirebrandState(profileContext: {
  readonly config: GuardianConfig;
  readonly catalog: BalanceProfileSource;
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
    swiftScholarCount: 0
  };
}

export const firebrandState = defineProfessionSpecializationState('Firebrand', createFirebrandState);

/** Select public fields without mutating their owner; the planning observer detaches the result. */
export function projectFirebrandPlanningState(
  input: Gw2PlanningStateInput<SpecializationRuntimeState & { core: GuardianCoreState }>
) {
  const state = firebrandState.from(input.profession);
  // Tome observations include the shared virtue readiness owned by Core.
  const core = input.profession.core;
  return {
    [STATE.ACTIVE_TOME]: state.activeTome,
    [STATE.TOME_PAGES]: state.tomePages,
    [STATE.ASHES]: state.ashes,
    [STATE.VIRTUE_READY_AT]: core.virtueReadyAt,
    [STATE.SWIFT_SCHOLAR_COUNT]: state.swiftScholarCount
  };
}
