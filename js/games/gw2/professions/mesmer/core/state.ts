import { type SkillFlipWindows } from '#gw2/platform/engine/skills/skill-flips.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { MesmerClone } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerPendingResource } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import type { MesmerConfig } from '#gw2/professions/mesmer/types.js';

/** Core owns state present for every specialization runtime. */
export interface MesmerCoreState {
  clones: MesmerClone[];
  pendingResources: MesmerPendingResource[];
  trackedSkillHits: Record<string, number[]>;
  traitReadyAt: Record<string, number>;
  mimicUntil: number;
  availableFlips: SkillFlipWindows;
  autoattackChains: Record<string, SkillId>;
  chaosStormCasts: number;
  ineptitudeReadyAt: number;
  clarityUntil: number;
  hasExplicitCombatStart: boolean;
  combatStartTime: number;
}

export interface MesmerResolverState {
  ineptitudeReadyAt: number;
}

/** Creates state owned by every Mesmer build, excluding active-specialization fields. */
export function createMesmerCoreState(_config: Partial<MesmerConfig> = {}): MesmerCoreState {
  return {
    clones: [],
    pendingResources: [],
    trackedSkillHits: {},
    traitReadyAt: {},
    mimicUntil: 0,
    availableFlips: {},
    autoattackChains: {},
    chaosStormCasts: 0,
    ineptitudeReadyAt: 0,
    clarityUntil: 0,
    hasExplicitCombatStart: false,
    combatStartTime: 0
  };
}

/** Creates the resolver subset needed by Core Mesmer reactions. */
export function createMesmerCoreResolverState(): MesmerResolverState {
  return {
    ineptitudeReadyAt: 0
  };
}
