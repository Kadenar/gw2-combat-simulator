import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';
import { snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';
import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { MESMER_MIRAGE_AMBUSH_SKILLS } from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';
import type { MesmerConfig } from '#gw2/professions/mesmer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

interface MesmerMirageMirror {
  availableAt: number;
  expiresAt: number;
  source: string;
}

export interface MesmerMirageState {
  pendingMirrorAts: number[];
  endurance: number;

  enduranceUpdatedAt: number;
  ambushUntil: number;
  ambushSource: string;
  cloneAmbushUntil: number;
  riddleOfSandReady: boolean;
  mirrors: MesmerMirageMirror[];
}

function createMirageState(_config: Partial<MesmerConfig> = {}): MesmerMirageState {
  return {
    pendingMirrorAts: [],
    // Mirage starts with two dodges' worth of continuously regenerating endurance.
    endurance: 100,

    enduranceUpdatedAt: 0,
    ambushUntil: 0,
    ambushSource: '',
    cloneAmbushUntil: 0,
    riddleOfSandReady: false,
    mirrors: []
  };
}

export const mirageState = defineProfessionSpecializationState('Mirage', createMirageState);

/** Publishes this module's detached public observations at the planning boundary. */
export function projectMiragePlanningState(input: Gw2PlanningStateInput) {
  const state = snapshotProfessionState<MesmerMirageState>(input.profession);
  const at = canonicalTime(input.time);
  const weapon = gw2ActivePrimaryWeapon(input.config, input.activeWeaponSet === 1 ? 1 : 2) || '';
  return {
    endurance: state.endurance,
    availableMirrors: state.mirrors.filter((mirror) => isTimeInWindow(at, mirror.availableAt, mirror.expiresAt)).length,
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
