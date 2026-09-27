/**
 * Owns Necromancer sword autoattack-chain retention and expiry scheduling.
 * Sword skill fragments remain in `skills/weapons/sword.ts`; the profession observes shared chain transitions here.
 */

import {
  resetAutoattackChains,
  type AutoattackChainTransitionResult
} from '#gw2/platform/skills/autoattack-chain-controller.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';

const SWORD_AUTOATTACK_EXPIRY_OWNER = 'necromancer.sword-autoattack-chain';
const SWORD_AUTOATTACK_EXPIRY_TASK = 'necromancer.sword-autoattack-chain-expire';
const SWORD_AUTOATTACK_RETENTION_SECONDS = 3;

/** A committed live sword transition replaces its expiry; preserving another cast never extends the deadline. */
export function observeNecromancerAutoattackTransition(
  runtime: NecromancerRuntime,
  _cast: RuntimeCast,
  result: AutoattackChainTransitionResult
): void {
  const sword = result.transitions.find((change) => change.chainRootId === ID.ENERVATION_BLADE);
  if (!sword || sword.decision === 'preserve') return;
  const state = runtime.profession.core;
  runtime.cancelOwner({ id: SWORD_AUTOATTACK_EXPIRY_OWNER, generation: state.swordChainGeneration });
  state.swordChainGeneration++;
  if (sword.decision === 'advance')
    runtime.schedule(
      SWORD_AUTOATTACK_EXPIRY_TASK,
      runtime.time + SWORD_AUTOATTACK_RETENTION_SECONDS,
      null,
      { id: SWORD_AUTOATTACK_EXPIRY_OWNER, generation: state.swordChainGeneration },
      -20
    );
}

export const necromancerSwordTasks = {
  [SWORD_AUTOATTACK_EXPIRY_TASK](runtime: NecromancerRuntime) {
    resetAutoattackChains(runtime, [ID.ENERVATION_BLADE]);
  }
};
