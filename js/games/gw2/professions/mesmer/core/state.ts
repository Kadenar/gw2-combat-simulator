import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';
import { snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { skillFlipVisible } from '#gw2/platform/engine/skills/skill-flips.js';
import { mesmerResourceDefinition } from '#gw2/professions/mesmer/family-state.js';
import { type SkillFlipWindows } from '#gw2/platform/engine/skills/skill-flips.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { MesmerClone } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';

/** Core owns state present for every specialization runtime. */
export interface MesmerCoreState {
  clones: MesmerClone[];
  trackedSkillHits: Record<string, number[]>;

  mimicUntil: number;
  availableFlips: SkillFlipWindows;
  autoattackChains: Record<string, SkillId>;
  chaosStormCasts: number;
  clarityUntil: number;
  signetIllusionsAt: number;
}

/** Creates state owned by every Mesmer build, excluding active-specialization fields. */
export function createMesmerCoreState(): MesmerCoreState {
  return {
    clones: [],
    trackedSkillHits: {},

    mimicUntil: 0,
    availableFlips: {},
    autoattackChains: {},
    chaosStormCasts: 0,
    clarityUntil: 0,
    signetIllusionsAt: Infinity
  };
}

/** Publishes this module's detached public observations at the planning boundary. */
export function projectMesmerCorePlanningState(input: Gw2PlanningStateInput) {
  const state = snapshotProfessionState(input.profession) as MesmerCoreState;
  const at = canonicalTime(input.time);
  return {
    resource: state.clones.length,
    resourceDefinition: mesmerResourceDefinition('Core', { catalog: input.catalog }),
    clarityRemaining: Math.max(0, Math.round((state.clarityUntil - at) * 1000)),
    availableFlips: Object.fromEntries(
      Object.entries(state.availableFlips).filter(([, window]) => skillFlipVisible(window, at))
    ),
    autoattackChains: Object.fromEntries(
      input.catalog.autoattackChains.map((chain) => [chain[0], state.autoattackChains[chain[0]] || chain[0]])
    )
  };
}
