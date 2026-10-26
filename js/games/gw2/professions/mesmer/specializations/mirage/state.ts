import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import {
  flattenProfessionState,
  projectPublicProfessionState,
  defineProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { MESMER_MIRAGE_AMBUSH_SKILLS } from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';

interface MesmerMirageMirror {
  availableAt: number;
  expiresAt: number;
}

export interface MesmerMirageState {
  pendingMirrorAts: number[];
  endurance: ResourceClock;
  ambushUntil: number;
  ambushSource: string;
  cloneAmbushUntil: number;
  riddleOfSandReady: boolean;
  mirrors: MesmerMirageMirror[];
}

/** Seeds fresh Mirage resources and windows independently of build configuration. */
function createMirageState(): MesmerMirageState {
  return {
    pendingMirrorAts: [],
    // Mirage starts with two dodges' worth of continuously regenerating endurance.
    endurance: createResourceClock(ENDURANCE.maximum),
    ambushUntil: 0,
    ambushSource: '',
    cloneAmbushUntil: 0,
    riddleOfSandReady: false,
    mirrors: []
  };
}

export const mirageState = defineProfessionSpecializationState('Mirage', createMirageState);

/** Detach the public clock and derive the ambush display without copying private mirror or cast state. */
export function projectMiragePlanningState(input: Gw2PlanningStateInput) {
  const state = flattenProfessionState(input.profession) as unknown as MesmerMirageState;
  const publicState = projectPublicProfessionState(state, ['endurance']);
  const at = canonicalTime(input.time);
  const weapon = gw2ActivePrimaryWeapon(input.config, input.activeWeaponSet === 1 ? 1 : 2) || '';
  return {
    ...publicState,
    availableAmbush:
      state.ambushSource && state.ambushUntil > at
        ? {
            name: input.catalog.skillsById.get(MESMER_MIRAGE_AMBUSH_SKILLS[weapon]?.id ?? NaN)?.name || '',
            source: state.ambushSource,
            expiresAt: Math.round(state.ambushUntil * 1000),
            remaining: Math.max(0, Math.round((state.ambushUntil - at) * 1000))
          }
        : null
  };
}
