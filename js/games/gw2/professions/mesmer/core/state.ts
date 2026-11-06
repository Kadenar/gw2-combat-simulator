import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { createPeriodicTaskState, type PeriodicTaskState } from '#gw2/platform/simulation/periodic-task.js';
import type { MesmerCastDetails } from '#gw2/professions/mesmer/core/execution/effect-types.js';
import type { MesmerClone } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { mesmerResourceDefinition, mesmerResourceKind } from '#gw2/professions/mesmer/family-state.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Core owns state present for every specialization runtime. */
export interface MesmerCoreState {
  /** Acceptance facts stay with the run so predicates can read them without acquiring live controllers. */
  castDetails: Map<string, MesmerCastDetails>;
  clones: MesmerClone[];
  /** Monotonic identity survives replacement and shatters without a private controller counter. */
  cloneSequence: number;
  trackedSkillHits: Record<string, number[]>;

  mimic: ChargeGrant;
  scepterChainExpiresAt: number | null;
  clarity: ChargeGrant;
  signetIllusionsPassive: PeriodicTaskState;
}

/** Creates state owned by every Mesmer build, excluding active-specialization fields. */
export function createMesmerCoreState(): MesmerCoreState {
  return {
    castDetails: new Map(),
    clones: [],
    cloneSequence: 0,
    trackedSkillHits: {},

    mimic: { charges: 0, expiresAt: 0 },
    scepterChainExpiresAt: null,
    clarity: { charges: 0, expiresAt: 0 },
    signetIllusionsPassive: createPeriodicTaskState()
  };
}

/** Derive public display values without copying private cast or illusion history. */
export function projectMesmerCorePlanningState(input: Gw2PlanningStateInput) {
  const state = (input.profession as { core: ReturnType<typeof createMesmerCoreState> }).core;
  const at = canonicalTime(input.time);
  return {
    // Clone counts remain entity observations; elite numeric pools are projected by their owners.
    ...(mesmerResourceKind(input.config.specialization ?? 'Core') === 'clones'
      ? {
          [STATE.RESOURCE]: state.clones.length,
          [STATE.RESOURCE_DEFINITION]: mesmerResourceDefinition('Core', input.catalog)
        }
      : {}),
    // The display timer projects the grant without consuming or pruning its owner.
    [STATE.CLARITY_REMAINING]:
      state.clarity.charges > 0 ? Math.max(0, Math.round((state.clarity.expiresAt - at) * 1000)) : 0
  };
}
