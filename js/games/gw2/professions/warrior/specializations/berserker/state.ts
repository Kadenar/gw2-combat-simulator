import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { WarriorRuntimeState } from '#gw2/professions/warrior/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';

type Runtime = Gw2Runtime<WarriorRuntimeState>;
export const BERSERK_EXPIRE = 'warrior.berserk-expiry';
// Base extensions are selected by the committed Rage skill and combined with trait extensions once.
export const berserkExtensions = new WeakMap<RuntimeCast, number>();

export interface BerserkerState {
  berserkActive: boolean;
  berserkUntil: number;
  fireAuraUntil: number;

  /** Actual completed activations let delayed hits react without reading action history. */
  completedActivations: Record<string, number>;
}

/** Declares Berserker's public mode fields and inactive values. */
export const BERSERKER_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  berserkActive: false,
  berserkUntil: 0
} satisfies Partial<BerserkerState>);

// Aura and proc deadlines are shared by the chronological Berserker reactions.
function createBerserkerState(): BerserkerState {
  return {
    berserkActive: false,
    berserkUntil: 0,
    // Aura acquisition, consumption, and expiry share this current window.
    fireAuraUntil: 0,

    completedActivations: {}
  };
}

export const berserkerState = defineProfessionSpecializationState('Berserker', createBerserkerState);

/** The status and expiry task share one deadline; older wakes cannot close a refreshed mode. */
export function publishBerserk(runtime: Runtime, cast: RuntimeCast): void {
  const state = berserkerState.from(runtime);
  runtime.emit({
    type: 'buff',
    at: runtime.time,
    source: 'Berserker',
    sourceId: ID.BERSERK,
    actorType: 'effect',
    activationId: cast.id,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    name: 'Berserk',
    kind: 'berserk',
    stacks: 1,
    duration: state.berserkUntil - runtime.time
  });
  runtime.schedule(BERSERK_EXPIRE, state.berserkUntil, state.berserkUntil, undefined, -220);
}
