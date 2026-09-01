import type { MesmerConfig } from '#gw2/content/professions/mesmer/types.js';
import type { MesmerCoreState, MesmerResolverState } from '#gw2/content/professions/mesmer/state/types.js';

/** Creates state owned by every Mesmer build, excluding active-specialization fields. */
export function createMesmerCoreState(_config: Partial<MesmerConfig> = {}): MesmerCoreState {
  return {
    clones: [],
    pendingResources: [],
    trackedSkillHits: {},
    traitReadyAt: {},
    counterspellAvailable: false,
    availableFlips: {},
    autoattackChains: {},
    sharperImagesProgress: 0,
    masterFencerProgress: 0,
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
