import { type SkillFlipWindows } from '#gw2/platform/engine/skills/skill-flips.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { MesmerClone } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerConfig } from '#gw2/professions/mesmer/types.js';

/** Core owns state present for every specialization runtime. */
export interface MesmerCoreState {
  clones: MesmerClone[];
  trackedSkillHits: Record<string, number[]>;
  traitReadyAt: Record<string, number>;
  mimicUntil: number;
  availableFlips: SkillFlipWindows;
  autoattackChains: Record<string, SkillId>;
  chaosStormCasts: number;
  ineptitudeReadyAt: number;
  clarityUntil: number;
  signetIllusionsAt: number;
}

/** Creates state owned by every Mesmer build, excluding active-specialization fields. */
export function createMesmerCoreState(_config: Partial<MesmerConfig> = {}): MesmerCoreState {
  return {
    clones: [],
    trackedSkillHits: {},
    traitReadyAt: {},
    mimicUntil: 0,
    availableFlips: {},
    autoattackChains: {},
    chaosStormCasts: 0,
    ineptitudeReadyAt: 0,
    clarityUntil: 0,
    signetIllusionsAt: Infinity
  };
}
