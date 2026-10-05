import type { MesmerCastDetails } from '#gw2/professions/mesmer/core/execution/effect-types.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { snapshotProfessionState } from '#gw2/platform/profession-definition/state.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { skillFlipVisible } from '#gw2/platform/execution/skill-flips.js';
import { mesmerResourceDefinition, mesmerResourceKind } from '#gw2/professions/mesmer/family-state.js';
import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { MesmerClone } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';

/** Core owns state present for every specialization runtime. */
export interface MesmerCoreState {
  /** Acceptance facts stay with the run so predicates can read them without acquiring live controllers. */
  castDetails: Map<string, MesmerCastDetails>;
  clones: MesmerClone[];
  /** Monotonic identity survives replacement and shatters without a private controller counter. */
  cloneSequence: number;
  trackedSkillHits: Record<string, number[]>;

  mimic: ChargeGrant;
  availableFlips: SkillFlipWindows;
  autoattackChains: Record<string, SkillId>;
  chaosStormCasts: number;
  clarity: ChargeGrant;
  signetIllusionsAt: number;
}

/** Creates state owned by every Mesmer build, excluding active-specialization fields. */
export function createMesmerCoreState(): MesmerCoreState {
  return {
    castDetails: new Map(),
    clones: [],
    cloneSequence: 0,
    trackedSkillHits: {},

    mimic: { charges: 0, expiresAt: 0 },
    availableFlips: {},
    autoattackChains: {},
    chaosStormCasts: 0,
    clarity: { charges: 0, expiresAt: 0 },
    signetIllusionsAt: Infinity
  };
}

/** Publishes this module's detached public observations at the planning boundary. */
export function projectMesmerCorePlanningState(input: Gw2PlanningStateInput) {
  const state = snapshotProfessionState(input.profession) as MesmerCoreState;
  const at = canonicalTime(input.time);
  return {
    // Clone counts remain entity observations; elite numeric pools are projected by their owners.
    ...(mesmerResourceKind(input.config.specialization ?? 'Core') === 'clones'
      ? {
          resource: state.clones.length,
          resourceDefinition: mesmerResourceDefinition('Core', { catalog: input.catalog })
        }
      : {}),
    // The display timer projects the grant without consuming or pruning its owner.
    clarityRemaining: state.clarity.charges > 0 ? Math.max(0, Math.round((state.clarity.expiresAt - at) * 1000)) : 0,
    availableFlips: Object.fromEntries(
      Object.entries(state.availableFlips).filter(([, window]) => skillFlipVisible(window, at))
    ),
    autoattackChains: Object.fromEntries(
      input.catalog.autoattackChains.map((chain) => [chain[0], state.autoattackChains[chain[0]] || chain[0]])
    )
  };
}
